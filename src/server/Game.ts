import { Socket } from 'socket.io';
import { SequencedMove, Player, Bomb, Block, Explosion, PowerupType, Powerup } from '../shared/types';
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

function serializedBlocks(blocks: (ServerBlock | undefined)[][]): (Block | undefined)[][] {
  const bs: (Block | undefined)[][] = [];
  for (const row of blocks) {
    const serializedrow: (Block | undefined)[] = [];
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

export default class Game {
  sockets: {[id: string]: Socket};
  players: {[id: string]: ServerPlayer};
  bombs: ServerBomb[];
  lastUpdateTime: number;
  tick: number;
  updateOnTick: number;
  delta: number;

  forceUpdate: boolean;

  // 2D grid. First index is row, second is col.
  blocks: (ServerBlock | undefined)[][];
  powerups: ServerPowerup[];
  gamestate: 'waiting' | 'playing';
  // waitingToPlay is an object that maps socket ids to usernames.
  waitingToPlay: {[id: string]: string};
  playingToWaitingTime?: number;
  winningMessage: string;
  waitingToPlayingTime?: number;

  constructor() {
    this.sockets = {};
    this.players = {};
    this.bombs = [];
    this.lastUpdateTime = -1;
    this.tick = 0;
    this.updateOnTick = 6;
    this.forceUpdate = false;
    this.delta = 0;
    this.blocks = [];
    this.powerups = [];
    this.gamestate = 'waiting';
    this.waitingToPlay = {};
    this.winningMessage = "";
  }

  initializeGame() {
    this.powerups = [];
    this.bombs = [];
    // Create blocks grid.
    this.blocks = [];
    for (let i = 0; i < MAP_SIZE/TILE_SIZE; i++) {
      const inner: (ServerBlock|undefined)[] = [];
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

    this.lastUpdateTime = performance.now();
    this.gamestate = 'waiting';
  }

  startUpdate() {
    this.initializeGame();
    this.update();
  }

  addSpectator(socket: Socket) {
    console.log("Add spectator", socket.id);
    this.sockets[socket.id] = socket;
  }

  removeSocket(socket: Socket) {
    console.log("Remove socket", socket.id);
    this.removePlayer(socket);
    delete this.sockets[socket.id];
    delete this.waitingToPlay[socket.id];
  }

  addPlayer(socket: Socket, username: string) {
    console.log("Add player", socket.id, username);
    this.sockets[socket.id] = socket;
    this.waitingToPlay[socket.id] = username;
  }

  initializePlayer(id: string, username: string) {
    console.log("Initializing player", id, username);
    let found = false
    while (!found) {
      const {row, col} = randomTile();
      if (this.blocks[row][col]) {
        continue;
      }
      const loc = tileToCoord({row: row, col: col});

      this.players[id] = new ServerPlayer(id, username, loc.x, loc.y);
      break;
    }

    this.forceUpdate = true;
  }

  removePlayer(socket: Socket) {
    if (this.players[socket.id]) {
      console.log("Remove player", socket.id, this.players[socket.id].username);
      sendGameOver(this.sockets[socket.id]);
      delete this.players[socket.id];
    }
    if (Object.keys(this.players).length === 0) {
      // Reset game.
      this.initializeGame();
    }
  }

  handleInput(socket: Socket, input: SequencedMove[]) {
    const player = this.players[socket.id];
    if (!player) {
      return;
    }
    this.players[socket.id].addSequencedMoves(input);
  }

  playingUpdate(now: number) {
    this.delta += now - this.lastUpdateTime;
    const explosions: Explosion[] = [];
    let numUpdateTicks = 0;
    while (this.delta >= UPDATE_TICK_LENGTH_MS) {
      numUpdateTicks++;
      const dt = UPDATE_TICK_LENGTH_MS / 1000;
      for (let socketid in this.sockets) {
        const player = this.players[socketid];
        if (!player) {
          continue;
        }
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
    if (this.forceUpdate ||
        this.tick % this.updateOnTick === 0) {
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

      for (let socketid in this.sockets) {
        const socket = this.sockets[socketid];

        const others: Player[] = [];
        for (const id in this.players) {
          if (id === socketid) {
            continue;
          }
          others.push(this.players[id].serialize());
        }

        let waitingMessage: string | undefined;
        if (this.playingToWaitingTime !== undefined) {
          waitingMessage = this.winningMessage;
          if (now > this.playingToWaitingTime) {
            for (const id in this.players) {
              this.removePlayer(this.sockets[id]);
            }
            this.playingToWaitingTime = undefined;
            this.gamestate = 'waiting';
          }
        } else if (Object.keys(this.players).length === 1) {
          // The only player left has won.
          let winningid: string | undefined;
          for (let id in this.players) {
            winningid = id;
            break;
          }
          this.winningMessage = this.players[winningid!].username + " won!";
          waitingMessage = this.winningMessage;
          console.log(this.winningMessage);
          this.playingToWaitingTime = now + WON_TO_WAITING_STATE_DELAY_MS;
        } else if (socketid in this.waitingToPlay) {
          waitingMessage = "Waiting for game to finish.";
        }

        let mode: 'playing' | 'waiting' | undefined;
        if (this.playingToWaitingTime !== undefined) {
          mode = 'waiting';
        } else if (socketid in this.players) {
          mode = 'playing';
        } else {
          mode = 'waiting';
        }

        sendGameUpdate(socket, {
          t: now,
          tickRate: Math.round(60/numUpdateTicks),
          waitingMessage: waitingMessage,
          mode: mode!,
          me: (socketid in this.players) ?
            this.players[socketid].serialize() : undefined,
          others: others,
          bombs: bombs,
          blocks: blocks,
          explosions: explosions,
          powerups: powerups,
        });
      }

      // Clean up entities.
      for (const id in this.players) {
        const p = this.players[id];
        if (p.alive) {
          continue;
        }
        // The player is dead.
        this.removePlayer(this.sockets[id]);
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
  }

  waitingUpdate(now: number) {
    const blocks = serializedBlocks(this.blocks);
    const playersNeededToStart = 3;
    const numWaitingToPlay = Object.keys(this.waitingToPlay).length;
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

    for (const id in this.sockets) {
      sendGameUpdate(this.sockets[id], {
        t: now,
        tickRate: 60,
        waitingMessage: waitingMessage,
        mode: 'waiting',
        me: undefined,
        others: [],
        bombs: [],
        blocks: blocks,
        explosions: [],
        powerups: [],
      });
    }
    if (this.waitingToPlayingTime !== undefined && now > this.waitingToPlayingTime) {
      this.gamestate = 'playing';
      for (const id in this.waitingToPlay) {
        this.initializePlayer(id, this.waitingToPlay[id]);
      }
      this.waitingToPlay = {};
    }
  }

  update() {
    const now = performance.now();
    if (this.lastUpdateTime === -1) {
      throw Error("startUpdate() must be run before update()");
    }
    if (this.lastUpdateTime + UPDATE_TICK_LENGTH_MS <= now) {

      if (this.gamestate === 'playing') {
        this.playingUpdate(now);
      } else if (this.gamestate === 'waiting') {
        this.waitingUpdate(now);
      } else {
        throw Error("Unknown gamestate: " + this.gamestate);
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
