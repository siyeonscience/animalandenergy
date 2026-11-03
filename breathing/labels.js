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
      items.forEach((it, i) => {
        v.copy(it.anchor(phase)).project(camera);
        const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
        els[i].style.transform = `translate(${x}px, ${y}px)`;
        els[i].style.opacity = v.z < 1 ? 1 : 0;
      });
    },
  };
}
