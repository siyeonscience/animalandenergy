/* 호흡 기관 3D 모형 (Three.js 기본 도형과 직접 만든 메시)
   좌표: y 위쪽, z 앞쪽(보는 사람 쪽). 사람이 화면을 바라보고 서 있으므로
   몸의 오른쪽 = 화면 왼쪽(x < 0), 몸의 왼쪽 = 화면 오른쪽(x > 0).

   기관마다 setBreath(p)를 따로 가지고 있어서 서로 독립적으로 움직일 수 있어요.
   p는 0(날숨 끝)~1(들숨 최대)이고, MOTION의 숫자로 기관별 움직임 크기를 조절해요. */
import * as THREE from 'three';

/* ■ 기관별 움직임 크기 (여기 숫자를 바꾸면 움직임이 커지거나 작아져요) */
export const MOTION = {
  diaphragm: { domeExhale: 1.45, domeInhale: 0.6, drop: 0.2, rimLift: 0.12, rimWiden: 0.05 },
  ribs:      { pump: 0.13, bucket: 0.11 },          // 위로(펌프 손잡이), 바깥으로(양동이 손잡이) 회전(라디안)
  sternum:   { up: 0.24, forward: 0.2 },
  lungs:     { lateral: 0.1, anterior: 0.07, apexUp: 0.05 },
};

const COLOR = {
  bone: 0xeee4cf, cartilage: 0xcfe3ea, spine: 0xd9cfbb,
  muscle: new THREE.Color(0xb3322b), tendon: new THREE.Color(0xf0d6cc),
  lungR: 0xf08a9c, lungL: 0xf4a3b1, airway: 0xdbe7ef,
};
const ZC = 0.05;                     // 흉곽 단면 타원의 중심 z

/* ================= 가로막 높이 =================
   위로 볼록한 두 개의 둥근 지붕(몸의 오른쪽이 조금 더 높음)과 가운데 힘줄 부분.
   들숨(p→1): 수축하면서 지붕 높이가 낮아지고(평평해짐) 전체가 아래로 내려감. */
export function diaphragmY(x, z, p) {
  const M = MOTION.diaphragm;
  const RX = 2.35 * (1 + M.rimWiden * p), RZ = 1.5 * (1 + M.rimWiden * 0.8 * p);
  const nx = x / RX, nz = (z - ZC) / RZ;
  const r = Math.min(1, Math.hypot(nx, nz));
  const rim = -2.2 + 0.25 * nz + M.rimLift * p;          // 가장자리: 앞쪽이 더 높게 붙음
  const H = THREE.MathUtils.lerp(M.domeExhale, M.domeInhale, p);
  const shape = Math.pow(Math.max(0, 1 - r * r), 0.75);
  const side = 1 + 0.12 * (-nx);                         // 몸의 오른쪽(화면 왼쪽) 지붕이 더 높음
  const dip = 0.2 * Math.exp(-(nx * nx) / 0.05) * (1 - 0.5 * p);   // 가운데 힘줄의 오목한 부분
  return rim + H * shape * side - H * dip * shape - M.drop * p * shape;
}

/* 격자 메시 만들기 (rows × cols, 이웃 칸을 삼각형 2개로) */
function gridGeometry(rows, cols) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows * cols * 3), 3));
  const idx = [];
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  g.setIndex(idx);
  return g;
}

/* ================= 가로막 ================= */
function createDiaphragm() {
  const NR = 26, NT = 72;
  const geo = gridGeometry(NR, NT + 1);
  const colors = new Float32Array(NR * (NT + 1) * 3);
  for (let i = 0; i < NR; i++) for (let j = 0; j <= NT; j++) {
    const r = i / (NR - 1), th = (j / NT) * Math.PI * 2, nx = r * Math.cos(th);
    // 가운데 힘줄(중심 건): 밝은색 / 둘레의 근육: 붉은색
    const tendon = Math.max(0, 1 - r / 0.5) * Math.exp(-(nx * nx) / 0.15);
    const c = COLOR.muscle.clone().lerp(COLOR.tendon, Math.min(1, tendon * 1.6));
    colors.set([c.r, c.g, c.b], (i * (NT + 1) + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'diaphragm';
  const pos = geo.attributes.position;
  return {
    name: '가로막', mesh,
    setBreath(p) {
      const M = MOTION.diaphragm;
      const RX = 2.35 * (1 + M.rimWiden * p), RZ = 1.5 * (1 + M.rimWiden * 0.8 * p);
      for (let i = 0; i < NR; i++) for (let j = 0; j <= NT; j++) {
        const r = i / (NR - 1), th = (j / NT) * Math.PI * 2;
        const x = r * Math.cos(th) * RX, z = ZC + r * Math.sin(th) * RZ;
        pos.setXYZ(i * (NT + 1) + j, x, diaphragmY(x, z, p), z);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    },
    anchor: p => new THREE.Vector3(1.2, diaphragmY(1.2, 1.0, p), 1.0),
  };
}

/* ================= 폐 =================
   아래쪽(폐 바닥)은 가로막 위에 얹혀 있어서 가로막이 내려가면 함께 내려가고,
   옆과 앞쪽은 갈비뼈를 따라 넓어져요. → 들숨 때 폐 부피가 커짐 */
function createLung(side) {          // side: -1 = 몸의 오른쪽 폐(화면 왼쪽), +1 = 왼쪽 폐
  const right = side < 0;
  const NB = 8, NH = 34, NA = 56;    // 바닥 줄, 옆면 줄, 둘레 칸
  const ROWS = NB + NH + 1, COLS = NA + 1;
  const geo = gridGeometry(ROWS, COLS);
  const pos = geo.attributes.position;
  const cx = side * 1.12, cz = 0.02;
  const size = right ? 1 : 0.95;     // 왼쪽 폐는 심장 때문에 조금 작음
  const mat = new THREE.MeshPhysicalMaterial({
    color: right ? COLOR.lungR : COLOR.lungL, roughness: 0.45, metalness: 0, clearcoat: 0.3,
    transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = right ? 'lung-right' : 'lung-left';
  mesh.renderOrder = 2;

  // 단면(높이 비율 t, 둘레 각 a)에서 폐 바깥선까지의 x, z 거리
  function section(a, t, p) {
    const L = MOTION.lungs;
    const c = Math.cos(a), s = Math.sin(a);            // a=0: 바깥쪽, a=π/2: 앞쪽
    const lat = 1.05 * size * (1 + L.lateral * p), med = 0.7 * size;
    const ant = 1.18 * size * (1 + L.anterior * p), post = 1.25 * size * (1 + L.anterior * 0.5 * p);
    let X = side * (c > 0 ? lat : med) * c, Z = (s > 0 ? ant : post) * s;
    if (!right && c < 0 && s > 0) {                    // 왼쪽 폐의 심장 자국(심장 패임)
      const bump = Math.exp(-Math.pow((t - 0.3) / 0.2, 2)) * Math.sin(-c * Math.PI / 2 + Math.PI / 2) * s;
      X *= 1 - 0.4 * bump; Z *= 1 - 0.25 * bump;
    }
    return [X, Z];
  }
  const prof = t => Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, t - 0.08) / 0.92, 2.1)), 0.55);

  return {
    name: right ? '오른쪽 폐' : '왼쪽 폐', mesh,
    setBreath(p) {
      const apex = 2.85 + MOTION.lungs.apexUp * p;
      for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) {
        const a = (j / NA) * Math.PI * 2;
        let x, y, z;
        if (i < NB) {                                   // 바닥: 가로막 위에 얹힘
          const k = i / NB, [X, Z] = section(a, 0, p);
          x = cx + X * k; z = cz + Z * k; y = diaphragmY(x, z, p) + 0.05;
        } else {                                        // 옆면: 바닥 가장자리 → 꼭대기
          const t = (i - NB) / NH, f = prof(t), [X, Z] = section(a, t, p);
          x = cx + X * f; z = cz + Z * f;
          const base = diaphragmY(cx + X, cz + Z, p) + 0.05;
          y = base + (apex - base) * Math.pow(t, 0.9);
        }
        pos.setXYZ(i * COLS + j, x, y, z);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    },
    anchor: p => new THREE.Vector3(cx + side * 0.95, 0.5, 0.35),
    volume(p) { return 1 + 0.42 * p; },
  };
}

/* ================= 갈비뼈(흉곽) =================
   12쌍. 뒤쪽 끝(척추 관절)을 축으로 회전:
   - 펌프 손잡이 운동: 앞쪽 끝이 위·앞으로 (주로 위쪽 갈비뼈)
   - 양동이 손잡이 운동: 옆부분이 위·바깥으로 (주로 아래쪽 갈비뼈) */
const RIBS = Array.from({ length: 12 }, (_, i) => ({
  i,
  y: 2.55 - i * 0.36,                                   // 척추에 붙는 높이
  drop: 0.55 + 0.05 * i,                                // 앞쪽 끝이 더 낮음
  rx: [1.15, 1.6, 1.95, 2.15, 2.3, 2.38, 2.42, 2.4, 2.34, 2.22, 1.95, 1.65][i],
  rz: 1.45,
  end: i < 7 ? 70 : i < 10 ? 58 : i === 10 ? 5 : -15,  // 뼈 부분이 끝나는 각도(도)
  sternum: i < 7 ? 'true' : i < 10 ? 'false' : 'floating',
}));
const STERNUM_Y = i => 2.3 - i * 0.37;                   // 참갈비뼈가 복장뼈에 붙는 높이

function ribPoint(rib, s, deg) {
  const th = THREE.MathUtils.degToRad(deg), th0 = THREE.MathUtils.degToRad(-78);
  const k = (Math.sin(th) - Math.sin(th0)) / (1 - Math.sin(th0));
  return new THREE.Vector3(s * rib.rx * Math.cos(th), rib.y - rib.drop * Math.pow(Math.max(0, k), 1.2), ZC + rib.rz * Math.sin(th));
}

function createRibcage() {
  const group = new THREE.Group(); group.name = 'ribcage';
  const boneMat = new THREE.MeshStandardMaterial({ color: COLOR.bone, roughness: 0.6 });
  const cartMat = new THREE.MeshStandardMaterial({ color: COLOR.cartilage, roughness: 0.4, transparent: true, opacity: 0.85 });
  const pivots = [];
  for (const rib of RIBS) for (const s of [-1, 1]) {
    const pivotPos = new THREE.Vector3(s * 0.32, rib.y, -1.32);
    const pivot = new THREE.Group();
    pivot.position.copy(pivotPos);
    pivot.userData = { rib, s };
    // 뼈 부분
    const pts = [new THREE.Vector3(s * 0.32, rib.y, -1.32)];
    for (let d = -76; d <= rib.end; d += 6) pts.push(ribPoint(rib, s, d));
    pts.push(ribPoint(rib, s, rib.end));
    const curve = new THREE.CatmullRomCurve3(pts.map(v => v.sub(pivotPos)));
    const r = rib.i < 2 ? 0.085 : 0.07;
    pivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, r, 8, false), boneMat));
    // 갈비연골: 복장뼈(또는 위 갈비연골)로 이어짐
    if (rib.sternum !== 'floating') {
      const a = ribPoint(rib, s, rib.end);
      const target = rib.sternum === 'true'
        ? new THREE.Vector3(s * 0.32, STERNUM_Y(rib.i), 1.52)
        : new THREE.Vector3(s * (0.55 + (rib.i - 7) * 0.32), STERNUM_Y(6) - 0.15 - (rib.i - 7) * 0.12, 1.42 - (rib.i - 7) * 0.08);
      const mid = a.clone().lerp(target, 0.5); mid.z += 0.12; mid.y += rib.sternum === 'true' ? 0 : 0.18;
      const cc = new THREE.CatmullRomCurve3([a, mid, target].map(v => v.sub(pivotPos)));
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(cc, 16, r * 0.85, 8, false), cartMat));
    }
    group.add(pivot);
    pivots.push(pivot);
  }
  const anchorRib = pivots.find(p => p.userData.rib.i === 7 && p.userData.s === -1);
  const local = ribPoint(RIBS[7], -1, 15).sub(anchorRib.position);
  return {
    name: '갈비뼈', group,
    setBreath(p) {
      const M = MOTION.ribs;
      for (const pv of pivots) {
        const { rib, s } = pv.userData, k = rib.i / 11;
        pv.rotation.x = -M.pump * (1 - 0.55 * k) * p;            // 앞쪽이 위로
        pv.rotation.z = s * M.bucket * (0.45 + 0.55 * k) * p;     // 옆쪽이 위·바깥으로
      }
    },
    anchor: () => { anchorRib.updateWorldMatrix(true, false); return local.clone().applyMatrix4(anchorRib.matrixWorld); },
  };
}

/* ================= 복장뼈(흉골) ================= */
function createSternum() {
  const mat = new THREE.MeshStandardMaterial({ color: COLOR.bone, roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false });
  const group = new THREE.Group(); group.name = 'sternum';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.7, 0.1), mat);
  body.position.set(0, 1.0, 1.56);
  const manubrium = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.11), mat);
  manubrium.position.set(0, 2.45, 1.5);
  const xiphoid = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 4), mat);
  xiphoid.rotation.x = Math.PI; xiphoid.position.set(0, -0.6, 1.5);
  group.add(body, manubrium, xiphoid);
  return {
    name: '복장뼈', group,
    setBreath(p) { group.position.set(0, MOTION.sternum.up * p, MOTION.sternum.forward * p); group.rotation.x = -0.04 * p; },
  };
}

/* ================= 척추 ================= */
function createSpine() {
  const group = new THREE.Group(); group.name = 'spine';
  const mat = new THREE.MeshStandardMaterial({ color: COLOR.spine, roughness: 0.7 });
  const g = new THREE.CylinderGeometry(0.27, 0.29, 0.26, 16);
  for (let y = 3.3; y > -3.0; y -= 0.34) {
    const v = new THREE.Mesh(g, mat); v.position.set(0, y, -1.45); group.add(v);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.42), mat);
    sp.position.set(0, y - 0.05, -1.78); sp.rotation.x = 0.4; group.add(sp);
  }
  return { name: '척추', group, setBreath() {} };
}

/* ================= 기관·기관지 ================= */
export const AIRWAY = {
  trachea: [new THREE.Vector3(0, 4.6, 0.25), new THREE.Vector3(0, 3.4, 0.2), new THREE.Vector3(0, 2.25, 0.12)],
  right: [new THREE.Vector3(0, 2.25, 0.12), new THREE.Vector3(-0.55, 1.9, 0.08), new THREE.Vector3(-1.1, 1.35, 0.05)],
  left:  [new THREE.Vector3(0, 2.25, 0.12), new THREE.Vector3(0.6, 1.85, 0.08), new THREE.Vector3(1.15, 1.2, 0.05)],
};
function createAirway() {
  const group = new THREE.Group(); group.name = 'airway';
  const mat = new THREE.MeshStandardMaterial({ color: COLOR.airway, roughness: 0.5, transparent: true, opacity: 0.9 });
  const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, r, 12, false), mat);
  group.add(tube(AIRWAY.trachea, 0.2), tube(AIRWAY.right, 0.13), tube(AIRWAY.left, 0.12));
  // 기관의 C자 연골 고리
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xf5fafc, roughness: 0.4 });
  for (let y = 4.4; y > 2.5; y -= 0.22) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 20, Math.PI * 1.6), ringMat);
    ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI * 0.7; ring.position.set(0, y, 0.12 + (y - 2.25) * 0.06);
    group.add(ring);
  }
  return { name: '기관', group, setBreath() {}, anchor: () => new THREE.Vector3(0, 4.1, 0.25) };
}

/* ================= 모두 모으기 ================= */
export function createAnatomy() {
  const root = new THREE.Group(); root.name = 'respiratory-system';
  const organs = {
    ribcage: createRibcage(),
    sternum: createSternum(),
    spine: createSpine(),
    airway: createAirway(),
    lungRight: createLung(-1),
    lungLeft: createLung(1),
    diaphragm: createDiaphragm(),
  };
  for (const o of Object.values(organs)) root.add(o.group || o.mesh);
  return { root, organs };
}
