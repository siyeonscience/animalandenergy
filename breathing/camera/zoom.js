/* 카메라 배율 (0.5배 ~ 1배)
   1) 기기 카메라가 배율(zoom) 조절을 지원하면 카메라 자체 배율을 먼저 써요 (더 넓게 찍힘).
   2) 기기가 그만큼 줄이지 못하면 나머지는 '화면 배율'로: 영상을 작게 보여서 화면에 더 많이 보이게 해요.
   1배 = 영상이 화면을 꽉 채움(가장자리는 잘림), 0.5배 = 그 절반 크기로 작게(주변은 어둡게).
   영상을 놓은 위치(rect)는 3D 모형 맞추기(align.js)에서도 똑같이 써요. */

const KEY = 'breath.camZoom';
export const ZOOM_MIN = 0.5, ZOOM_MAX = 1;

export function createZoom({ video, view, onChange = () => {} }) {
  let value = load();
  let track = null, hw = null, hwApplied = 1, sw = 1, applying = Promise.resolve();
  // 영상이 화면(#view) 안에 놓인 위치·크기 (px). 매번 새로 만들지 않음
  const rect = { x: 0, y: 0, w: 0, h: 0, ready: false };

  function load() { try { const v = parseFloat(localStorage.getItem(KEY)); return v >= ZOOM_MIN && v <= ZOOM_MAX ? v : 1; } catch { return 1; } }
  function save() { try { localStorage.setItem(KEY, String(value)); } catch {} }

  /* 영상 위치 계산 + 화면에 반영 */
  function layout() {
    const vw = video.videoWidth, vh = video.videoHeight, W = view.clientWidth, H = view.clientHeight;
    if (!vw || !vh || !W || !H) { rect.ready = false; return; }
    const s = Math.max(W / vw, H / vh) * sw;                  // 1배 = 꽉 채움(cover), 작을수록 작게
    rect.w = vw * s; rect.h = vh * s; rect.x = (W - rect.w) / 2; rect.y = (H - rect.h) / 2; rect.ready = true;
    const st = video.style;
    st.left = rect.x + 'px'; st.top = rect.y + 'px'; st.width = rect.w + 'px'; st.height = rect.h + 'px';
  }

  /* 기기 배율 → 화면 배율 순서로 적용 */
  async function apply() {
    let target = 1;
    if (track && hw) {
      target = Math.min(hw.max, Math.max(hw.min, value));
      if (hw.step) target = Math.round(target / hw.step) * hw.step;
      try { await track.applyConstraints({ advanced: [{ zoom: target }] }); hwApplied = target; }
      catch (e) { console.warn('카메라 배율 조절 실패, 화면 배율로 대신해요', e); hw = null; hwApplied = 1; }
    } else hwApplied = 1;
    sw = Math.min(1, value / hwApplied);
    layout(); onChange(api);
  }

  const ro = new ResizeObserver(() => layout());
  ro.observe(view);
  video.addEventListener('resize', layout);                   // 해상도가 바뀌면 다시 계산
  video.addEventListener('loadedmetadata', layout);

  const api = {
    get value() { return value; },
    get hardware() { return hw ? { min: hw.min, max: hw.max, applied: hwApplied } : null; },
    get screen() { return sw; },
    rect,
    /* 카메라가 켜지면: 기기 배율 지원 여부 확인 */
    attach(stream) {
      track = stream.getVideoTracks()[0] || null;
      const caps = track?.getCapabilities?.() || {};
      hw = caps.zoom && typeof caps.zoom.min === 'number' && caps.zoom.min <= 1 ? { min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0 } : null;
      applying = apply();
      return applying;
    },
    detach() {
      track = null; hw = null; hwApplied = 1; sw = 1; rect.ready = false;
      const st = video.style; st.left = st.top = st.width = st.height = '';
    },
    set(v) {
      value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(v * 100) / 100)); save();
      // 빠르게 여러 번 바뀌어도 순서대로 적용
      applying = applying.then(apply);
      return applying;
    },
    layout,
  };
  return api;
}
