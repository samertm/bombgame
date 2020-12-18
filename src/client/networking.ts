import io, { Socket } from 'socket.io-client';
import { SequencedMove, Update } from '../shared/types';
import { MSG_TYPES } from '../shared/constants';

const socketProtocol = (window.location.protocol.includes('https')) ? 'wss' : 'ws';

export function connect(onUpdate: (update: Update) => void, onGameOver: () => void): Promise<typeof Socket> {
  const socket = io(`${socketProtocol}://${window.location.host}`, {reconnection: false});
  return new Promise<void>(resolve => {
    socket.on('connect', () => {
      console.log('Connected to server!');
      resolve();
    });
  }).then(() => {
    addUpdateListener(socket, onUpdate);
    addGameOverListener(socket, onGameOver);
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      document.getElementById('disconnect-modal')!.classList.remove('hidden');
      document.getElementById('reconnect-button')!.onclick = () => {
        window.location.reload();
      };
    });
    return socket;
  });
};

function addUpdateListener(socket: typeof Socket, onUpdate: (update: Update) => void) {
  socket.on(MSG_TYPES.GAME_UPDATE, onUpdate);
}

function addGameOverListener(socket: typeof Socket, onGameOver: () => void) {
  socket.on(MSG_TYPES.GAME_OVER, onGameOver);
}

export function sendViewGame(socket: typeof Socket) {
  socket.emit(MSG_TYPES.VIEW_GAME);
}

export function sendJoinGame(socket: typeof Socket, username: string) {
  socket.emit(MSG_TYPES.JOIN_GAME, username);
}

export function sendInput(socket: typeof Socket, input: SequencedMove[]) {
  socket.emit(MSG_TYPES.INPUT, input);
}
