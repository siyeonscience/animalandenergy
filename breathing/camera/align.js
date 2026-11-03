/* 카메라 속 사람의 가슴 위치에 3D 호흡 기관 겹치기 — 양쪽 어깨만 사용
   - 어깨 중간점 → 위치, 어깨 사이 거리 → 크기
   - 어깨 중심에서 아래로 (어깨 너비 × chestDrop)만큼 내려간 곳을 흉곽 중심으로 사용
   - 전면 카메라 영상은 거울처럼 좌우를 뒤집어 보여 주므로, 3D 모형도 좌우를 뒤집어 방향을 맞춰요
     (거울 속 내 왼쪽 = 화면 왼쪽 = 모형의 왼쪽 폐)
   ※ 실제 장기 위치를 재는 것이 아니라, 어깨 위치와 비율로 교육용 모형을 놓는 방식이에요. */
import * as THREE from 'three';

export function createAligner(root, cfg) {
  // 모형(기본 크기)의 빗장뼈 폭 재기
  root.updateMatrixWorld(true);
  const bl = new THREE.Box3(), br = new THREE.Box3();
  const L = root.getObjectByName('clavicle_L'), R = root.getObjectByName('clavicle_R');
  let span = 4.6;
  if (L && R) { bl.setFromObject(L); br.setFromObject(R); span = bl.max.x - br.min.x; }

  const pos = new THREE.Vector3(), goal = new THREE.Vector3();
  let scale = 1, has = false;

  return {
    span,
    /* 매 렌더 프레임: 부드럽게 따라가기 */
    // rect: 영상이 화면에 놓인 위치·크기(px, camera/zoom.js가 계산 — 배율에 따라 달라짐)
    update(sh, rect, W, H, camera, dt, mirrored = true) {
      if (!sh.seen || !rect.ready) return false;
      const dw = rect.w, dh = rect.h, ox = rect.x, oy = rect.y;
      const mx = ox + (mirrored ? 1 - sh.cx : sh.cx) * dw, my = oy + sh.cy * dh;
      const wpx = sh.width * dh;                                  // 어깨 너비(화면 픽셀)
      // 카메라 정면(0,0,D)에서 z=0 평면 위의 1픽셀 = 몇 장면 단위인지
      const D = camera.position.z, wpp = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / H;
      const cx = mx, cy = my + cfg.chestDrop * wpx;               // 흉곽 중심(근사)
      goal.set((cx - W / 2) * wpp, -(cy - H / 2) * wpp, 0);
      const goalScale = Math.max(0.15, (wpx * wpp * cfg.widthFactor) / span);
      if (!has) { pos.copy(goal); scale = goalScale; has = true; }
      const k = 1 - Math.exp(-dt / cfg.smoothSec);              // 시간 기반 보간 → 튀지 않게
      pos.lerp(goal, k); scale += (goalScale - scale) * k;
      root.position.copy(pos);
      root.scale.set(mirrored ? -scale : scale, scale, scale);
      return true;
    },
    reset() { has = false; root.position.set(0, 0, 0); root.scale.set(1, 1, 1); },
  };
}
