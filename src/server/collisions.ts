import { Coords } from '../shared/types';

export function distanceTo(c1: Coords, c2: Coords): number {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  return Math.sqrt(dx*dx + dy*dy);
}
