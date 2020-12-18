import { Block } from '../shared/types';

export default class ServerBlock {
  x: number;
  y: number;
  destructable: boolean;
  destroyed: boolean;

  constructor(x: number, y: number, destructable: boolean) {
    this.x = x;
    this.y = y;
    this.destructable = destructable;
    this.destroyed = false;
  }

  takeBombExplosion() {
    if (this.destructable) {
      this.destroyed = true;
    }
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
