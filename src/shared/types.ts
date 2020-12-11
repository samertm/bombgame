export interface Move {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export type MoveField = 'left' |
  'right' |
  'up' |
  'down';

export interface SequencedMove {
  sequence: number;
  move: Move;
}

export interface SequencedDtMove extends SequencedMove {
  dt: number;
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
}

export interface Update extends State {
  t: number;
}
