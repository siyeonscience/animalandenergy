/* 전면 카메라 열기/닫기 (getUserMedia). 영상은 이 기기 안에서만 쓰고 어디에도 보내거나 저장하지 않아요. */

export async function openFrontCamera(video) {
  if (!window.isSecureContext) throw camErr('insecure');
  if (!navigator.mediaDevices?.getUserMedia) throw camErr('unsupported');
  const tries = [
    // 4:3을 먼저 요청: 대부분의 전면 카메라 센서가 4:3이라, 16:9로 받으면 위아래가 잘려 더 확대돼 보여요
    { audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, aspectRatio: { ideal: 4 / 3 }, frameRate: { ideal: 30, max: 30 } } },
    { audio: false, video: { facingMode: 'user' } },
    { audio: false, video: true },             // 전면 카메라가 없으면 아무 카메라나
  ];
  let stream, last;
  for (const c of tries) {
    try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
    catch (e) { last = e; if (e.name !== 'OverconstrainedError' && e.name !== 'ConstraintNotSatisfiedError') break; }
  }
  if (!stream) throw last || camErr('NotFoundError');
  video.srcObject = stream;
  video.muted = true; video.playsInline = true;
  try { await video.play(); } catch (e) { closeCamera(stream, video); throw e; }
  if (!video.videoWidth) await new Promise(r => video.addEventListener('loadedmetadata', r, { once: true }));
  return stream;
}

/* 카메라 스트림을 완전히 끄기 (카메라 표시등도 꺼져요) */
export function closeCamera(stream, video) {
  stream?.getTracks().forEach(t => t.stop());
  if (video) { video.pause(); video.srcObject = null; }
}

function camErr(name) { const e = new Error(name); e.name = name; return e; }

export function cameraErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError': case 'PermissionDeniedError': case 'SecurityError':
      return '카메라 사용이 허용되지 않았어요. 브라우저 주소창의 카메라 권한을 "허용"으로 바꾼 뒤 다시 시작해 주세요.';
    case 'NotFoundError': case 'DevicesNotFoundError': case 'OverconstrainedError':
      return '카메라를 찾을 수 없어요. 카메라가 있는 태블릿에서 열어 주세요.';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError':
      return '카메라를 켤 수 없어요. 다른 앱이 카메라를 쓰고 있다면 닫고 다시 시작해 주세요.';
    case 'insecure':
      return '카메라는 https 주소(또는 이 기기의 localhost)에서만 쓸 수 있어요.';
    case 'unsupported':
      return '이 브라우저는 카메라 기능을 지원하지 않아요. 최신 Chrome이나 Safari에서 열어 주세요.';
    default:
      return '카메라를 시작하지 못했어요. (' + (e?.name || '알 수 없는 오류') + ')';
  }
}
