import { Socket } from 'socket.io';
import { SequencedMove } from '../shared/types';
const constants = require('../shared/constants');
import ServerPlayer from './ServerPlayer';

var tickLengthMs = 1000 / 60;

var previousTick = Date.now();

export default class Game {
  sockets: {[id: string]: Socket};
  players: {[id: string]: ServerPlayer};
  lastUpdateTime: number;

  constructor() {
    this.sockets = {};
    this.players = {};
    this.lastUpdateTime = Date.now();
  }

  startUpdate() {
    this.update();
  }

  addPlayer(socket: Socket, username: string) {
    this.sockets[socket.id] = socket;

    const x = constants.MAP_SIZE * (0.25 + Math.random() * 0.5);
    const y = constants.MAP_SIZE * (0.25 + Math.random() * 0.5);
    this.players[socket.id] = new ServerPlayer(socket.id, username, x, y);
  }

  handleInput(socket: Socket, input: SequencedMove[]) {
    const player = this.players[socket.id];
    if (!player) {
      return;
    }
    this.players[socket.id].addSequencedMoves(input);
  }

  update() {
    const now = Date.now();
    if (previousTick + tickLengthMs <= now) {
      const dt = (now - this.lastUpdateTime) / 1000;
      previousTick = now;

      this.lastUpdateTime = now;

      for (let socketid in this.sockets) {
        const player = this.players[socketid];
        player.update(dt);
      }

      for (let socketid in this.sockets) {
        const socket = this.sockets[socketid];
        const player = this.players[socketid];

        const data = this.createUpdate(now, player)
        socket.emit(constants.MSG_TYPES.GAME_UPDATE, data);
      }
    }

    if (Date.now() - previousTick < tickLengthMs - 16) {
      setTimeout(this.update.bind(this));
    } else {
      setImmediate(this.update.bind(this));
    }
  }

  createUpdate(now: number, player: ServerPlayer) {
    return {
      t: now,
      me: player.serialize(),
      others: [],
      bullet: [],
    };
  }
}
