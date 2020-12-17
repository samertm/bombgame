import { SequencedMove, SequencedPlayer, Block } from '../shared/types';
import { BOMB_FUSE_TIME_MS } from '../shared/constants';
import { movePlayer } from '../shared/player';
import ServerBomb from './ServerBomb';

const LAST_MOVE_DISCARDED_AFTER_MS = 50;

export default class ServerPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  seqmoves: SequencedMove[];
  lastMove?: SequencedMove;
  lastMoveTs?: number;
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

  update(dt: number, now: number, blocks: (Block | undefined)[][], bombs: ServerBomb[]): ServerBomb[] {
    if (!this.alive) {
      return[];
    }

    let seqmoves = this.seqmoves;
    if (seqmoves.length === 0) {
      // Use the last move if the user didn't give us a move in the
      // meantime.
      if (!this.lastMove ||
          (this.lastMoveTs && (now >= this.lastMoveTs + LAST_MOVE_DISCARDED_AFTER_MS))) {
        return [];
      }
      seqmoves = [this.lastMove];
    }

    let triggeredBomb = false;

    for (const sm of seqmoves) {
      if (sm.move.bomb) {
        triggeredBomb = true;
      }
      movePlayer(this, dt/seqmoves.length, sm.move, blocks, bombs);
      this.lastMove = sm;
      this.lastMoveTs = now;
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
