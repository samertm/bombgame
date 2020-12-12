import { Socket } from 'socket.io';
import { MSG_TYPES } from '../shared/constants';
import { Update } from '../shared/types';

export function sendGameUpdate(socket: Socket, update: Update) {
  socket.emit(MSG_TYPES.GAME_UPDATE, update);
}

export function sendGameOver(socket: Socket) {
  socket.emit(MSG_TYPES.GAME_OVER);
}
