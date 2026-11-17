/* 네프론 3D 모형 (교과서 그림을 바탕으로 직접 만든 모형, 실제 크기·모양과는 달라요)
   토리 · 보먼주머니 · 세뇨관과 그 주위의 모세혈관, 콩팥동맥·콩팥정맥 쪽 혈관, 오줌관으로 이어지는 관 */
import * as THREE from 'three';
import { createFlow } from './flow.js';

const VESSEL = 0xd68a8f, TUBULE = 0xf2c66d, DUCT = 0xe8cf99;
// 설계 그림(900×660 px) 좌표 → 3D 좌표
const P = (x, y, z = 0) => new THREE.Vector3((x - 450) / 100, -(y - 330) / 100, z);
const curve = pts => new THREE.CatmullRomCurve3(pts.map(p => P(...p)), false, 'catmullrom', 0.3);

function tube(c, r, color, { seg = 160, opacity = 1 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3, transparent: opacity < 1, opacity });
  return new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 16, false), mat);
}

export function createNephron() {
  const group = new THREE.Group(); group.name = 'nephron';

  const artery = curve([[90, 640, 0], [90, 420, 0], [90, 250, 0], [130, 190, 0.05], [196, 172, 0.05]]);
  const capillary = curve([[262, 132, 0.1], [300, 88, 0.15], [380, 80, 0.1], [470, 86, 0.05], [540, 104, 0], [552, 160, -0.05],
    [545, 240, -0.1], [545, 400, -0.1], [545, 530, -0.05], [500, 580, 0], [440, 580, 0.05], [405, 530, 0.05], [405, 400, 0.05], [405, 240, 0.05]]);
  const vein = curve([[405, 470, 0.05], [320, 470, 0], [230, 470, 0], [170, 490, 0], [160, 560, 0], [160, 650, 0]]);
  const tubule = curve([[306, 170, 0], [350, 165, 0.15], [372, 118, 0.25], [404, 126, 0.1], [425, 172, -0.05], [430, 220, -0.1],
    [430, 400, -0.1], [432, 520, -0.05], [455, 556, 0], [497, 556, 0], [520, 520, -0.05], [520, 400, -0.1], [520, 240, -0.1],
    [548, 188, 0], [600, 154, 0.1], [660, 146, 0.05], [712, 150, 0]]);
  const duct = curve([[720, 40, 0], [720, 300, 0], [720, 520, 0], [720, 660, 0]]);

  group.add(tube(artery, 0.085, VESSEL));
  group.add(tube(capillary, 0.035, VESSEL, { seg: 260 }));
  group.add(tube(vein, 0.09, VESSEL));
  group.add(tube(tubule, 0.11, TUBULE, { seg: 260 }));
  group.add(tube(duct, 0.15, DUCT));
  // 세뇨관을 감싸는 모세혈관 가로줄 (세뇨관 뒤쪽을 지나요)
  for (const y of [280, 330, 380, 430, 480, 525]) group.add(tube(curve([[405, y, 0.05], [475, y + 6, -0.28], [545, y, -0.1]]), 0.028, VESSEL, { seg: 40 }));

  // 토리: 모세혈관이 실뭉치처럼 뭉친 부분
  const tori = new THREE.Group(); tori.position.copy(P(250, 170));
  const loopMat = new THREE.MeshPhysicalMaterial({ color: VESSEL, roughness: 0.4, clearcoat: 0.4 });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.04, 10, 40), loopMat);
    t.rotation.set(i * 0.7, i * 1.1, i * 0.5); t.position.set(Math.cos(i) * 0.06, Math.sin(i * 2) * 0.05, Math.sin(i) * 0.06);
    tori.add(t);
  }
  group.add(tori);
  // 보먼주머니: 토리를 둘러싼 주머니 (반투명)
  const bowman = new THREE.Mesh(new THREE.SphereGeometry(0.6, 40, 28),
    new THREE.MeshPhysicalMaterial({ color: TUBULE, roughness: 0.3, clearcoat: 0.6, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
  bowman.position.copy(P(250, 170)); bowman.renderOrder = 3;
  group.add(bowman);

  // 흐름: 혈관은 흰 화살표, 세뇨관·오줌관은 노란 알갱이
  const flows = [
    createFlow(artery, { count: 6, size: 0.16, speed: 0.22 }),
    createFlow(capillary, { count: 12, size: 0.1, speed: 0.12 }),
    createFlow(vein, { count: 6, size: 0.16, speed: 0.22 }),
    createFlow(tubule, { count: 12, shape: 'dot', color: 0xfff3bf, size: 0.12, speed: 0.08 }),
    createFlow(duct, { count: 6, shape: 'dot', color: 0xfff3bf, size: 0.16, speed: 0.15 }),
  ];
  flows.forEach(f => group.add(f.group));

  return {
    group,
    update(dt) { flows.forEach(f => f.update(dt)); },
    anchors: {
      tori: () => P(250, 160, 0.25),
      bowman: () => P(250, 228, 0.45),
      tubule: () => P(476, 556, 0.1),
      capillary: () => P(470, 86, 0.1),
    },
    labels: [{ text: '오줌관으로', at: () => P(720, 640, 0) }],
  };
}
