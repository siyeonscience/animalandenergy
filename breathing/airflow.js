/* 공기 흐름 표시: 기관 → 기관지 → 폐로 이어진 길을 따라 작은 공기 알갱이가 움직여요.
   들숨(호흡 상태가 커질 때)에는 폐 안으로, 날숨에는 폐 밖으로 움직이고,
   빨리 숨쉴수록 빨리, 멈추면 사라져요. */
import * as THREE from 'three';

export function createAirflow(airwayPaths, arrowAt) {
  const group = new THREE.Group(); group.name = 'airflow';
  const paths = airwayPaths.map(pts => new THREE.CatmullRomCurve3(pts));
  const mat = new THREE.MeshBasicMaterial({ color: 0x7fd3ff, transparent: true, opacity: 0, depthTest: false });
  const geo = new THREE.SphereGeometry(0.06, 10, 8);
  const dots = Array.from({ length: 26 }, (_, i) => {
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 5;
    m.userData = { path: paths[i % 2], u: (i / 26) % 1 };
    group.add(m); return m;
  });
  // 입 쪽 큰 화살표 (들숨: 아래쪽, 날숨: 위쪽)
  const arrow = new THREE.Group();
  const aMat = new THREE.MeshBasicMaterial({ color: 0x4dabf7, transparent: true, opacity: 0, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 12), aMat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 16), aMat);
  head.position.y = -0.5; head.rotation.x = Math.PI;
  arrow.add(shaft, head); arrow.position.copy(arrowAt); arrow.renderOrder = 6;
  shaft.renderOrder = head.renderOrder = 6;
  group.add(arrow);

  return {
    group,
    update(dt, velocity) {
      const speed = Math.max(-1.2, Math.min(1.2, velocity * 0.9));
      const show = Math.min(1, Math.abs(velocity) * 2.2);
      mat.opacity = 0.9 * show; aMat.opacity = 0.95 * show;
      for (const d of dots) {
        d.userData.u = ((d.userData.u + speed * dt) % 1 + 1) % 1;
        d.userData.path.getPointAt(d.userData.u, d.position);
      }
      arrow.rotation.z = velocity >= 0 ? 0 : Math.PI;              // 날숨이면 위로 뒤집힘
      arrow.position.y = arrowAt.y + (velocity >= 0 ? 0 : -0.35);
    },
  };
}
