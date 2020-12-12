import { SequencedMove, SequencedPlayer } from '../shared/types';
import { BOMB_FUSE_TIME_MS } from '../shared/constants';
import { movePlayer } from '../shared/player';
import ServerBomb from './ServerBomb';

export default class ServerPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  seqmoves: SequencedMove[];
  lastMove?: SequencedMove;
  alive: boolean;

  bombCooldownMs: number;
  nextBombAvailable: number;

  constructor(id: string, username: string, x: number, y: number) {
    this.id = id;
    this.username = username;
    this.x = x;
    this.y = y;
    this.seqmoves = [];
    this.alive = true;

    this.bombCooldownMs = 1000;
    this.nextBombAvailable = 0;
  }

  takeBombExplosion() {
    this.alive = false;
  }

  addSequencedMoves(seqmoves: SequencedMove[]) {
    for (const sm of seqmoves) {
      this.seqmoves.push(sm);
    }
  }

  update(dt: number, now: number): ServerBomb[] {
    if (!this.alive) {
      return[];
    }

    let seqmoves = this.seqmoves;
    if (seqmoves.length === 0) {
      // Use the last move if the user didn't give us a move in the
      // meantime.
      if (!this.lastMove) {
        return [];
      }
      seqmoves = [this.lastMove];
    }

    let triggeredBomb = false;

    for (const sm of seqmoves) {
      if (sm.move.bomb) {
        triggeredBomb = true;
      }
      movePlayer(this, dt/seqmoves.length, sm.move);
      this.lastMove = sm;
    }
    this.seqmoves = [];

    if (triggeredBomb && now >= this.nextBombAvailable) {
      this.nextBombAvailable = now + this.bombCooldownMs;
      return [new ServerBomb(this.x, this.y, now + BOMB_FUSE_TIME_MS)];
    }
    return [];
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
