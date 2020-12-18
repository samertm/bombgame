import { Powerup, PowerupType } from '../shared/types';
import { Circle } from '../shared/collisions';
import { POWERUP_RADIUS } from '../shared/constants';

export default class ServerPowerup {
  x: number;
  y: number;
  powerupType: PowerupType;
  destroyed: boolean;
  used: boolean;

  constructor(x: number, y: number, powerupType: PowerupType) {
    this.x = x;
    this.y = y;
    this.powerupType = powerupType;
    this.destroyed = false;
    this.used = false;
  }

  circle(): Circle {
    return {
      x: this.x,
      y: this.y,
      radius: POWERUP_RADIUS,
    }
  }

  takeBombExplosion() {
    this.destroyed = true;
  }

  touchedByPlayer() {
    this.used = true;
  }

  serialize(): Powerup {
    return {
      x: this.x,
      y: this.y,
      powerupType: this.powerupType,
      destroyed: this.destroyed,
    };
  }
}
