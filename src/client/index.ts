import { Socket } from 'socket.io-client';
import { connect, sendJoinGame, sendInput } from './networking';
import { downloadAssets } from './assets';
import { renderMainMenu, renderGame } from './render';
import { getAndWipeMoveBuffer, startCapturingInput, stopCapturingInput } from './input';
import { initState, getState, processLocalMoves, processGameUpdates } from './state';
import { Update } from '../shared/types';
import { fpsDiv, latencyDiv, serverTickRateDiv, debugEnabled } from './debug';

import './css/bootstrap-reboot.css';
import './css/main.css';

const playMenu = document.getElementById('play-menu')!;
const playButton = document.getElementById('play-button')!;
const usernameInput = document.getElementById('username-input')! as HTMLInputElement;

let gameState = 'menu';

let receivedUpdates: Update[] = [];

let lastUpdateTime: number = 0;

function main() {
  Promise.all([
    connect(onUpdate, onGameOver),
    downloadAssets(),
  ]).then((args) => {
    const socket: typeof Socket = args[0];

    playMenu.classList.remove('hidden');
    usernameInput.focus();
    startGameLoop(socket);
    playButton.onclick = () => {
      sendJoinGame(socket, usernameInput.value);
      playMenu.classList.add('hidden');
      initState();
      startCapturingInput();
      gameState = 'game';
    };
  }).catch(console.error);
}

let clientSequences: {[sequence: number]: number} = {};

function outerGameLoop(socket: typeof Socket): (ts: number) => void {
  return (ts: DOMHighResTimeStamp) => {
    window.requestAnimationFrame(outerGameLoop(socket));
    if (lastUpdateTime === undefined) {
      lastUpdateTime = ts;
    }
    const dt = (ts - lastUpdateTime) / 1000;
    if (debugEnabled()) {
      fpsDiv.innerText = 'FPS: ' + Math.trunc(1/dt);
    }
    lastUpdateTime = ts;
    if (gameState === 'menu') {
      renderMainMenu();
      return;
    }
    // gameState must equal 'game'.
    const moves = getAndWipeMoveBuffer();
    if (moves.length !== 0) {
      // Send input if moves have been made.
      if (debugEnabled()) {
        for (let move of moves) {
          clientSequences[move.sequence] = ts;
        }
      }
      sendInput(socket, moves);
      processLocalMoves(dt, moves);
    }
    if (receivedUpdates.length !== 0) {
      if (debugEnabled()) {
        serverTickRateDiv.innerText = 'Server Tick Rate: ' + receivedUpdates[receivedUpdates.length-1].tickRate;
        const originalTs = clientSequences[receivedUpdates[receivedUpdates.length - 1].me.sequence];
        if (originalTs !== undefined) {
          latencyDiv.innerText = 'Latency: ' + Math.trunc(ts - originalTs);
          clientSequences = {};
        }
      }
      processGameUpdates(receivedUpdates, ts);
      receivedUpdates = [];
    }

    const state = getState(ts)
    renderGame(state);
  };
}

function startGameLoop(socket: typeof Socket) {
  window.requestAnimationFrame(outerGameLoop(socket));
}

function onGameOver() {
  stopCapturingInput();
  setTimeout(() => {
    playMenu.classList.remove('hidden');
    gameState = 'menu';
  }, 1000);
}

function onUpdate(update: Update) {
  receivedUpdates.push(update);
}

main();
