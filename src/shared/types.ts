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

export interface Coords {
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

export interface SequencedPlayer extends Player {
  sequence: number;
}

export interface State {
  me: SequencedPlayer;
  others: Player[];
  bombs: Bomb[];
}

export interface Update extends State {
  t: number;
}
