/* 혈액·오줌의 흐름 표시
   - 혈관은 모두 같은 색으로 두고, 흐르는 방향의 화살표로 동맥과 정맥을 구분해요.
   - 오줌은 노란 알갱이가 흐르는 모습으로 보여 줘요. */
import * as THREE from 'three';

/* 메시 꼭짓점을 한 축을 따라 나눠 칸마다 평균을 내서 중심선을 만들어요.
   filter(v)로 쓸 꼭짓점만 고를 수 있어요(예: 콩팥 밖 부분만). reverse면 방향을 뒤집어요. */
export function centerline(geometry, axis, bins, { filter = null, reverse = false } = {}) {
  const pos = geometry.attributes.position, v = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  const pts = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (filter && !filter(v)) continue;
    pts.push(v.clone()); lo = Math.min(lo, v[axis]); hi = Math.max(hi, v[axis]);
  }
  const sums = Array.from({ length: bins }, () => ({ p: new THREE.Vector3(), n: 0 }));
  for (const p of pts) {
    const k = Math.min(bins - 1, Math.floor((p[axis] - lo) / (hi - lo + 1e-9) * bins));
    sums[k].p.add(p); sums[k].n++;
  }
  const out = sums.filter(s => s.n > 0).map(s => s.p.divideScalar(s.n));
  return reverse ? out.reverse() : out;
}

/* 곡선을 따라 움직이는 화살표(원뿔) 또는 알갱이(구) */
export function createFlow(points, { count = 6, color = 0xffffff, size = 0.12, speed = 0.25, shape = 'arrow', opacity = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'flow';
  if (!(points instanceof THREE.Curve) && points.length < 2) { console.warn('흐름 경로가 너무 짧아요', points.length); return { group, update() {} }; }
  const curve = (points instanceof THREE.Curve) ? points : new THREE.CatmullRomCurve3(points);
  const geo = shape === 'arrow' ? new THREE.ConeGeometry(size * 0.55, size * 1.4, 14).rotateX(Math.PI / 2)
                                : new THREE.SphereGeometry(size * 0.5, 12, 10);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthTest: true });
  const items = Array.from({ length: count }, (_, i) => {
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 5;
    group.add(m); return { m, u: i / count };
  });
  const p = new THREE.Vector3(), t = new THREE.Vector3(), look = new THREE.Vector3();
  function place() {
    for (const it of items) {
      curve.getPointAt(it.u, p); curve.getTangentAt(it.u, t);
      it.m.position.copy(p);
      if (shape === 'arrow') it.m.lookAt(look.copy(p).add(t));
    }
  }
  place();
  return {
    group, curve,
    update(dt) { for (const it of items) it.u = (((it.u + speed * dt) % 1) + 1) % 1; place(); },
  };
}
