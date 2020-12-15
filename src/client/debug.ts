let isDebug = false;

const debugDiv = document.getElementById('debug')!;
export const fpsDiv = document.getElementById('debug-fps')!;
export const latencyDiv = document.getElementById('debug-latency')!;
export const serverTickRateDiv = document.getElementById('debug-server-tick-rate')!;

export function debugEnabled(): boolean {
  return isDebug;
}

export function nop(...args: any[]) {
}

function toggleDebug() {
  isDebug = !isDebug;
  if (isDebug) {
    debugDiv.classList.remove('hidden');
  } else {
    debugDiv.classList.add('hidden');
  }
}

(window as any).toggleDebug = toggleDebug;
