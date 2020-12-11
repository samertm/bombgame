import { Update, State, SequencedDtMove, SequencedMove } from '../shared/types';
import { movePlayer } from '../shared/player';


// const RENDER_DELAY = 5;

const gameUpdates: Update[] = [];
// let gameStart = 0;
let firstServerTimestamp = 0;

export function initState() {
  // gameStart = 0;
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
      },
    });
  }
}

let latestServerUpdate: Update | undefined;

const TEST = false;

export function processGameUpdates(updates: Update[]) {
  if (updates.length === 0) {
    return;
  }

  // Only keep latest server update for now.
  if (TEST) {
    if (latestServerUpdate) {
      return;
    }
  }
  latestServerUpdate = updates[updates.length - 1];
}

const CHOPPY = false;

export function getState(now: number): State | undefined {
  if (!latestServerUpdate) {
    return;
  }

  // Update the player location.
  if (CHOPPY) {
    return latestServerUpdate;
  }

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

  return {
    me: player,
  }
}

// export function processGameUpdates(updates: Update[]) {
//   if (!firstServerTimestamp) {
//     firstServerTimestamp = update.t;
//     gameStart = Date.now();
//   }
//   gameUpdates.push(update);

//   // Keep only one game update before the current server time.
//   const base = getBaseUpdate();
//   if (base > 0) {
//     gameUpdates.splice(0, base);
//   }
// }

// function currentServerTime() {
//   return firstServerTimestamp + (Date.now() - gameStart) - RENDER_DELAY;
// }

// // Returns the index of the base update, the first game update before
// // current server time, or -1 if n/a.
// function getBaseUpdate() {
//   const serverTime = currentServerTime();
//   for (let i = gameUpdates.length - 1; i >= 0; i--) {
//     if (gameUpdates[i].t <= serverTime) {
//       return i;
//     }
//   }
//   return -1;
// }

// Returns { me, others, bullets }
export function getCurrentState(): State | undefined {
  if (!firstServerTimestamp) {
    return;
  }

  //const base = getBaseUpdate();
  //const serverTime = currentServerTime();

  return gameUpdates[gameUpdates.length - 1];
  // If base is the most recent update we have, use its state.
  // Else, interpolate between its state and the state of (base + 1).
  // if (base < 0 || base === gameUpdates.length - 1) {
  //   return gameUpdates[gameUpdates.length - 1];
  // } else {
  //   const baseUpdate = gameUpdates[base];
  //   const next = gameUpdates[base + 1];
  //   const ratio = (serverTime - baseUpdate.t) / (next.t - baseUpdate.t);
  //   return {
  //     me: interpolateObject(baseUpdate.me, next.me, ratio),
  //   }
  // }
}

// function interpolateObject(object1: Player, object2: Player, ratio: number): Player {
//   if (!object2) {
//     return object1;
//   }

//   const interpolated: Player = {id: '', x: 0, y: 0};
//   for (let key in object1) {
//     if (key === 'x') {
//       interpolated.x = object1.x + (object2.x - object1.x) * ratio;
//     } else if (key === 'y') {
//       interpolated.y = object1.y + (object2.y - object1.y) * ratio;
//     } else {
//       (interpolated as any)[key] = (object1 as any)[key]
//     }
//   }
//   return interpolated;
// }
