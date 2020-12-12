let isDebug = false;

export const fpsDiv = document.getElementById('debug-fps')!;

export function debugEnabled(): boolean {
  return isDebug;
}

function toggleDebug() {
  isDebug = !isDebug;
  if (isDebug) {
    fpsDiv.classList.remove('hidden');
  } else {
    fpsDiv.classList.add('hidden');
  }
}

(window as any).toggleDebug = toggleDebug;
