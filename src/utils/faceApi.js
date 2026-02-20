// Load via same-origin `/api/vendor/...` to avoid mobile Tracking Prevention
// blocking storage access on third-party CDNs (e.g. unpkg.com).
const FACE_API_SCRIPT = '/api/vendor/face-api.min.js';
export const FACE_MODELS_URL = '/api/vendor/face-models';

let scriptPromise = null;
let modelsPromise = null;

export function getFaceApi() {
  return typeof window !== 'undefined' ? window.faceapi : undefined;
}

export function ensureFaceApiScript() {
  const existing = getFaceApi();
  if (existing) return Promise.resolve(existing);
  if (typeof document === 'undefined') return Promise.reject(new Error('no document'));

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const already = document.querySelector('script[data-face-api="1"]');
    if (already) {
      const done = () => {
        const api = getFaceApi();
        if (api) resolve(api);
        else reject(new Error('faceapi not found'));
      };
      already.addEventListener('load', done, { once: true });
      already.addEventListener('error', () => reject(new Error('load face-api failed')), {
        once: true,
      });
      setTimeout(done, 0);
      return;
    }

    const s = document.createElement('script');
    s.src = FACE_API_SCRIPT;
    s.async = true;
    s.defer = true;
    s.dataset.faceApi = '1';
    s.onload = () => resolve(getFaceApi());
    s.onerror = () => reject(new Error('load face-api failed'));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

export async function ensureFaceModelsLoaded() {
  if (modelsPromise) return modelsPromise;

  modelsPromise = (async () => {
    const faceapi = await ensureFaceApiScript();
    if (!faceapi) throw new Error('face-api not available');

    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODELS_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODELS_URL);
    return true;
  })();

  return modelsPromise;
}
