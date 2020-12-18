import { SequencedMove, SequencedPlayer, Block } from '../shared/types';
import { BOMB_FUSE_TIME_MS, TILE_SIZE, PLAYER_SPEED } from '../shared/constants';
import { movePlayer } from '../shared/player';
import { circleCollision, playerToCircle } from '../shared/collisions';
import ServerPowerup from './ServerPowerup';
import ServerBomb from './ServerBomb';

const LAST_MOVE_DISCARDED_AFTER_MS = 50;

// Use the bomb cooldown to prevent double-bombing. Calculate it as a
// little under how long it takes to walk across one tile.
function bombCooldownMs(): number {
  const timeToWalkOneTileSec = TILE_SIZE/PLAYER_SPEED;
  return timeToWalkOneTileSec * 0.8 * 1000
}


export default class ServerPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  seqmoves: SequencedMove[];
  lastMove?: SequencedMove;
  lastMoveTs?: number;
  alive: boolean;
  bombsPlaced: number;
  maxBombs: number;
  bombExplosionSize: number;

  bombCooldownOverAt: number;

  constructor(id: string, username: string, x: number, y: number) {
    this.id = id;
    this.username = username;
    this.x = x;
    this.y = y;
    this.seqmoves = [];
    this.alive = true;

    this.bombsPlaced = 0;
    this.maxBombs = 2;
    this.bombExplosionSize = 4;
    this.bombCooldownOverAt = 0;
  }

  takeBombExplosion() {
    this.alive = false;
  }

  decrementBombsPlaced() {
    this.bombsPlaced--;
    if (this.bombsPlaced < 0) {
      this.bombsPlaced = 0;
    }
  }

  addSequencedMoves(seqmoves: SequencedMove[]) {
    for (const sm of seqmoves) {
      this.seqmoves.push(sm);
    }
  }

  update(
    dt: number,
    now: number,
    blocks: (Block | undefined)[][],
    bombs: ServerBomb[],
    powerups: ServerPowerup[],
  ): ServerBomb[] {
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

    const placedBombs: ServerBomb[] = [];

    for (const sm of seqmoves) {
      movePlayer(this, dt/seqmoves.length, sm.move, blocks, bombs);
      if (sm.move.bomb &&
          now >= this.bombCooldownOverAt &&
          this.bombsPlaced < this.maxBombs) {
        // Check for collisions against other bombs.
        const potentialBomb = new ServerBomb(this.x, this.y, now + BOMB_FUSE_TIME_MS, this.bombExplosionSize, this.id);
        let collision = false;
        for (const bomb of bombs) {
          if (potentialBomb.collidesWithBomb(bomb)) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          for (const bomb of placedBombs) {
            if (potentialBomb.collidesWithBomb(bomb)) {
              collision = true;
              break;
            }
          }
        }
        if (!collision) {
          this.bombsPlaced++;
          this.bombCooldownOverAt = now + bombCooldownMs();
          placedBombs.push(potentialBomb);
        }
      }
      for (const p of powerups) {
        if (!p.used && !p.destroyed && circleCollision(p.circle(), playerToCircle(this))) {
          p.touchedByPlayer();
          if (p.powerupType === 'numbombs') {
            this.maxBombs++;
          } else if (p.powerupType === 'bombsize') {
            this.bombExplosionSize++;
          } else {
            throw Error("Powerup type not implemented: " + p.powerupType);
          }
        }
      }

      this.lastMove = sm;
      this.lastMoveTs = now;
    }
    this.seqmoves = [];

    return placedBombs;
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
