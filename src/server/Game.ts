import { Socket } from 'socket.io';
import { SequencedMove, Player, Bomb, Block } from '../shared/types';
import { tileToCoord } from '../shared/collisions';
import { MAP_SIZE, TILE_SIZE } from '../shared/constants';
import ServerPlayer from './ServerPlayer';
import ServerBomb from './ServerBomb';
import ServerBlock from './ServerBlock';
import { performance } from 'perf_hooks';
import {
  sendGameUpdate,
  sendGameOver,
} from './networking';

const tickLengthMs = 1000 / 60;

export default class Game {
  sockets: {[id: string]: Socket};
  players: {[id: string]: ServerPlayer};
  bombs: ServerBomb[];
  lastUpdateTime: number;
  tick: number;
  updateOnTick: number;

  forceUpdate: boolean;

  // 2D grid. First index is col, second is row.
  blocks: (ServerBlock | undefined)[][];

  constructor() {
    this.sockets = {};
    this.players = {};
    this.bombs = [];
    this.lastUpdateTime = performance.now();
    this.tick = 0;
    this.updateOnTick = 6;
    this.forceUpdate = false;

    // Create blocks grid.
    this.blocks = [];
    for (let i = 0; i < MAP_SIZE/TILE_SIZE; i++) {
      const inner: (ServerBlock|undefined)[] = [];
      inner.length = MAP_SIZE/TILE_SIZE;
      this.blocks.push(inner);
    }
  }

  initializeGame() {
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
  }

  startUpdate() {
    this.initializeGame();
    this.update();
  }

  addPlayer(socket: Socket, username: string) {
    this.sockets[socket.id] = socket;

    let found = false
    while (!found) {
      const col = Math.trunc(Math.random() * (MAP_SIZE/TILE_SIZE - 1));
      const row = Math.trunc(Math.random() * (MAP_SIZE/TILE_SIZE - 1));
      if (this.blocks[row][col]) {
        continue;
      }
      const loc = tileToCoord({row: row, col: col});

      this.players[socket.id] = new ServerPlayer(socket.id, username, loc.x, loc.y);
      break;
    }

    this.forceUpdate = true;
  }

  removePlayer(socket: Socket) {
    delete this.sockets[socket.id];
    delete this.players[socket.id];
    this.forceUpdate = true;
  }

  handleInput(socket: Socket, input: SequencedMove[]) {
    const player = this.players[socket.id];
    if (!player) {
      return;
    }
    this.players[socket.id].addSequencedMoves(input);
  }

  update() {
    const now = performance.now();
    if (this.lastUpdateTime + tickLengthMs <= now) {
      const dt = (now - this.lastUpdateTime) / 1000;
      this.lastUpdateTime = now;

      for (let socketid in this.sockets) {
        const player = this.players[socketid];
        const bombs = player.update(dt, now, this.blocks, this.bombs);
        for (const b of bombs) {
          this.bombs.push(b);
          this.forceUpdate = true;
        }
      }

      for (const bomb of this.bombs) {
        bomb.update(now, this.players);
      }

      // Send update every other tick.
      if (this.forceUpdate ||
          this.tick % this.updateOnTick === 0) {
        this.forceUpdate = false;

        const bombs: Bomb[] = [];
        for (const b of this.bombs) {
          bombs.push(b.serialize());
        }

        const blocks: (Block | undefined)[][] = [];
        for (const row of this.blocks) {
          const serializedrow: (Block | undefined)[] = [];
          for (const block of row) {
            if (block) {
              serializedrow.push(block.serialize());
            } else {
              serializedrow.push(undefined);
            }
          }
          blocks.push(serializedrow);
        }

        for (let socketid in this.sockets) {
          const socket = this.sockets[socketid];
          const player = this.players[socketid];

          const others: Player[] = [];
          for (const id in this.players) {
            if (id === socketid) {
              continue;
            }
            others.push(this.players[id].serialize());
          }

          sendGameUpdate(socket, {
            t: now,
            tickRate: Math.trunc(1/dt),
            me: player.serialize(),
            others: others,
            bombs: bombs,
            blocks: blocks,
          });
        }

        // Clean up exploded bombs and dead players.
        for (const id in this.players) {
          const p = this.players[id];
          if (p.alive) {
            continue;
          }
          // The player is dead.
          sendGameOver(this.sockets[id]);
          delete this.sockets[id];
          delete this.players[id];
        }

        const liveBombs = [];
        for (const b of this.bombs) {
          if (!b.exploded) {
            liveBombs.push(b);
          }
        }
        this.bombs = liveBombs;
      }
      this.tick++;
    }

    if (performance.now() - this.lastUpdateTime < tickLengthMs - 16) {
      setTimeout(this.update.bind(this));
    } else {
      setImmediate(this.update.bind(this));
    }
  }
}
