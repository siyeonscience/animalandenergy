/* 실제 인체 해부 모형(Z-Anatomy · BodyParts3D 기반, CC BY-SA 4.0)을 불러와 호흡에 맞춰 움직이는 모듈
   - models/thorax.glb : 갈비뼈 12쌍, 늑연골 10쌍, 복장뼈, 빗장뼈, 가슴 척추, 가로막, 기관·기관지, 좌우 폐(엽), 심장
   - 출처와 라이선스: models/ATTRIBUTION.md
   - 모든 기관은 setBreath(p) 하나로 움직여요. p: 0 = 날숨 끝, 1 = 들숨 최대
   - 모형 좌표: 미터, Y 위쪽, +X = 몸의 왼쪽, +Z = 몸의 앞쪽 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* 움직임 크기 (교육용으로 실제보다 조금 크게) */
export const MOTION = {
  diaphragm: { drop: 0.034, widen: 0.035 },    // 가로막 꼭대기가 내려가는 거리(m), 가장자리가 벌어지는 비율
  ribs: { pump: 0.075, bucket: 0.11 },         // 갈비뼈 회전(라디안): 앞쪽 들림 / 옆쪽 들림
  lungs: { lateral: 0.075, anterior: 0.07 },   // 폐가 옆·앞으로 커지는 비율
  heartDrop: 0.45,                             // 심장은 가로막을 따라 조금 내려가요
};

const SCALE = 14;                                // 미터 → 화면 단위
const CENTER = new THREE.Vector3(0, 1.25, 0.065); // 가슴 가운데

/* 재질: 실제 조직 느낌 */
const MAT = {
  bone: () => new THREE.MeshPhysicalMaterial({ color: 0xe2d2b4, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
  spine: () => new THREE.MeshPhysicalMaterial({ color: 0xd9ccb2, roughness: 0.55 }),
  cartilage: () => new THREE.MeshPhysicalMaterial({ color: 0x9fc3d1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3, transparent: true, opacity: 0.95 }),
  lung: () => new THREE.MeshPhysicalMaterial({ color: 0xe0837f, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35,
    sheen: 0.6, sheenColor: new THREE.Color(0xffc9c9), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  diaphragm: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, side: THREE.DoubleSide }),
  airway: () => new THREE.MeshPhysicalMaterial({ color: 0xe7d9c4, roughness: 0.4, clearcoat: 0.4 }),
  heart: () => new THREE.MeshPhysicalMaterial({ color: 0xa8423b, roughness: 0.45, clearcoat: 0.3, transparent: true, opacity: 0.55, depthWrite: false }),
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function bounds(pos) {
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}
function vertexWhere(pos, score) {          // score가 가장 큰 꼭짓점
  const v = new THREE.Vector3(), best = new THREE.Vector3(); let bs = -Infinity;
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const s = score(v); if (s > bs) { bs = s; best.copy(v); } }
  return best;
}
/* 모형 좌표 → 화면(장면) 좌표 */
const toScene = v => v.clone().sub(CENTER).multiplyScalar(SCALE);

export async function loadAnatomy(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const meshes = {};
  gltf.scene.traverse(o => { if (o.isMesh) meshes[o.name] = o; });

  const root = new THREE.Group(); root.name = 'thorax';
  const body = new THREE.Group();                       // 모형 좌표(미터) 그대로 담는 그룹
  body.scale.setScalar(SCALE); body.position.copy(CENTER).multiplyScalar(-SCALE);
  root.add(body);

  const boneMats = [];
  function take(name, mat, { deform = false } = {}) {
    const m = meshes[name]; if (!m) return null;
    if (/^(rib|cart|manub|stern|xiph|spine|clav)/.test(name)) boneMats.push(mat);
    const geo = m.geometry;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    if (deform) { geo.userData.rest = Float32Array.from(geo.attributes.position.array); geo.attributes.position.setUsage(THREE.DynamicDrawUsage); }
    body.add(mesh);
    return mesh;
  }

  const diaphragm = createDiaphragm(take('diaphragm', MAT.diaphragm(), { deform: true }));
  const ribcage = createRibcage(take, body);
  const lungRight = createLung(take('lung_R', MAT.lung(), { deform: true }), -1, diaphragm);
  const lungLeft = createLung(take('lung_L', MAT.lung(), { deform: true }), 1, diaphragm);
  lungRight.mesh.renderOrder = lungLeft.mesh.renderOrder = 2;
  const heart = createHeart(take('heart', MAT.heart()), diaphragm);
  take('spine', MAT.spine());
  take('clavicle_L', MAT.bone()); take('clavicle_R', MAT.bone());
  const trachea = take('trachea', MAT.airway());
  take('bronchi', MAT.airway());

  // 기관 위·아래 점으로 공기 길 만들기
  const tb = bounds(trachea.geometry.attributes.position);
  const top = new THREE.Vector3((tb.min.x + tb.max.x) / 2, tb.max.y + 0.012, (tb.min.z + tb.max.z) / 2);
  const bif = new THREE.Vector3(top.x, tb.min.y + 0.004, top.z + 0.002);
  const hilum = s => { const c = (s < 0 ? lungRight : lungLeft).hilum; return [bif.clone().lerp(c, 0.45).add(new THREE.Vector3(0, -0.006, 0)), c]; };
  const airwayPaths = [-1, 1].map(s => [top, bif, ...hilum(s)].map(toScene));

  const airway = {
    name: '기관', setBreath() {},
    anchor: () => toScene(new THREE.Vector3(top.x, (tb.max.y + tb.min.y) / 2 + 0.03, tb.max.z)),
  };

  return {
    root,
    organs: { diaphragm, ribcage, sternum: ribcage.sternum, lungRight, lungLeft, heart, airway },
    airwayPaths,
    /* 뼈를 반투명하게 해서 안쪽 폐·가로막을 잘 보이게 */
    setBonesSeeThrough(on) {
      for (const m of boneMats) { m.transparent = true; m.opacity = on ? 0.22 : (m.userData.baseOpacity ??= m.opacity); m.depthWrite = !on; m.needsUpdate = true; }
    },
    airflowArrowAt: toScene(top.clone().add(new THREE.Vector3(0, 0.05, 0))),
  };
}

/* ================= 가로막 =================
   실제 가로막은 두 개의 둥근 지붕(돔). 들숨 때 근육이 수축하면 지붕 꼭대기가 많이 내려가고
   가장자리(갈비뼈·척추에 붙은 곳)는 거의 그대로 → 내려가면서 평평해져요. 판이 통째로 움직이지 않아요. */
function createDiaphragm(mesh) {
  const geo = mesh.geometry, pos = geo.attributes.position, rest = geo.userData.rest;
  const b = bounds(pos), yTop = b.max.y;
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  // 높이에 따른 움직임 가중치: 갈비뼈에 붙은 낮은 가장자리 0 → 꼭대기 1
  const y0 = yTop - 0.085, y1 = yTop - 0.012;
  const weight = y => smooth(y0, y1, y);
  // 색: 가운데 윗부분은 하얀 힘줄(중심 힘줄), 나머지는 붉은 근육
  const col = new Float32Array(pos.count * 3), muscle = new THREE.Color(0xb23a32), tendon = new THREE.Color(0xe8d8c8), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const central = smooth(0.075, 0.035, Math.hypot((x - cx - 0.008) * 0.9, z - cz - 0.01)) * smooth(yTop - 0.05, yTop - 0.02, y);
    c.copy(muscle).lerp(tendon, central); col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const api = {
    name: '가로막', mesh, top: yTop,
    /* 높이 y에 있는 가로막 점이 호흡 p에서 내려가는 거리 (폐 바닥도 이것을 따라감) */
    dropAt: (y, p) => -MOTION.diaphragm.drop * p * weight(y),
    setBreath(p) {
      const a = pos.array, W = MOTION.diaphragm.widen * p;
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2], w = weight(y);
        a[i * 3] = cx + (x - cx) * (1 + W * (1 - w));          // 가장자리는 갈비뼈를 따라 조금 벌어짐
        a[i * 3 + 1] = y + api.dropAt(y, p);
        a[i * 3 + 2] = z + (z - cz) * W * 0.6 * (1 - w);
      }
      pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    },
    anchor: () => {
      const y = yTop - 0.035 + api.dropAt(yTop - 0.035, api.p || 0);
      return toScene(new THREE.Vector3(cx + 0.07, y, cz + 0.085));
    },
  };
  const set = api.setBreath; api.setBreath = p => { api.p = p; set(p); };
  return api;
}

/* ================= 폐 =================
   가슴 안쪽 벽(갈비뼈)을 따라 옆·앞으로 커지고, 바닥은 가로막을 따라 내려가요. */
function createLung(mesh, side, diaphragm) {
  const geo = mesh.geometry, pos = geo.attributes.position, rest = geo.userData.rest, n = pos.count;
  const b = bounds(pos);
  const medialX = side < 0 ? b.max.x : b.min.x;           // 가운데 쪽 경계
  const backZ = b.min.z, apex = b.max.y;
  // 각 꼭짓점 아래에 있는 폐 바닥 높이 (1cm 격자에서 가장 낮은 y)
  const cell = 0.012, key = (x, z) => Math.round(x / cell) + ':' + Math.round(z / cell), floor = new Map();
  for (let i = 0; i < n; i++) { const k = key(rest[i * 3], rest[i * 3 + 2]); const y = rest[i * 3 + 1]; if (!(floor.get(k) <= y)) floor.set(k, y); }
  const base = new Float32Array(n), t = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    base[i] = floor.get(key(rest[i * 3], rest[i * 3 + 2]));
    t[i] = Math.min(1, Math.max(0, (rest[i * 3 + 1] - base[i]) / (apex - base[i] + 1e-6)));   // 0 = 바닥, 1 = 꼭대기
  }
  const hilum = new THREE.Vector3(medialX - side * 0.025, b.min.y + (b.max.y - b.min.y) * 0.58, (b.min.z + b.max.z) / 2 - 0.005);
  let cur = 0;
  return {
    name: side < 0 ? '오른쪽 폐' : '왼쪽 폐', mesh, hilum,
    setBreath(p) {
      cur = p;
      const a = pos.array, L = MOTION.lungs.lateral * p, A = MOTION.lungs.anterior * p;
      for (let i = 0; i < n; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const low = 0.55 + 0.45 * (1 - t[i]);                     // 아래쪽이 더 많이 커짐
        a[i * 3] = medialX + (x - medialX) * (1 + L * low);
        a[i * 3 + 2] = backZ + (z - backZ) * (1 + A * low);
        a[i * 3 + 1] = y + diaphragm.dropAt(base[i], p) * Math.pow(1 - t[i], 1.4);
      }
      pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    },
    anchor: () => toScene(new THREE.Vector3(side < 0 ? b.min.x + 0.02 : b.max.x - 0.02,
      b.min.y + (b.max.y - b.min.y) * 0.5, (b.min.z + b.max.z) / 2 + 0.03).multiply(new THREE.Vector3(1 + MOTION.lungs.lateral * cur * 0.7, 1, 1))),
    volume: p => 1 + 0.4 * p,
  };
}

/* ================= 심장 (가로막 위에 얹혀 조금 따라 내려감) ================= */
function createHeart(mesh, diaphragm) {
  if (!mesh) return { name: '심장', setBreath() {} };
  return { name: '심장', mesh, setBreath(p) { mesh.position.y = diaphragm.dropAt(diaphragm.top, p) * MOTION.heartDrop; } };
}

/* ================= 갈비뼈·늑연골·복장뼈 =================
   갈비뼈는 척추 쪽 끝(갈비뼈 머리)을 축으로 돌아요.
    - 펌프 손잡이 운동: 앞쪽 끝이 위·앞으로 (위쪽 갈비뼈에서 큼)
    - 양동이 손잡이 운동: 옆쪽이 위·바깥으로 (아래쪽 갈비뼈에서 큼)
   복장뼈는 갈비뼈 앞 끝을 따라 위·앞으로 움직이고, 늑연골은 그 사이를 이어 휘어져요. */
function createRibcage(take, body) {
  const ribs = [];
  for (const S of ['R', 'L']) for (let i = 1; i <= 12; i++) {
    const mesh = take(`rib_${S}_${i}`, MAT.bone()); if (!mesh) continue;
    const pos = mesh.geometry.attributes.position, s = S === 'R' ? -1 : 1;
    const bb = bounds(pos), back = (bb.min.z + bb.max.z) / 2;
    const head = vertexWhere(pos, v => -Math.abs(v.x) * 3 - v.z);                      // 척추 쪽 끝
    const tip = vertexWhere(pos, v => v.z * 2 - Math.abs(v.x) * 0.5);                   // 앞쪽 끝
    const lateral = vertexWhere(pos, v => Math.abs(v.x));                               // 가장 바깥
    const k = (i - 1) / 11;
    const pumpAxis = new THREE.Vector3(1, 0, 0);
    const bucketAxis = tip.clone().sub(head).normalize();
    // 양동이 손잡이 방향: 옆쪽 점이 올라가는 쪽으로
    let bucketSign = 1;
    { const q = new THREE.Quaternion().setFromAxisAngle(bucketAxis, 0.05); const v = lateral.clone().sub(head).applyQuaternion(q).add(head); if (v.y < lateral.y) bucketSign = -1; }
    const rib = { mesh, S, s, i, head, tip, lateral, pumpAxis, bucketAxis, bucketSign, back,
      pump: MOTION.ribs.pump * (1 - 0.6 * k) * (i === 12 ? 0.3 : 1),
      bucket: MOTION.ribs.bucket * (0.35 + 0.65 * Math.sin(Math.min(1, k * 1.25) * Math.PI / 2)) * (i >= 11 ? 0.6 : 1),
      matrix: new THREE.Matrix4() };
    mesh.matrixAutoUpdate = false;
    ribs.push(rib);
  }
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), m = new THREE.Matrix4(), tA = new THREE.Matrix4(), tB = new THREE.Matrix4();
  function ribMatrix(r, p) {
    q1.setFromAxisAngle(r.pumpAxis, -r.pump * p);
    q2.setFromAxisAngle(r.bucketAxis, r.bucketSign * r.bucket * p);
    q2.multiply(q1);
    tA.makeTranslation(r.head.x, r.head.y, r.head.z); tB.makeTranslation(-r.head.x, -r.head.y, -r.head.z);
    return r.matrix.copy(tA).multiply(m.makeRotationFromQuaternion(q2)).multiply(tB);
  }

  // 복장뼈
  const sternParts = ['manubrium', 'sternum_body', 'xiphoid'].map(n => take(n, MAT.bone())).filter(Boolean);
  const sternMat = new THREE.Matrix4();
  sternParts.forEach(mesh => mesh.matrixAutoUpdate = false);
  const sternRibs = ribs.filter(r => r.i <= 7);
  const sternum = { name: '복장뼈', setBreath() {} };         // 갈비뼈가 함께 계산해요

  // 늑연골: 꼭짓점마다 갈비뼈 끝 ↔ 복장뼈 쪽 비율을 미리 계산
  const carts = [];
  for (const r of ribs) {
    if (r.i > 10) continue;
    const mesh = take(`cart_${r.S}_${r.i}`, MAT.cartilage(), { deform: true }); if (!mesh) continue;
    const geo = mesh.geometry, pos = geo.attributes.position, rest = geo.userData.rest;
    const inner = vertexWhere(pos, v => -Math.abs(v.x));
    const w = new Float32Array(pos.count), v = new THREE.Vector3();
    for (let j = 0; j < pos.count; j++) {
      v.fromArray(rest, j * 3);
      const dr = v.distanceTo(r.tip), ds = v.distanceTo(inner);
      w[j] = smooth(0, 1, ds / (dr + ds + 1e-6));               // 1 = 갈비뼈 쪽, 0 = 복장뼈 쪽
    }
    // 1~7번은 복장뼈에, 8~10번은 위쪽 늑연골(7번 갈비뼈 쪽)에 붙어요
    const inner7 = r.i > 7 ? ribs.find(x => x.S === r.S && x.i === 7) : null;
    carts.push({ r, geo, pos, rest, w, inner7 });
  }
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), d = new THREE.Vector3();

  const anchorRib = ribs.find(r => r.S === 'R' && r.i === 7);
  return {
    name: '갈비뼈', sternum,
    setBreath(p) {
      for (const r of ribs) { r.mesh.matrix.copy(ribMatrix(r, p)); r.mesh.matrixWorldNeedsUpdate = true; }
      // 복장뼈 = 1~7번 갈비뼈 앞 끝이 움직인 평균만큼 이동
      d.set(0, 0, 0);
      for (const r of sternRibs) d.add(va.copy(r.tip).applyMatrix4(r.matrix).sub(r.tip));
      d.divideScalar(sternRibs.length);
      sternMat.makeTranslation(d.x * 0.0, d.y, d.z);
      sternParts.forEach(mesh => { mesh.matrix.copy(sternMat); mesh.matrixWorldNeedsUpdate = true; });
      for (const c of carts) {
        const a = c.pos.array;
        for (let j = 0; j < c.pos.count; j++) {
          va.fromArray(c.rest, j * 3).applyMatrix4(c.r.matrix);
          vb.fromArray(c.rest, j * 3).applyMatrix4(c.inner7 ? c.inner7.matrix : sternMat);
          va.lerp(vb, 1 - c.w[j]).toArray(a, j * 3);
        }
        c.pos.needsUpdate = true; c.geo.computeVertexNormals();
      }
    },
    anchor: () => toScene(anchorRib.lateral.clone().applyMatrix4(anchorRib.matrix)),
  };
}
