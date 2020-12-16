import { MAP_SIZE, TILE_SIZE } from './constants';
import { Coord, Tile } from '../shared/types';

export function distanceTo(c1: Coord, c2: Coord): number {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  return Math.sqrt(dx*dx + dy*dy);
}

export function coordToTile(c: Coord): Tile {
  const maxTile = (MAP_SIZE / TILE_SIZE) - 1;
  return {
    row: Math.min(Math.max(Math.trunc(c.y / TILE_SIZE), 0), maxTile),
    col: Math.min(Math.max(Math.trunc(c.x / TILE_SIZE), 0), maxTile),
  };
}

export function tileToCoord(t: Tile): Coord {
  return {
    x: t.col * TILE_SIZE + (TILE_SIZE / 2),
    y: t.row * TILE_SIZE + (TILE_SIZE / 2),
  }
}
