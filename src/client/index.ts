import { Socket } from 'socket.io-client';
import { connect, sendViewGame, sendJoinGame, sendInput } from './networking';
import { downloadAssets } from './assets';
import { renderGame } from './render';
import { getAndWipeMoveBuffer, startCapturingInput, stopCapturingInputAndWipe } from './input';
import State from './state';
import { Update } from '../shared/types';
import { fpsDiv, latencyDiv, serverTickRateDiv, debugEnabled } from './debug';
import { UPDATE_TICK_LENGTH_MS } from '../shared/constants';

import './css/bootstrap-reboot.css';
import './css/main.css';

const playMenu = document.getElementById('play-menu')!;
const playButton = document.getElementById('play-button')!;
const usernameInput = document.getElementById('username-input')! as HTMLInputElement;
const generalModal = document.getElementById('general-modal')!;

function displayOnGeneralModal(text: string) {
  generalModal.classList.remove('hidden');
  if (generalModal.innerText != text) {
    generalModal.innerText = text;
  }
}

function hideGeneralModal() {
  generalModal.classList.add('hidden');
}


class Game {
  state: State | undefined;
  receivedUpdates: Update[];
  lastUpdateTime: number;
  socket: typeof Socket | undefined;
  mode: 'entermenu' | 'menu' | 'enterwait' | 'wait' | 'entergame' | 'game';

  delta: number;
  debugClientSequences: {[sequence: number]: number};
  lastGeneralMessage?: string;

  constructor() {
    this.receivedUpdates = [];
    this.lastUpdateTime = 0;
    this.mode = 'entermenu';
    this.debugClientSequences = {};
    this.delta = 0;
  }

  setSocketAndSpectate(socket: typeof Socket) {
    this.socket = socket;
    sendViewGame(socket);
  }

  onUpdate = (update: Update) => {
    this.receivedUpdates.push(update);
  }

  onGameOver = () => {
    this.mode = 'entermenu';
  }

  gameLoop = (ts: DOMHighResTimeStamp) => {
    if (!this.socket) {
      throw Error("Game.socket cannot be undefined");
    }
    const socket = this.socket!;
    window.requestAnimationFrame(this.gameLoop);

    if (this.mode === 'entermenu') {
      stopCapturingInputAndWipe();
      playMenu.classList.remove('hidden');
      hideGeneralModal();
      usernameInput.focus();
      playButton.onclick = () => {
        if (usernameInput.value === "") {
          return;
        }
        this.mode = 'enterwait';
      };
      this.state = new State();
      this.mode = 'menu';
    }
    if (this.mode === 'menu') {
      // TODO
    }
    if (this.mode === 'enterwait') {
      this.receivedUpdates = [];
      sendJoinGame(socket, usernameInput.value);
      playMenu.classList.add('hidden');
      this.mode = 'wait';
    }
    if (this.mode === 'wait') {
      // TODO
      if (this.receivedUpdates.length !== 0) {
        const lastUpdate = this.receivedUpdates[this.receivedUpdates.length-1];
        if (lastUpdate.mode !== 'waiting') {
          this.mode = 'entergame';
        }
      }
    }
    if (this.mode === 'entergame') {
      this.state = new State();
      this.receivedUpdates = [];
      playMenu.classList.add('hidden');
      startCapturingInput();
      this.mode = 'game';
      this.delta = 0;
    }

    // this.mode is 'menu', 'wait', or 'game' at this point.

    if (this.lastUpdateTime === undefined) {
      this.lastUpdateTime = ts;
    }
    const lastUpdateTime = this.lastUpdateTime;
    this.lastUpdateTime = ts;

    this.delta += ts - lastUpdateTime;

    if (debugEnabled()) {
      const dt = (ts - lastUpdateTime) / 1000;
      fpsDiv.innerText = 'FPS: ' + Math.trunc(1/dt);
    }

    // this.mode must equal 'game'.
    if (!this.state) {
      throw Error("Game.state cannot be undefined");
    }
    const state = this.state!;
    const moves = getAndWipeMoveBuffer();
    if (moves.length !== 0) {
      // Send input if moves have been made.
      if (debugEnabled()) {
        for (let move of moves) {
          this.debugClientSequences[move.sequence] = ts;
        }
      }
      sendInput(socket, moves);
      state.processLocalMoves(moves);
    }
    if (this.receivedUpdates.length !== 0) {
      const lastUpdate = this.receivedUpdates[this.receivedUpdates.length - 1];
      if (debugEnabled() && lastUpdate.me) {
        serverTickRateDiv.innerText = 'Server Tick Rate: ' + lastUpdate.tickRate;
        const originalTs = this.debugClientSequences[lastUpdate.me.sequence];
        if (originalTs !== undefined) {
          latencyDiv.innerText = 'Latency: ' + Math.trunc(ts - originalTs);
          this.debugClientSequences = {};
        }
      }
      state.processGameUpdates(this.receivedUpdates, ts);
      if (this.mode !== 'menu') {
        if (this.lastGeneralMessage !== lastUpdate.waitingMessage) {
          this.lastGeneralMessage = lastUpdate.waitingMessage;
          if (this.lastGeneralMessage === undefined || this.lastGeneralMessage === "") {
            hideGeneralModal();
          } else {
            displayOnGeneralModal(this.lastGeneralMessage);
          }
        }
      }
      this.receivedUpdates = [];
    }

    let numUpdateTicks = 0;
    while (this.delta >= UPDATE_TICK_LENGTH_MS) {
      numUpdateTicks++;
      if (numUpdateTicks > 300) {
        console.warn("Client too slow, skipping incremental updates. Current delta:", this.delta);
        state.update(this.delta, lastUpdateTime + this.delta);
        this.delta = 0;
        break;
      }
      const dt = UPDATE_TICK_LENGTH_MS / 1000;
      const now = lastUpdateTime + UPDATE_TICK_LENGTH_MS * numUpdateTicks;
      state.update(dt, now);
      this.delta -= UPDATE_TICK_LENGTH_MS;
    }
    if (numUpdateTicks > 1) {
      console.warn("Ticked more than once:", numUpdateTicks);
    }

    renderGame(state.getClientState());
  }

  startGameLoop() {
    window.requestAnimationFrame(this.gameLoop);
  }
}


function main() {
  const game = new Game();
  Promise.all([
    connect(game.onUpdate, game.onGameOver),
    downloadAssets(),
  ]).then((args) => {
    const socket: typeof Socket = args[0];
    game.setSocketAndSpectate(socket);

    game.startGameLoop();
  }).catch(console.error);
}

main();
