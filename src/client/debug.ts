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

export function getPlayerInterpolationRatio(): number {
  return (window as any).debugInterpolationRatio as number;
}

function toggleDebug() {
  isDebug = !isDebug;
  if (isDebug) {
    debugDiv.classList.remove('hidden');
  } else {
    debugDiv.classList.add('hidden');
  }
}

let printClientServerPosition = false;

export function shouldPrintClientServerPositionAndToggle(): boolean {
  const p = printClientServerPosition;
  if (p) {
    printClientServerPosition = false;
  }
  return p;
}

function debugPrintServerClientPosition() {
  printClientServerPosition = true;
}

(window as any).debugInterpolationRatio = 0.1;

(window as any).toggleDebug = toggleDebug;

(window as any).debugPrintServerClientPosition = debugPrintServerClientPosition;
