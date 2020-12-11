import { SequencedMove, SequencedPlayer } from '../shared/types';
import { movePlayer } from '../shared/player';

export default class ServerPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  seqmoves: SequencedMove[];
  lastMove?: SequencedMove;

  constructor(id: string, username: string, x: number, y: number) {
    this.id = id;
    this.username = username;
    this.x = x;
    this.y = y;
    this.seqmoves = []
  }

  addSequencedMoves(seqmoves: SequencedMove[]) {
    for (const sm of seqmoves) {
      this.seqmoves.push(sm);
    }
  }

  update(dt: number) {
    let seqmoves = this.seqmoves;
    if (seqmoves.length === 0) {
      // Use the last move if the user didn't give us a move in the
      // meantime.
      if (!this.lastMove) {
        return;
      }
      seqmoves = [this.lastMove];
    }

    for (const sm of seqmoves) {
      movePlayer(this, dt, sm.move);
      this.lastMove = sm;
    }
    this.seqmoves = [];
  }

  serialize(): SequencedPlayer {
    const seqnum = (this.lastMove) ? this.lastMove.sequence : 0;
    return {
      sequence: seqnum,
      id: this.id,
      x: this.x,
      y: this.y,
    }
  }
}
