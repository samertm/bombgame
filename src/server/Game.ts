import { Socket } from 'socket.io';
import { SequencedMove, Player, Bomb, BlockRow, BlockGrid, Explosion, PowerupType, Powerup, Update } from '../shared/types';
import { tileToCoord, randomTile } from '../shared/collisions';
import { MAP_SIZE, TILE_SIZE, UPDATE_TICK_LENGTH_MS, POWERUP_ODDS } from '../shared/constants';
import ServerPlayer from './ServerPlayer';
import ServerBomb from './ServerBomb';
import ServerBlock from './ServerBlock';
import ServerPowerup from './ServerPowerup';
import { performance } from 'perf_hooks';
import {
  sendGameUpdate,
  sendGameOver,
} from './networking';

const WON_TO_WAITING_STATE_DELAY_MS = 5000;
const WAITING_TO_PLAYING_STATE_DELAY_MS = 5000;

const UPDATE_ON_TICK = 6;

type ServerBlockRow = (ServerBlock | undefined)[];
// 2D grid. First index is row, second is col.
type ServerBlockGrid = ServerBlockRow[];

function serializedBlocks(blocks: ServerBlockGrid): BlockGrid {
  const bs: BlockGrid = [];
  for (const row of blocks) {
    const serializedrow: BlockRow = [];
    for (const block of row) {
      if (block) {
        serializedrow.push(block.serialize());
      } else {
        serializedrow.push(undefined);
      }
    }
    bs.push(serializedrow);
  }
  return bs;
}

interface PlayerInfo {
  username: string;
  socket: Socket;
  joinGame: boolean;
}

interface GameState {
  addPlayer(info: PlayerInfo): void;
  removePlayer(socket: Socket): void;
  handleInput(socket: Socket, input: SequencedMove[]): void;
  update(
    now: number,
    lastUpdateTime: number,
    shouldSendUpdate: boolean,
  ): GameState | undefined;
}


class DoneState implements GameState {
  finalUpdate: Update;
  spectators: {[id: string]: PlayerInfo};
  transitionTime: number;
  forceUpdate: boolean;

  constructor(
    now: number,
    finalUpdate: Update,
    players: {[id: string]: ServerPlayer},
    spectators: {[id: string]: PlayerInfo},
  ) {
    this.transitionTime = now + WON_TO_WAITING_STATE_DELAY_MS;
    this.finalUpdate = finalUpdate;
    this.forceUpdate = true;
    this.spectators = spectators;

    let message = "Game Over";
    let numAlive = 0;
    for (let id in players) {
      if (players[id].alive) {
        numAlive++;
        if (numAlive > 1) {
          message = "Game Over";
        } else {
          message = players[id].username + " Won!"
        }
      }

      this.spectators[id] = {
        username: players[id].username,
        socket: players[id].socket,
        joinGame: true,
      };
    }
    this.finalUpdate.waitingMessage = message;
  }

  addPlayer(info: PlayerInfo) {
    this.spectators[info.socket.id] = info;
    this.forceUpdate = true;
  }

  removePlayer(socket: Socket) {
    delete this.spectators[socket.id];
  }

  handleInput(socket: Socket, input: SequencedMove[]) {}

  update(now: number, lastUpdateTime: number, shouldSendUpdate: boolean): GameState | undefined {
    if (this.forceUpdate || shouldSendUpdate) {
      this.forceUpdate = false;
      this.finalUpdate.t = now;
      for (const id in this.spectators) {
        sendGameUpdate(this.spectators[id].socket, this.finalUpdate);
      }
    }
    if (now >= this.transitionTime) {
      return new WaitingState(this.spectators);
    }
    return;
  }
}

class PlayingState implements GameState {
  players: {[id: string]: ServerPlayer};
  spectators: {[id: string]: PlayerInfo};
  forceUpdate: boolean;
  delta: number;

  bombs: ServerBomb[];
  blocks: ServerBlockGrid;
  powerups: ServerPowerup[];
  playingToWaitingTime?: number;

  constructor(
    initialPlayers: {[id: string]: PlayerInfo},
    blocks: ServerBlockGrid,
  ) {
    this.players = {};
    this.delta = 0;
    this.spectators = {};
    this.powerups = [];
    this.bombs = [];
    this.blocks = blocks;
    this.forceUpdate = false;

    for (const id in initialPlayers) {
      const info = initialPlayers[id];
      if (!info.joinGame) {
        this.spectators[id] = info;
        continue;
      }
      console.log("Initializing player", id, info.username);

      let found = false;
      while (!found) {
        const {row, col} = randomTile();
        if (this.blocks[row][col]) {
          continue;
        }
        const loc = tileToCoord({row: row, col: col});

        this.players[id] = new ServerPlayer(info.socket, id, info.username, loc.x, loc.y);
        break;
      }
    }
  }

  addPlayer(info: PlayerInfo) {
    // This should never happen, check just in case.
    if (info.socket.id in this.players) {
      console.error("ATTEMPTED TO ADD SPECTATOR THAT IS ALREADY IN THE GAME");
      return;
    }
    this.spectators[info.socket.id] = info;
  }

  removePlayer(socket: Socket) {
    if (socket.id in this.players) {
      sendGameOver(this.players[socket.id].socket);
      delete this.players[socket.id];
    } else if (socket.id in this.spectators) {
      delete this.spectators[socket.id];
    }
  }

  handleInput(socket: Socket, input: SequencedMove[]) {
    const player = this.players[socket.id];
    if (!player) {
      return;
    }
    this.players[socket.id].addSequencedMoves(input);
  }

  sendUpdate(
    socket: Socket,
    now: number,
    numUpdateTicks: number,
    bombs: Bomb[],
    blocks: BlockGrid,
    explosions: Explosion[],
    powerups: Powerup[],
  ) {
    const others: Player[] = [];
    for (const id in this.players) {
      if (id === socket.id) {
        continue;
      }
      others.push(this.players[id].serialize());
    }

    let waitingMessage: string | undefined;
    if (socket.id in this.spectators) {
      waitingMessage = "Waiting for game to finish.";
    }

    sendGameUpdate(socket, {
      t: now,
      tickRate: Math.round(60/numUpdateTicks),
      waitingMessage: waitingMessage,
      me: (socket.id in this.players) ?
        this.players[socket.id].serialize() : undefined,
      others: others,
      bombs: bombs,
      blocks: blocks,
      explosions: explosions,
      powerups: powerups,
    });
  }

  update(now: number, lastUpdateTime: number, shouldSendUpdate: boolean): GameState | undefined {
    this.delta += now - lastUpdateTime;
    const explosions: Explosion[] = [];
    let numUpdateTicks = 0;
    while (this.delta >= UPDATE_TICK_LENGTH_MS) {
      numUpdateTicks++;
      const dt = UPDATE_TICK_LENGTH_MS / 1000;
      for (let socketid in this.players) {
        const player = this.players[socketid];
        const bombs = player.update(dt, now, this.blocks, this.bombs, this.powerups);
        for (const b of bombs) {
          this.bombs.push(b);
          this.forceUpdate = true;
        }
      }

      for (const bomb of this.bombs) {
        const result = bomb.update(
          now, this.players, this.bombs, this.blocks, this.powerups);
        if (!result) {
          continue;
        }
        const {explosion, powerups} = result;
        if (explosion) {
          this.forceUpdate = true;
          explosions.push(explosion);
        }
        if (powerups) {
          for (const p of powerups) {
            this.powerups.push(p);
          }
        }
      }

      this.delta -= UPDATE_TICK_LENGTH_MS;
    }

    // Send update
    if (this.forceUpdate || shouldSendUpdate) {
      this.forceUpdate = false;

      const bombs: Bomb[] = [];
      for (const b of this.bombs) {
        bombs.push(b.serialize());
      }

      const blocks = serializedBlocks(this.blocks);

      const powerups: Powerup[] = [];
      for (const p of this.powerups) {
        powerups.push(p.serialize());
      }

      // Check to see if anyone has won.
      let numAlive = 0;
      for (const id in this.players) {
        if (this.players[id].alive) {
          numAlive++;
        }
      }

      if (numAlive <= 1) {
        const others: Player[] = [];
        for (const id in this.players) {
          others.push(this.players[id].serialize());
        }
        const finalUpdate: Update = {
          t: now,
          tickRate: Math.round(60/numUpdateTicks),
          others: others,
          bombs: bombs,
          blocks: blocks,
          explosions: explosions,
          powerups: powerups,
        };
        return new DoneState(now, finalUpdate, this.players, this.spectators);
      }

      for (const socketid in this.players) {
        this.sendUpdate(
          this.players[socketid].socket,
          now,
          numUpdateTicks,
          bombs,
          blocks,
          explosions,
          powerups,
        );
      }
      for (const socketid in this.spectators) {
        this.sendUpdate(
          this.spectators[socketid].socket,
          now,
          numUpdateTicks,
          bombs,
          blocks,
          explosions,
          powerups,
        );
      }

      // Clean up entities.
      for (const id in this.players) {
        const p = this.players[id];
        if (p.alive) {
          continue;
        }
        // The player is dead, turn them into a spectator.
        this.removePlayer(p.socket);
        this.addPlayer({
          username: p.username,
          socket: p.socket,
          joinGame: true,
        });
      }

      const liveBombs = [];
      for (const b of this.bombs) {
        if (!b.exploded) {
          liveBombs.push(b);
        }
      }
      this.bombs = liveBombs;

      for (let i = 0; i < this.blocks.length; i++) {
        for (let j = 0; j < this.blocks[i].length; j++) {
          const block = this.blocks[i][j];
          if (block && block.destroyed) {
            this.blocks[i][j] = undefined;
          }
        }
      }

      const livePowerups = [];
      for (const p of this.powerups) {
        if (!p.destroyed && !p.used) {
          livePowerups.push(p);
        }
      }
      this.powerups = livePowerups;
    }
    return;
  }
}

class WaitingState implements GameState {
  blocks: ServerBlockGrid;
  spectators: {[id: string]: PlayerInfo};
  waitingToPlayingTime?: number;
  forceUpdate: boolean;

  constructor(spectators: {[id: string]: PlayerInfo}) {
    this.spectators = spectators;
    this.forceUpdate = false;

    // Create blocks grid.
    this.blocks = [];
    for (let i = 0; i < MAP_SIZE/TILE_SIZE; i++) {
      const inner: ServerBlockRow = [];
      inner.length = MAP_SIZE/TILE_SIZE;
      this.blocks.push(inner);
    }

    // Place indestructable blocks
    let skiprow = false;
    for (let i = 1; i < MAP_SIZE / TILE_SIZE - 1; i++) {
      if (skiprow) {
        skiprow = !skiprow;
        continue;
      }
      skiprow = !skiprow;
      let skipcol = false;
      for (let j = 1; j < MAP_SIZE / TILE_SIZE - 1; j++) {
        if (skipcol) {
          skipcol = !skipcol;
          continue;
        }
        skipcol = !skipcol;
        const loc = tileToCoord({col: j, row: i});
        this.blocks[i][j] = new ServerBlock(
          loc.x,
          loc.y,
          false,
        );
      }
    }

    // Now place destructable blocks randomly.
    const numDestructableBlocks = 75;
    let placed = 0;
    while (placed < numDestructableBlocks) {
      const t = randomTile();
      if (this.blocks[t.row][t.col]) {
        continue;
      }
      const {x, y} = tileToCoord(t);
      let powerupType: PowerupType | undefined;
      if (Math.random() > POWERUP_ODDS) {
        if (Math.random() > 0.5) {
          powerupType = 'bombsize';
        } else {
          powerupType = 'numbombs';
        }
      }
      this.blocks[t.row][t.col] = new ServerBlock(x, y, true, powerupType);
      placed++;
    }
  }

  addPlayer(info: PlayerInfo) {
    this.spectators[info.socket.id] = info;
  }

  removePlayer(socket: Socket) {
    delete this.spectators[socket.id];
  }

  handleInput(socket: Socket, input: SequencedMove[]) {
  }

  update(now: number, lastUpdateTime: number, shouldSendUpdate: boolean): GameState | undefined {
    if (!this.forceUpdate && !shouldSendUpdate) {
      return;
    }
    this.forceUpdate = false;

    const blocks = serializedBlocks(this.blocks);
    const playersNeededToStart = 3;
    let numWaitingToPlay = 0;
    for (let id in this.spectators) {
      if (this.spectators[id].joinGame) {
        numWaitingToPlay++;
      }
    }
    let waitingMessage = "";
    if (numWaitingToPlay < playersNeededToStart) {
      this.waitingToPlayingTime = undefined;
      waitingMessage = "Waiting for players to start. Players needed: " + Math.max(
        playersNeededToStart - numWaitingToPlay, 0);
    } else {
      if (this.waitingToPlayingTime === undefined) {
        this.waitingToPlayingTime = now + WAITING_TO_PLAYING_STATE_DELAY_MS;
      }
      waitingMessage = "Starting in: " + Math.max(
        Math.round((this.waitingToPlayingTime - now) / 1000), 0);
    }

    for (const id in this.spectators) {
      sendGameUpdate(this.spectators[id].socket, {
        t: now,
        tickRate: 60,
        waitingMessage: waitingMessage,
        me: undefined,
        others: [],
        bombs: [],
        blocks: blocks,
        explosions: [],
        powerups: [],
      });
    }
    if (this.waitingToPlayingTime !== undefined && now > this.waitingToPlayingTime) {
      return new PlayingState(this.spectators, this.blocks);
    }
    return;
  }
}

export default class Game {
  sockets: {[id: string]: Socket};
  state: GameState;
  lastUpdateTime: number;
  tick: number;

  constructor() {
    this.sockets = {};
    this.state = new WaitingState({});
    this.lastUpdateTime = -1;
    this.tick = 0;
  }

  startUpdate() {
    this.lastUpdateTime = performance.now();
    this.update();
  }

  addSpectator(socket: Socket) {
    console.log("Add spectator", socket.id);
    this.sockets[socket.id] = socket;
    this.state.addPlayer({
      username: "",
      socket: socket,
      joinGame: false,
    });
  }

  removeSocket(socket: Socket) {
    console.log("Remove socket", socket.id);
    this.state.removePlayer(socket);
    delete this.sockets[socket.id];
  }

  addPlayer(socket: Socket, username: string) {
    console.log("Add player", socket.id, username);
    this.sockets[socket.id] = socket;
    this.state.addPlayer({
      username: username,
      socket: socket,
      joinGame: true,
    });
  }

  handleInput(socket: Socket, input: SequencedMove[]) {
    this.state.handleInput(socket, input);
  }

  update() {
    const now = performance.now();
    if (this.lastUpdateTime === -1) {
      throw Error("startUpdate() must be run before update()");
    }
    if (this.lastUpdateTime + UPDATE_TICK_LENGTH_MS <= now) {

      const shouldSendUpdate = this.tick % UPDATE_ON_TICK === 0;

      const nextState = this.state.update(now, this.lastUpdateTime, shouldSendUpdate);

      if (nextState) {
        this.state = nextState;
      }

      this.lastUpdateTime = now;
      this.tick++;
    }

    if (performance.now() - this.lastUpdateTime < UPDATE_TICK_LENGTH_MS - 16) {
      setTimeout(this.update.bind(this));
    } else {
      setImmediate(this.update.bind(this));
    }
  }
}
