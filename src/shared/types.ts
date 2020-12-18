export interface Move {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  bomb: boolean;
}

export type MoveField = 'left' |
  'right' |
  'up' |
  'down' |
  'bomb';

export interface SequencedMove {
  sequence: number;
  move: Move;
}

export interface SequencedDtMove extends SequencedMove {
  dt: number;
}

export interface Coord {
  x: number;
  y: number;
}

export interface Bomb {
  id: string;
  x: number;
  y: number;
  exploded: boolean;
}

export interface Player {
  id: string;
  x: number;
  y: number;
}

export interface Block extends Coord {
  destructable: boolean;
  destroyed: boolean;
}

export interface SequencedPlayer extends Player {
  sequence: number;
}

export interface Explosion {
  tiles: Tile[];
}

export type PowerupType = 'bombsize' |
  'numbombs';

export interface Powerup extends Coord {
  powerupType: PowerupType;
  destroyed: boolean;
}

export interface State {
  me?: SequencedPlayer;
  others: Player[];
  bombs: Bomb[];
  blocks: (Block | undefined)[][];
  explosions: Explosion[];
  powerups: Powerup[];
}

export interface ClientState extends State {
  debugServerMe?: SequencedPlayer;
}

export interface Update extends State {
  t: number;
  tickRate: number;
}

export interface Tile {
  row: number;
  col: number;
}
