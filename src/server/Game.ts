import { Socket } from 'socket.io';
import { SequencedMove, Player, Bomb } from '../shared/types';
import { MAP_SIZE } from '../shared/constants';
import ServerPlayer from './ServerPlayer';
import ServerBomb from './ServerBomb';
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

  constructor() {
    this.sockets = {};
    this.players = {};
    this.bombs = [];
    this.lastUpdateTime = performance.now();
    this.tick = 0;
    this.updateOnTick = 6;
  }

  startUpdate() {
    this.update();
  }

  addPlayer(socket: Socket, username: string) {
    this.sockets[socket.id] = socket;

    const x = MAP_SIZE * (0.25 + Math.random() * 0.5);
    const y = MAP_SIZE * (0.25 + Math.random() * 0.5);
    this.players[socket.id] = new ServerPlayer(socket.id, username, x, y);
  }

  removePlayer(socket: Socket) {
    delete this.sockets[socket.id];
    delete this.players[socket.id];
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
        const bombs = player.update(dt, now);
        for (const b of bombs) {
          this.bombs.push(b);
        }
      }

      for (const bomb of this.bombs) {
        bomb.update(now, this.players);
      }

      // Send update every other tick.
      if (this.tick % this.updateOnTick === 0) {
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

          const bombs: Bomb[] = [];
          for (const b of this.bombs) {
            bombs.push(b.serialize());
          }

          sendGameUpdate(socket, {
            t: now,
            me: player.serialize(),
            others: others,
            bombs: bombs,
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
