/* 기관 이름표: 3D 위치를 화면 좌표로 바꿔 HTML 이름표를 붙여요. */
import * as THREE from 'three';

export function createLabels(container, items) {
  // items: [{ text, sub, anchor: (phase) => Vector3, side: 'left'|'right' }]
  const els = items.map(it => {
    const el = document.createElement('div');
    el.className = 'olabel ' + (it.side || 'right');
    el.innerHTML = `<i class="dot"></i><span class="txt">${it.text}${it.sub ? `<small>${it.sub}</small>` : ''}</span>`;
    container.appendChild(el);
    return el;
  });
  const v = new THREE.Vector3();
  let visible = true;
  return {
    setVisible(on) { visible = on; els.forEach(el => el.hidden = !on); },
    get visible() { return visible; },
    update(camera, phase, w, h) {
      if (!visible) return;
      const pts = items.map((it, i) => {
        v.copy(it.anchor(phase)).project(camera);
        const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
        els[i].style.transform = `translate(${x}px, ${y}px)`;
        els[i].style.opacity = v.z < 1 ? 1 : 0;
        return { i, x, y, side: it.side || 'right', dy: 0 };
      });
      // 같은 쪽 이름표끼리 겹치면 글자 상자만 위아래로 밀어내요 (점은 제자리)
      const GAP = 44;
      for (const side of ['left', 'right']) {
        const g = pts.filter(p => p.side === side).sort((a, b) => a.y - b.y);
        for (let k = 1; k < g.length; k++) {
          const prev = g[k - 1].y + g[k - 1].dy, need = prev + GAP - g[k].y;
          if (need > 0 && Math.abs(g[k].x - g[k - 1].x) < 170) g[k].dy = need;
        }
      }
      for (const p of pts) els[p.i].lastChild.style.transform = p.dy ? `translateY(${p.dy}px)` : '';
    },
  };
}
