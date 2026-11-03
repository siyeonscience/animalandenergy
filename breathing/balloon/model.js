/* 풍선 모형 (호흡 운동 모형) — 3D
   투명한 병(흉강) · 병 입구 고무마개 · Y자 유리관(기관·기관지) · 고무풍선 2개(폐) · 병 아래 고무막(가로막, 고무풍선을 잘라 만든 막)
   setBreath(p): p = 0 날숨(고무막을 밀어 올림) ~ 1 들숨(고무막을 잡아당김)
   - 고무막을 당기면 병 속 부피가 커지고 압력이 낮아져서 → 바깥 공기가 유리관을 지나 고무풍선으로 들어가 풍선이 부풀어요. */
import * as THREE from 'three';

const R_JAR = 2.3;          // 병 안쪽 반지름
const Y_BOTTOM = -2.9;      // 병 아래 입구(고무막 높이)
const TUBE_Y_TOP = 4.35;    // 유리관 위 끝
const SPLIT_Y = 1.35;       // Y자로 갈라지는 곳
const BR_END = new THREE.Vector3(0.78, 0.82, 0);   // 가지 끝(오른쪽 기준)
const BAL_TILT = 0.62;      // 풍선이 바깥쪽으로 기운 각도(라디안)

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const MAT = {
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 }),
  glassRim: () => new THREE.MeshPhysicalMaterial({ color: 0xbfe3f5, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.5, depthWrite: false }),
  tube: () => new THREE.MeshPhysicalMaterial({ color: 0xdff2fb, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }),
  rubber: () => new THREE.MeshPhysicalMaterial({ color: 0xd8654a, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  balloon: () => new THREE.MeshPhysicalMaterial({ color: 0xdc6a7e, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2,
    sheen: 0.6, sheenColor: new THREE.Color(0xffc4cf), transparent: true, opacity: 0.94 }),
  membrane: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3,
    sheen: 0.5, sheenColor: new THREE.Color(0xffd0d6), transparent: true, opacity: 0.93, side: THREE.DoubleSide }),
};

/* 병 모양 (안쪽 단면 → 회전) */
function jarProfile() {
  const pts = [];
  pts.push(new THREE.Vector2(R_JAR, Y_BOTTOM));
  pts.push(new THREE.Vector2(R_JAR, 1.05));
  for (let i = 1; i <= 14; i++) {                         // 어깨: 둥글게 좁아짐
    const t = i / 14, a = t * Math.PI / 2;
    pts.push(new THREE.Vector2(0.62 + (R_JAR - 0.62) * Math.cos(a), 1.05 + 1.45 * Math.sin(a) * (0.6 + 0.4 * t)));
  }
  pts.push(new THREE.Vector2(0.62, 3.05));
  pts.push(new THREE.Vector2(0.7, 3.12));
  return pts;
}

/* 풍선 단면: 위(목) → 아래, 길이 1 기준 */
function balloonProfile() {
  const pts = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const t = i / N;                                      // 0 = 목 끝, 1 = 풍선 바닥
    // 목(가는 관) + 아래가 둥근 타원 몸통
    const e = 1 - Math.pow((t - 0.56) / 0.44, 2);
    let r = Math.max(0.13, 0.66 * Math.sqrt(Math.max(0, e)) * (0.9 + 0.1 * t));
    if (t < 0.12) r = 0.13 + 0.015 * Math.sin(t / 0.12 * Math.PI);
    if (t === 1) r = 0.001;
    pts.push(new THREE.Vector2(Math.max(0.001, r), -t * 1.55));
  }
  return pts;
}

export function createBalloonModel() {
  const group = new THREE.Group(); group.name = 'balloonModel';
  group.position.y = -0.55;

  /* --- 병 --- */
  const jar = new THREE.Mesh(new THREE.LatheGeometry(jarProfile(), 72), MAT.glass());
  jar.renderOrder = 4;
  group.add(jar);
  // 병의 테두리(바닥 가장자리·입구)를 살짝 진하게: 유리 윤곽이 보이도록
  const rimMat = MAT.glassRim();
  const rimBottom = new THREE.Mesh(new THREE.TorusGeometry(R_JAR, 0.05, 10, 96), rimMat); rimBottom.rotation.x = Math.PI / 2; rimBottom.position.y = Y_BOTTOM + 0.02;
  const rimNeck = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 10, 48), rimMat); rimNeck.rotation.x = Math.PI / 2; rimNeck.position.y = 3.1;
  group.add(rimBottom, rimNeck);

  /* --- 고무마개 --- */
  const rub = MAT.rubber();
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 0.55, 40), rub); plug.position.y = 3.2;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.26, 48), rub); cap.position.y = 3.55;
  group.add(plug, cap);

  /* --- 병 아래 받침(고무막을 고정하는 고리) --- */
  const ringShape = [new THREE.Vector2(R_JAR - 0.05, Y_BOTTOM - 0.05), new THREE.Vector2(R_JAR + 0.45, Y_BOTTOM - 0.05),
    new THREE.Vector2(R_JAR + 0.5, Y_BOTTOM - 0.3), new THREE.Vector2(R_JAR + 0.45, Y_BOTTOM - 0.55), new THREE.Vector2(R_JAR - 0.05, Y_BOTTOM - 0.55),
    new THREE.Vector2(R_JAR - 0.05, Y_BOTTOM - 0.05)];
  const ring = new THREE.Mesh(new THREE.LatheGeometry(ringShape, 72), rub);
  group.add(ring);

  /* --- Y자 유리관 --- */
  const tubeMat = MAT.tube();
  const stemCurve = new THREE.LineCurve3(new THREE.Vector3(0, TUBE_Y_TOP, 0), new THREE.Vector3(0, SPLIT_Y, 0));
  const branch = s => new THREE.CatmullRomCurve3([new THREE.Vector3(0, SPLIT_Y, 0), new THREE.Vector3(s * 0.3, SPLIT_Y - 0.2, 0),
    new THREE.Vector3(s * 0.62, SPLIT_Y - 0.4, 0), new THREE.Vector3(s * BR_END.x, BR_END.y, 0)]);
  const branches = [branch(-1), branch(1)];
  group.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 8, 0.12, 16, false), tubeMat));
  branches.forEach(c => group.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.1, 14, false), tubeMat)));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 24), MAT.glassRim()); lip.rotation.x = Math.PI / 2; lip.position.y = TUBE_Y_TOP;
  group.add(lip);

  /* --- 고무풍선 2개 (폐) --- */
  const balMat = MAT.balloon();
  const balloons = [-1, 1].map(s => {
    const geo = new THREE.LatheGeometry(balloonProfile(), 48);
    const rest = Float32Array.from(geo.attributes.position.array);
    const mesh = new THREE.Mesh(geo, balMat); mesh.renderOrder = 3;
    const holder = new THREE.Group();
    holder.position.set(s * BR_END.x, BR_END.y + 0.05, 0);
    holder.rotation.z = s * BAL_TILT;                      // 바깥쪽으로 기울임
    holder.add(mesh);
    // 풍선 목을 유리관에 묶은 고무 고리
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 24), rub); tie.rotation.x = Math.PI / 2; tie.position.y = -0.08;
    holder.add(tie);
    group.add(holder);
    return { s, geo, rest, mesh, holder };
  });

  /* --- 고무막 (가로막) --- */
  const NR = 22, NT = 72;
  const mGeo = new THREE.BufferGeometry();
  const mPos = new Float32Array((NR + 1) * NT * 3), mCol = new Float32Array((NR + 1) * NT * 3), mIdx = [];
  const base = new THREE.Color(0xe8828f), deep = new THREE.Color(0xc4485c), line = new THREE.Color(0xb94357), c = new THREE.Color();
  for (let i = 0; i <= NR; i++) for (let j = 0; j < NT; j++) {
    const k = i * NT + j, r = i / NR;
    // 고무가 늘어난 느낌: 가운데로 갈수록 진하고, 둥근 줄무늬
    c.copy(base).lerp(deep, (1 - r) * 0.55);
    if (i % 4 === 0 || j % 9 === 0) c.lerp(line, 0.35);
    mCol.set([c.r, c.g, c.b], k * 3);
    if (i < NR) { const j2 = (j + 1) % NT, a = k, b = i * NT + j2, d = (i + 1) * NT + j, e = (i + 1) * NT + j2; mIdx.push(a, d, b, b, d, e); }
  }
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
  mGeo.setIndex(mIdx);
  const membrane = new THREE.Mesh(mGeo, MAT.membrane()); membrane.name = 'membrane';
  group.add(membrane);
  // 가운데 손잡이(고무를 묶어 만든 꼭지): 잡아당기는 곳
  const knob = new THREE.Group();
  // 손잡이를 길게: 고무막을 밀어 올린 상태에서도 받침 고리 아래로 보여서 잡을 수 있어요
  const knobBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), MAT.balloon()); knobBall.position.y = -1.0; knobBall.scale.set(1, 0.8, 1);
  const knobNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.95, 14), MAT.balloon()); knobNeck.position.y = -0.47;
  knob.add(knobBall, knobNeck); knob.name = 'knob';
  group.add(knob);
  // 잡는 영역(보이지 않음): 병 아래쪽 어디를 눌러도 고무막을 잡을 수 있게
  const grab = new THREE.Mesh(new THREE.CylinderGeometry(R_JAR + 0.6, R_JAR + 0.6, 2.6, 32), new THREE.MeshBasicMaterial());
  grab.position.y = Y_BOTTOM - 0.75; grab.visible = false; grab.name = 'grabZone';
  group.add(grab);

  /* 고무막 높이: 당기면(p=1) 아래로 깊게, 밀면(p=0) 위로 살짝 볼록 */
  const membraneY = (r, p) => Y_BOTTOM + (1 - r * r) * (0.32 * (1 - p) - 1.05 * p);

  /* --- 공기 알갱이 --- */
  const air = new THREE.Group();
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x3b5bff, transparent: true, opacity: 0, depthTest: false });
  const dotGeo = new THREE.SphereGeometry(0.075, 10, 8);
  const pathFor = s => {
    const end = new THREE.Vector3(s * BR_END.x, BR_END.y, 0);
    const into = new THREE.Vector3(Math.sin(s * BAL_TILT), -Math.cos(BAL_TILT), 0);   // 풍선 속으로 들어가는 방향
    return new THREE.CatmullRomCurve3([new THREE.Vector3(0, TUBE_Y_TOP + 0.5, 0), new THREE.Vector3(0, SPLIT_Y + 0.4, 0),
      ...branches[s < 0 ? 0 : 1].getPoints(4).slice(1), end.clone().addScaledVector(into, 0.55)]);
  };
  const paths = [pathFor(-1), pathFor(1)];
  const dots = Array.from({ length: 24 }, (_, i) => {
    const m = new THREE.Mesh(dotGeo, dotMat); m.renderOrder = 8;
    m.userData = { path: paths[i % 2], u: (i / 24) % 1 };
    air.add(m); return m;
  });
  group.add(air);

  /* --- 움직임 방향 화살표 (고무막 아래) --- */
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xe8414f, transparent: true, opacity: 0, depthTest: false });
  const arrow = new THREE.Group();
  const aShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 12), arrowMat);
  const aHead = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 18), arrowMat); aHead.position.y = -0.55; aHead.rotation.x = Math.PI;
  arrow.add(aShaft, aHead); arrow.renderOrder = 9; aShaft.renderOrder = aHead.renderOrder = 9;
  group.add(arrow);

  let cur = 0;
  const api = {
    name: '풍선 모형', group, membrane, knob, grab,
    setBreath(p) {
      cur = p;
      // 고무막
      const a = mPos;
      for (let i = 0; i <= NR; i++) {
        const r = i / NR, y = membraneY(r, p), rr = R_JAR * r;
        for (let j = 0; j < NT; j++) { const th = j / NT * Math.PI * 2, k = (i * NT + j) * 3; a[k] = rr * Math.cos(th); a[k + 1] = y; a[k + 2] = rr * Math.sin(th); }
      }
      mGeo.attributes.position.needsUpdate = true; mGeo.computeVertexNormals(); mGeo.computeBoundingSphere();
      knob.position.y = membraneY(0, p);
      // 고무풍선: 목은 그대로, 몸통만 부풀어요
      const grow = 0.6 + 0.62 * p, stretch = 0.78 + 0.32 * p;
      for (const b of balloons) {
        const pos = b.geo.attributes.position.array, rest = b.rest;
        for (let k = 0; k < pos.length; k += 3) {
          const y = rest[k + 1], w = smooth(-0.1, -0.45, y);          // 목(0~-0.18)은 0, 몸통은 1
          const sr = 1 + (grow - 1) * w;
          pos[k] = rest[k] * sr; pos[k + 2] = rest[k + 2] * sr;
          pos[k + 1] = -0.18 + (y + 0.18) * (1 + (stretch - 1) * w);
        }
        b.geo.attributes.position.needsUpdate = true; b.geo.computeVertexNormals(); b.geo.computeBoundingSphere();
      }
    },
    update(dt, velocity) {
      // 공기: 들숨이면 풍선 안으로, 날숨이면 밖으로
      const speed = Math.max(-1.1, Math.min(1.1, velocity * 0.9)), show = Math.min(1, Math.abs(velocity) * 2.4);
      dotMat.opacity = 0.95 * show;
      for (const d of dots) { d.userData.u = ((d.userData.u + speed * dt) % 1 + 1) % 1; d.userData.path.getPointAt(d.userData.u, d.position); }
      // 고무막을 움직이는 방향 화살표
      arrowMat.opacity = 0.9 * show;
      const down = velocity >= 0;
      arrow.rotation.z = down ? 0 : Math.PI;
      arrow.position.set(0, membraneY(0, cur) - (down ? 1.75 : 2.3), 0);
    },
    /* 이름표 위치 (월드 좌표) */
    anchors: {
      balloon: () => new THREE.Vector3(-(BR_END.x + 0.75 * (0.6 + 0.62 * cur)), BR_END.y - 0.55, 0.2).add(group.position),
      tube: () => new THREE.Vector3(0.13, 2.4, 0.1).add(group.position),
      jar: () => new THREE.Vector3(R_JAR * 0.82, -1.2, 0.9).add(group.position),
      membrane: () => new THREE.Vector3(R_JAR * 0.55, membraneY(0.55, cur), 0.9).add(group.position),
    },
  };
  api.setBreath(0);
  return api;
}
