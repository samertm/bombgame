import { Update, Powerup, SequencedMove, Coord, SequencedPlayer, Player, Bomb, ClientState, Block, Explosion } from '../shared/types';
import { movePlayer } from '../shared/player';
import { distanceTo } from '../shared/collisions';
import { getPlayerInterpolationRatio, shouldPrintClientServerPositionAndToggle } from './debug';


const RENDER_DELAY_MS = 100;
const STILL_PLAYER_SHOULD_TELEPORT_DISTANCE = 10;
const MOVING_PLAYER_SHOULD_TELEPORT_DISTANCE = 100;

export default class State {
  gameUpdates: Update[];
  gameStart: number;
  firstServerTimestamp: number;
  localMoves: SequencedMove[];
  isMoving: boolean;
  previousPlayerCoord: {[sequence: number]: Coord};

  clientState: ClientState | undefined;

  constructor() {
    this.gameUpdates = [];
    this.gameStart = 0;
    this.firstServerTimestamp = 0;
    this.localMoves = [];
    this.isMoving = false;
    this.previousPlayerCoord = {};
  }

  processLocalMoves(smoves: SequencedMove[]) {
    this.isMoving = false;
    for (const sm of smoves) {
      this.isMoving = this.isMoving ||
        sm.move.left || sm.move.right || sm.move.up || sm.move.down;
      this.localMoves.push({
        sequence: sm.sequence,
        move: {
          left: sm.move.left,
          right: sm.move.right,
          up: sm.move.up,
          down: sm.move.down,
          bomb: sm.move.bomb,
        },
      });
    }
  }

  processGameUpdates(updates: Update[], ts: number) {
    if (updates.length === 0) {
      return;
    }
    if (!this.firstServerTimestamp) {
      this.firstServerTimestamp = updates[updates.length - 1].t;
      this.gameStart = ts;
    }

    for (const update of updates) {
      this.gameUpdates.push(update);
    }
  }

  update(dt: number, now: number) {
    if (this.gameUpdates.length === 0) {
      return;
    }

    // Get the non-player entities RENDER_DELAY_MS in the past.
    const delayedUpdateTime = this.firstServerTimestamp + (now - this.gameStart) - RENDER_DELAY_MS;
    let delayedIdx = -1;
    for (let i = this.gameUpdates.length-1; i >= 0; i--) {
      if (this.gameUpdates[i].t <= delayedUpdateTime) {
        delayedIdx = i;
        break;
      }
    }
    if (delayedIdx !== -1) {
      // Remove all older updates, leaving at least one.
      this.gameUpdates.splice(0, delayedIdx);
    }

    let entities: {
      others: Player[];
      bombs: Bomb[];
      blocks: (Block | undefined)[][];
      explosions: Explosion[];
      powerups: Powerup[];
    };
    if (this.gameUpdates.length === 1) {
      // Only one server update, so we can't interpolate.
      entities = {
        others: this.gameUpdates[0].others,
        bombs: this.gameUpdates[0].bombs,
        blocks: this.gameUpdates[0].blocks,
        explosions: this.gameUpdates[0].explosions,
        powerups: this.gameUpdates[0].powerups,
      };
    } else {
      // More than one update, interpolate between them.
      const baseUpdate = this.gameUpdates[0];
      const nextUpdate = this.gameUpdates[1];
      const ratio = (delayedUpdateTime - baseUpdate.t) / (nextUpdate.t - baseUpdate.t);

      entities = {
        others: interpolatePlayers(baseUpdate.others, nextUpdate.others, ratio),
        bombs: interpolateBombs(baseUpdate.bombs, nextUpdate.bombs, ratio),
        blocks: baseUpdate.blocks,
        explosions: baseUpdate.explosions,
        powerups: baseUpdate.powerups,
      }
    }

    const latestServerUpdate = this.gameUpdates[this.gameUpdates.length - 1];

    // No player, which means we're spectating.
    if (!latestServerUpdate.me) {
      this.clientState = {
        ...entities,
      };
      return;
    }

    // Update the player location.
    // Copy the latest server update so we can modify the player.
    let player: SequencedPlayer = {
      username: latestServerUpdate.me.username,
      sequence: latestServerUpdate.me.sequence,
      id: latestServerUpdate.me.id,
      x: latestServerUpdate.me.x,
      y: latestServerUpdate.me.y,
    };

    const prevPlayerCoord = this.previousPlayerCoord[player.sequence];
    if (prevPlayerCoord) {
      const dist = distanceTo(prevPlayerCoord, player);
      // If the player is not moving and they're pretty close to their
      // server location, don't move them.
      if (!this.isMoving && dist < STILL_PLAYER_SHOULD_TELEPORT_DISTANCE) {
        player.x = prevPlayerCoord.x;
        player.y = prevPlayerCoord.y;
      } else if (dist < MOVING_PLAYER_SHOULD_TELEPORT_DISTANCE) {
        // Move player a fraction of the way to the server location.
        const serverCoord = {x: player.x, y: player.y};
        player.x = prevPlayerCoord.x;
        player.y = prevPlayerCoord.y;
        player = interpolateMe(player, serverCoord, getPlayerInterpolationRatio());
        this.previousPlayerCoord[player.sequence] = {x: player.x, y: player.y};
      }
    }

    let mostUpToDateLocalMoveIndex = this.applyLocalMoves(dt, player, entities.blocks, entities.bombs);

    // Remove all states up to the most recent local move.
    if (mostUpToDateLocalMoveIndex !== undefined) {
      this.localMoves.splice(0, mostUpToDateLocalMoveIndex+1);
    }

    if (shouldPrintClientServerPositionAndToggle()) {
      console.log("CLIENT:", player);
      console.log("SERVER:", latestServerUpdate.me);
    }

    this.clientState = {
      me: player,
      debugServerMe: latestServerUpdate.me,
      ...entities,
    };
  }

  applyLocalMoves(dt: number, player: SequencedPlayer, blocks: (Block | undefined)[][], bombs: Bomb[]): number | undefined {
    let mostUpToDateLocalMoveIndex: number | undefined;
    for (let i = 0; i < this.localMoves.length; i++) {
      const sm = this.localMoves[i];
      if (sm.sequence < player.sequence) {
        delete this.previousPlayerCoord[sm.sequence];
        continue;
      }
      if (sm.sequence === player.sequence) {
        this.previousPlayerCoord[sm.sequence] = {x: player.x, y: player.y};
        mostUpToDateLocalMoveIndex = i;
        continue;
      }
      movePlayer(player, dt, sm.move, blocks, bombs);
      this.previousPlayerCoord[sm.sequence] = {x: player.x, y: player.y};
    }
    return mostUpToDateLocalMoveIndex;
  }

  getClientState(): ClientState | undefined {
    return this.clientState;
  }
}


function interpolateMe(baseMe: SequencedPlayer, nextCoord: Coord, ratio: number): SequencedPlayer {
  const p = interpolatePlayer(baseMe, nextCoord, ratio);
  return {
    username: baseMe.username,
    sequence: baseMe.sequence,
    id: p.id,
    x: p.x,
    y: p.y,
  };
}

function interpolatePlayers(basePlayers: Player[], nextPlayers: Player[], ratio: number): Player[] {
  let interpolated = [];

  const npMap: {[id: string]: Player} = {};
  for (const np of nextPlayers) {
    npMap[np.id] = np;
  }
  for (const bp of basePlayers) {
    interpolated.push(interpolatePlayer(bp, npMap[bp.id], ratio));
  }
  return interpolated;
}

function interpolatePlayer(basePlayer: Player, nextPlayer: Coord | undefined, ratio: number): Player {
  if (!nextPlayer) {
    return basePlayer;
  }

  const { x, y } = interpolateCoord(basePlayer, nextPlayer, ratio);
  return {
    username: basePlayer.username,
    id: basePlayer.id,
    x: x,
    y: y,
  };
}

function interpolateCoord(c1: Coord, c2: Coord, ratio: number): Coord {
  return {
    x: c1.x + (c2.x - c1.x) * ratio,
    y: c1.y + (c2.y - c1.y) * ratio,
  }
}

function interpolateBombs(baseBombs: Bomb[], nextBombs: Bomb[], ratio: number): Bomb[] {
  let interpolated = [];

  const nbMap: {[id: string]: Bomb} = {};
  for (const nb of nextBombs) {
    nbMap[nb.id] = nb;
  }
  for (const bb of baseBombs) {
    interpolated.push(interpolateBomb(bb, nbMap[bb.id], ratio));
  }
  return interpolated;
}

function interpolateBomb(baseBomb: Bomb, nextBomb: Bomb | undefined, ratio: number): Bomb {
  if (!nextBomb) {
    return baseBomb;
  }

  const { x, y } = interpolateCoord(baseBomb, nextBomb, ratio);
  return {
    id: baseBomb.id,
    x: x,
    y: y,
    exploded: baseBomb.exploded,
  };
}
