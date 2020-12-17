import { MAP_SIZE, TILE_SIZE, PLAYER_RADIUS } from './constants';
import { Coord, Tile, Player } from '../shared/types';

export interface Circle extends Coord {
  radius: number,
}

export interface Rectangle {
  left: number,
  right: number,
  top: number,
  bottom: number,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function playerToCircle(p: Player): Circle {
  return {
    x: p.x,
    y: p.y,
    radius: PLAYER_RADIUS,
  };
}

export function coordToRectangle(c: Coord): Rectangle {
  return {
    left: c.x - (TILE_SIZE / 2),
    right: c.x + (TILE_SIZE / 2),
    top: c.y - (TILE_SIZE / 2),
    bottom: c.y + (TILE_SIZE / 2),
  };
}

export function circleRectangleCollision(circle: Circle, rect: Rectangle): boolean {
  // Find the closest point to the circle within the rectangle.
  const closestX = clamp(circle.x, rect.left, rect.right);
  const closestY = clamp(circle.y, rect.top, rect.bottom);

  // Calculate the distance between the circle's center and this
  // closest point.
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;

  // If the distance is less than the circle's radius, an intersection
  // occurs.
  const distanceSquared = (distanceX*distanceX) + (distanceY*distanceY);
  return distanceSquared < (circle.radius*circle.radius);
}

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
