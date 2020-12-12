import { Update, State, SequencedDtMove, SequencedMove, Coords, Player, Bomb } from '../shared/types';
import { movePlayer } from '../shared/player';


const RENDER_DELAY_MS = 100;

const gameUpdates: Update[] = [];
let gameStart = 0;
let firstServerTimestamp = 0;

export function initState() {
  gameStart = 0;
  firstServerTimestamp = 0;
}

let localMoves: SequencedDtMove[] = [];

export function processLocalMoves(dt: number, smoves: SequencedMove[]) {
  for (const sm of smoves) {
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

export function getState(now: number): State | undefined {
  if (gameUpdates.length === 0) {
    return;
  }

  const latestServerUpdate = gameUpdates[gameUpdates.length - 1];

  // Update the player location.
  // Copy the latest server update so we can modify the player.
  const player = {
    sequence: latestServerUpdate.me.sequence,
    id: latestServerUpdate.me.id,
    x: latestServerUpdate.me.x,
    y: latestServerUpdate.me.y,
  };

  let mostUpToDateLocalMoveIndex: number | undefined;
  for (let i = 0; i < localMoves.length; i++) {
    const sm = localMoves[i];
    if (sm.sequence < player.sequence) {
      continue;
    }
    if (sm.sequence === player.sequence) {
      mostUpToDateLocalMoveIndex = i;
      continue;
    }
    movePlayer(player, sm.dt, sm.move);
  }

  // Remove all states up to the most recent local move.
  if (mostUpToDateLocalMoveIndex !== undefined) {
    localMoves.splice(0, mostUpToDateLocalMoveIndex+1);
  }

  // Get the other entities RENDER_DELAY_MS in the past.
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

  if (gameUpdates.length === 1) {
    // Only one server update, so we can't interpolate.
    return {
      me: player,
      others: gameUpdates[0].others,
      bombs: gameUpdates[0].bombs,
    };
  }
  // More than one update, interpolate between them.
  const baseUpdate = gameUpdates[0];
  const nextUpdate = gameUpdates[1];
  const ratio = (delayedUpdateTime - baseUpdate.t) / (nextUpdate.t - baseUpdate.t);

  return {
    me: player,
    others: interpolatePlayers(baseUpdate.others, nextUpdate.others, ratio),
    bombs: interpolateBombs(baseUpdate.bombs, nextUpdate.bombs, ratio),
  }
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

function interpolatePlayer(basePlayer: Player, nextPlayer: Player | undefined, ratio: number): Player {
  if (!nextPlayer) {
    return basePlayer;
  }

  const { x, y } = interpolateCoords(basePlayer, nextPlayer, ratio);
  return {
    id: basePlayer.id,
    x: x,
    y: y,
  };
}

function interpolateCoords(c1: Coords, c2: Coords, ratio: number): Coords {
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

  const { x, y } = interpolateCoords(baseBomb, nextBomb, ratio);
  return {
    id: baseBomb.id,
    x: x,
    y: y,
    exploded: baseBomb.exploded,
  };
}
