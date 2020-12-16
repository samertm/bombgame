import { Block } from '../shared/types';

export default class ServerBlock {
  x: number;
  y: number;
  destructable: boolean;

  constructor(x: number, y: number, destructable: boolean) {
    this.x = x;
    this.y = y;
    this.destructable = destructable;
  }

  serialize(): Block {
    return {
      x: this.x,
      y: this.y,
      destructable: this.destructable,
    }
  }
}
