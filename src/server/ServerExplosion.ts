import { Tile, Explosion } from '../shared/types';

export default class ServerExplosion {
  tiles: Tile[];
  constructor(tiles: Tile[]) {
    this.tiles = tiles;
  }

  serialize(): Explosion {
    return {
      tiles: this.tiles,
    };
  }
}
