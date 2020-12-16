import ServerPlayer from './ServerPlayer';
import { Bomb } from '../shared/types';
import { BOMB_EXPLOSION_RADIUS, PLAYER_RADIUS } from '../shared/constants';
import { distanceTo, coordToTile, tileToCoord } from '../shared/collisions';

export default class ServerBomb {
  id: string;
  x: number;
  y: number;
  explodeTime: number;
  exploded: boolean;

  constructor(x: number, y: number, explodeTime: number) {
    this.id = ''+Math.trunc(Math.random()*10000000000000000);
    const coord = tileToCoord(coordToTile({x: x, y: y}));
    this.x = coord.x;
    this.y = coord.y;
    this.explodeTime = explodeTime;
    this.exploded = false;
  }

  update(now: number, players: {[id: string]: ServerPlayer}) {
    if (this.exploded) {
      return;
    }
    if (now < this.explodeTime) {
      return;
    }
    this.exploded = true;
    for (const id in players) {
      const p = players[id];
      if (distanceTo(this, p) <= PLAYER_RADIUS + BOMB_EXPLOSION_RADIUS) {
        p.takeBombExplosion();
      }
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
