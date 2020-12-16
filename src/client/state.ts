import { Update, SequencedDtMove, SequencedMove, Coord, SequencedPlayer, Player, Bomb, ClientState, Block } from '../shared/types';
import { movePlayer } from '../shared/player';
import { distanceTo } from '../shared/collisions';
import { getPlayerInterpolationRatio, shouldPrintClientServerPositionAndToggle } from './debug';


const RENDER_DELAY_MS = 100;
const STILL_PLAYER_SHOULD_TELEPORT_DISTANCE = 10;
const MOVING_PLAYER_SHOULD_TELEPORT_DISTANCE = 100;

const gameUpdates: Update[] = [];
let gameStart = 0;
let firstServerTimestamp = 0;

export function initState() {
  gameStart = 0;
  firstServerTimestamp = 0;
}

let localMoves: SequencedDtMove[] = [];
let isMoving = false;

export function processLocalMoves(dt: number, smoves: SequencedMove[]) {
  isMoving = false;
  for (const sm of smoves) {
    isMoving = isMoving || sm.move.left || sm.move.right || sm.move.up || sm.move.down;
    localMoves.push({
      dt: dt,
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

export function processGameUpdates(updates: Update[], ts: number) {
  if (updates.length === 0) {
    return;
  }
  if (!firstServerTimestamp) {
    firstServerTimestamp = updates[updates.length - 1].t;
    gameStart = ts;
  }

  for (const update of updates) {
    gameUpdates.push(update);
  }
}

let previousPlayerCoord: {[sequence: number]: Coord} = {};

export function getState(now: number): ClientState | undefined {
  if (gameUpdates.length === 0) {
    return;
  }

  // Get the non-player entities RENDER_DELAY_MS in the past.
  const delayedUpdateTime = firstServerTimestamp + (now - gameStart) - RENDER_DELAY_MS;
  let delayedIdx = -1;
  for (let i = gameUpdates.length-1; i >= 0; i--) {
    if (gameUpdates[i].t <= delayedUpdateTime) {
      delayedIdx = i;
      break;
    }
  }
  if (delayedIdx !== -1) {
    // Remove all older updates, leaving at least one.
    gameUpdates.splice(0, delayedIdx);
  }

  let entities: {
    others: Player[];
    bombs: Bomb[];
    blocks: (Block | undefined)[][];
  };
  if (gameUpdates.length === 1) {
    // Only one server update, so we can't interpolate.
    entities = {
      others: gameUpdates[0].others,
      bombs: gameUpdates[0].bombs,
      blocks: gameUpdates[0].blocks,
    };
  } else {
    // More than one update, interpolate between them.
    const baseUpdate = gameUpdates[0];
    const nextUpdate = gameUpdates[1];
    const ratio = (delayedUpdateTime - baseUpdate.t) / (nextUpdate.t - baseUpdate.t);

    entities = {
      others: interpolatePlayers(baseUpdate.others, nextUpdate.others, ratio),
      bombs: interpolateBombs(baseUpdate.bombs, nextUpdate.bombs, ratio),
      blocks: baseUpdate.blocks,
    }
  }

  const latestServerUpdate = gameUpdates[gameUpdates.length - 1];

  // Update the player location.
  // Copy the latest server update so we can modify the player.
  let player: SequencedPlayer = {
    sequence: latestServerUpdate.me.sequence,
    id: latestServerUpdate.me.id,
    x: latestServerUpdate.me.x,
    y: latestServerUpdate.me.y,
  };

  const prevPlayerCoord = previousPlayerCoord[player.sequence];
  if (prevPlayerCoord) {
    const dist = distanceTo(prevPlayerCoord, player);
    // If the player is not moving and they're pretty close to their
    // server location, don't move them.
    if (!isMoving && dist < STILL_PLAYER_SHOULD_TELEPORT_DISTANCE) {
      player.x = prevPlayerCoord.x;
      player.y = prevPlayerCoord.y;
    } else if (dist < MOVING_PLAYER_SHOULD_TELEPORT_DISTANCE) {
      // Move player a fraction of the way to the server location.
      const serverCoord = {x: player.x, y: player.y};
      player.x = prevPlayerCoord.x;
      player.y = prevPlayerCoord.y;
      player = interpolateMe(player, serverCoord, getPlayerInterpolationRatio());
      previousPlayerCoord[player.sequence] = {x: player.x, y: player.y};
    }
  }

  let mostUpToDateLocalMoveIndex = applyLocalMoves(player, entities.blocks);

  // Remove all states up to the most recent local move.
  if (mostUpToDateLocalMoveIndex !== undefined) {
    localMoves.splice(0, mostUpToDateLocalMoveIndex+1);
  }

  if (shouldPrintClientServerPositionAndToggle()) {
    console.log("CLIENT:", player);
    console.log("SERVER:", latestServerUpdate.me);
  }

  return {
    me: player,
    debugServerMe: latestServerUpdate.me,
    ...entities,
  };
}

function applyLocalMoves(player: SequencedPlayer, blocks: (Block | undefined)[][]): number | undefined {
  let mostUpToDateLocalMoveIndex: number | undefined;
  for (let i = 0; i < localMoves.length; i++) {
    const sm = localMoves[i];
    if (sm.sequence < player.sequence) {
      delete previousPlayerCoord[sm.sequence];
      continue;
    }
    if (sm.sequence === player.sequence) {
      previousPlayerCoord[sm.sequence] = {x: player.x, y: player.y};
      mostUpToDateLocalMoveIndex = i;
      continue;
    }
    movePlayer(player, sm.dt, sm.move, blocks);
    previousPlayerCoord[sm.sequence] = {x: player.x, y: player.y};
  }
  return mostUpToDateLocalMoveIndex;
}

function interpolateMe(baseMe: SequencedPlayer, nextCoord: Coord, ratio: number): SequencedPlayer {
  const p = interpolatePlayer(baseMe, nextCoord, ratio);
  return {
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
