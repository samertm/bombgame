import { Block, PowerupType } from '../shared/types';
import ServerPowerup from './ServerPowerup';

export default class ServerBlock {
  x: number;
  y: number;
  destructable: boolean;
  destroyed: boolean;
  containsPowerup?: PowerupType;

  constructor(x: number, y: number, destructable: boolean, containsPowerup?: PowerupType) {
    this.x = x;
    this.y = y;
    this.destructable = destructable;
    this.containsPowerup = containsPowerup;
    this.destroyed = false;
  }

  takeBombExplosion(): ServerPowerup | undefined {
    let powerup: ServerPowerup | undefined;
    if (this.destructable) {
      if (!this.destroyed && this.containsPowerup) {
        powerup = new ServerPowerup(this.x, this.y, this.containsPowerup);
      }
      this.destroyed = true;
    }
    return powerup;
  }

  serialize(): Block {
    return {
      x: this.x,
      y: this.y,
      destructable: this.destructable,
      destroyed: this.destroyed,
    }
  }
}
