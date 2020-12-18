import ServerPlayer from './ServerPlayer';
import ServerBlock from './ServerBlock';
import ServerPowerup from './ServerPowerup';
import { Bomb, Tile } from '../shared/types';
import { NUM_TILES } from '../shared/constants';
import { coordToTile, tileToCoord, circleRectangleCollision, playerToCircle, tileToRectangle, rectangleCollision, tileToKey, coordToRectangle } from '../shared/collisions';
import ServerExplosion from './ServerExplosion';

const EXPLOSION_DELAY_AFTER_HIT_MS = 1;

export default class ServerBomb {
  id: string;
  x: number;
  y: number;
  explodeTime: number;
  exploded: boolean;
  size: number;
  parentPlayerId: string;

  constructor(x: number, y: number, explodeTime: number, size: number, parentPlayerId: string) {
    this.id = ''+Math.trunc(Math.random()*10000000000000000);
    const coord = tileToCoord(coordToTile({x: x, y: y}));
    this.x = coord.x;
    this.y = coord.y;
    this.explodeTime = explodeTime;
    this.size = size;
    this.parentPlayerId = parentPlayerId;
    this.exploded = false;
  }

  collidesWithBomb(bomb: Bomb) {
    return rectangleCollision(coordToRectangle(this), coordToRectangle(bomb));
  }

  update(
    now: number,
    players: {[id: string]: ServerPlayer},
    bombs: ServerBomb[],
    blocks: (ServerBlock | undefined)[][],
    powerups: ServerPowerup[],
  ): {
    explosion: ServerExplosion,
    powerups: ServerPowerup[],
  } | undefined {

    if (this.exploded) {
      return;
    }
    if (now < this.explodeTime) {
      return;
    }
    this.exploded = true;
    const parent = players[this.parentPlayerId];
    if (parent) {
      parent.decrementBombsPlaced();
    }
    const tilesExploded: Tile[] = [];
    const newPowerups: ServerPowerup[] = [];

    const seen: {[tileKey: string]: boolean} = {};
    const first = coordToTile(this);
    const next: ['all'|'up'|'down'|'left'|'right', Tile][] = [['all', first]];
    while (next.length !== 0) {
      const [direction, t] = next.shift()!;
      const key = tileToKey(t);
      if (seen[key]) {
        continue;
      }
      seen[key] = true;
      if (t.row < 0 || t.row > NUM_TILES - 1 || Math.abs(first.row - t.row) > this.size ||
          t.col < 0 || t.col > NUM_TILES - 1 || Math.abs(first.col - t.col) > this.size) {
        continue;
      }
      const block = blocks[t.row][t.col];
      if (block) {
        const powerup = block.takeBombExplosion();
        if (powerup) {
          newPowerups.push(powerup);
        }
        continue;
      }
      const tileRect = tileToRectangle(t);
      for (const id in players) {
        const p = players[id];
        if (circleRectangleCollision(playerToCircle(p), tileRect)) {
          p.takeBombExplosion();
        }
      }
      for (const bomb of bombs) {
        if (bomb.id === this.id) {
          continue;
        }
        if (rectangleCollision(tileRect, coordToRectangle(bomb))) {
          bomb.takeBombExplosion(now);
        }
      }
      for (const powerup of powerups) {
        if (circleRectangleCollision(powerup.circle(), tileRect)) {
          powerup.takeBombExplosion();
        }
      }

      tilesExploded.push(t);

      if (direction === 'all') {
        next.push(['up', {col: t.col, row: t.row-1}]);
        next.push(['down', {col: t.col, row: t.row+1}]);
        next.push(['left', {col: t.col-1, row: t.row}]);
        next.push(['right', {col: t.col+1, row: t.row}]);
      } else if (direction === 'up') {
        next.push(['up', {col: t.col, row: t.row-1}]);
      } else if (direction === 'down') {
        next.push(['down', {col: t.col, row: t.row+1}]);
      } else if (direction === 'left') {
        next.push(['left', {col: t.col-1, row: t.row}]);
      } else if (direction === 'right') {
        next.push(['right', {col: t.col+1, row: t.row}]);
      }
    }

    return {
      explosion: new ServerExplosion(tilesExploded),
      powerups: newPowerups,
    };
  }

  takeBombExplosion(hitTime: number) {
    if (this.explodeTime > hitTime + EXPLOSION_DELAY_AFTER_HIT_MS) {
      this.explodeTime = hitTime + EXPLOSION_DELAY_AFTER_HIT_MS;
    }
  }

  serialize(): Bomb {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      exploded: this.exploded,
    }
  }
}
