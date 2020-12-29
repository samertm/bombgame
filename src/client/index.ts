import { Socket } from 'socket.io-client';
import { connect, sendViewGame, sendJoinGame, sendInput } from './networking';
import { downloadAssets } from './assets';
import { renderGame } from './render';
import { getAndWipeMoveBuffer, startCapturingInput, stopCapturingInputAndWipe } from './input';
import State from './state';
import { Update, SequencedMove } from '../shared/types';
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

class GameRunner {
  state: State;
  receivedUpdates: Update[];
  delta: number;
  debugClientSequences: {[sequence: number]: number};

  constructor(state: State, receivedUpdates: Update[]) {
    this.state = state;
    this.receivedUpdates = receivedUpdates;
    this.debugClientSequences = {};
    this.delta = 0;
    this.receivedUpdates = [];
  }

  receiveUpdate(update: Update) {
    this.receivedUpdates.push(update);
  }

  update(socket: typeof Socket, now: number, lastUpdateTime: number, moves: SequencedMove[]) {
    this.delta += now - lastUpdateTime;

    if (debugEnabled()) {
      const dt = (now - lastUpdateTime) / 1000;
      fpsDiv.innerText = 'FPS: ' + Math.trunc(1/dt);
    }

    if (moves.length !== 0) {
      // Send input if moves have been made.
      if (debugEnabled()) {
        for (let move of moves) {
          this.debugClientSequences[move.sequence] = now;
        }
      }
      sendInput(socket, moves);
      this.state.processLocalMoves(moves);
    }
    if (this.receivedUpdates.length !== 0) {
      const lastUpdate = this.receivedUpdates[this.receivedUpdates.length - 1];
      if (debugEnabled() && lastUpdate.me) {
        serverTickRateDiv.innerText = 'Server Tick Rate: ' + lastUpdate.tickRate;
        const originalNow = this.debugClientSequences[lastUpdate.me.sequence];
        if (originalNow !== undefined) {
          latencyDiv.innerText = 'Latency: ' + Math.trunc(now - originalNow);
          this.debugClientSequences = {};
        }
      }
      this.state.processGameUpdates(this.receivedUpdates, now);
      this.receivedUpdates = [];
    }

    let numUpdateTicks = 0;
    while (this.delta >= UPDATE_TICK_LENGTH_MS) {
      numUpdateTicks++;
      if (numUpdateTicks > 300) {
        console.warn("Client too slow, skipping incremental updates. Current delta:", this.delta);
        this.state.update(this.delta, lastUpdateTime + this.delta);
        this.delta = 0;
        break;
      }
      const dt = UPDATE_TICK_LENGTH_MS / 1000;
      const updateTime = lastUpdateTime + UPDATE_TICK_LENGTH_MS * numUpdateTicks;
      this.state.update(dt, updateTime);
      this.delta -= UPDATE_TICK_LENGTH_MS;
    }
    if (numUpdateTicks > 1) {
      console.warn("Ticked more than once:", numUpdateTicks);
    }

    renderGame(this.state.getClientState());
  }
}

interface GameState {
  update(socket: typeof Socket, now: number, lastUpdateTime: number): GameState | undefined;
  receiveUpdate(update: Update): void;
  exitState(): void;
}

class InitialState implements GameState {
  update(socket: typeof Socket, now: number, lastUpdateTime: number): GameState | undefined {
    return new MenuState(socket, true);
  }

  receiveUpdate(update: Update) {}
  exitState() {}
}

class MenuState implements GameState {
  sendSpectate: boolean;
  sentJoinGame: boolean;
  runner: GameRunner;

  constructor(socket: typeof Socket, sendSpectate: boolean) {
    this.sendSpectate = sendSpectate;
    this.sentJoinGame = false;
    this.runner = new GameRunner(new State(), []);

    stopCapturingInputAndWipe();
    playMenu.classList.remove('hidden');
    hideGeneralModal();
    usernameInput.focus();
    playButton.onclick = () => {
      if (this.sentJoinGame) {
        return;
      }
      if (usernameInput.value === "") {
        usernameInput.focus();
        return;
      }
      sendJoinGame(socket, usernameInput.value);
      this.sentJoinGame = true;
      playMenu.classList.add('hidden');
    };
  }

  receiveUpdate(update: Update) {
    this.runner.receiveUpdate(update);
  }

  update(socket: typeof Socket, now: number, lastUpdateTime: number): GameState | undefined {
    if (this.sendSpectate) {
      sendViewGame(socket);
      this.sendSpectate = false;
    }
    if (this.sentJoinGame) {
      return new WaitingState(this.runner);
    }
    this.runner.update(socket, now, lastUpdateTime, []);
    return;
  }

  exitState() {
    playMenu.classList.add('hidden');
  }
}

class WaitingState implements GameState {
  latestUpdate: Update | undefined;
  runner: GameRunner;

  constructor(runner: GameRunner) {
    console.log("Entering waiting state");
    this.runner = runner;
  }

  receiveUpdate(update: Update) {
    this.runner.receiveUpdate(update);
    this.latestUpdate = update;
  }

  update(socket: typeof Socket, now: number, lastUpdateTime: number): GameState | undefined {
    if (this.latestUpdate) {
      if (this.latestUpdate.me) {
        return new PlayingState();
      }
      const msg = this.latestUpdate.waitingMessage;
      if (msg) {
        displayOnGeneralModal(msg);
      }
    }
    this.runner.update(socket, now, lastUpdateTime, []);
    return;
  }

  exitState() {
    hideGeneralModal();
  }
}

class PlayingState implements GameState {
  runner: GameRunner;
  latestUpdate: Update | undefined;
  constructor() {
    this.runner = new GameRunner(new State(), []);
    startCapturingInput();
    // Wipe the move buffer in case there's anything in it.
    getAndWipeMoveBuffer();
  }

  receiveUpdate(update: Update) {
    this.runner.receiveUpdate(update);
    this.latestUpdate = update;
  }

  update(socket: typeof Socket, now: number, lastUpdateTime: number): GameState | undefined {
    const latestUpdate = this.latestUpdate;
    if (latestUpdate && !latestUpdate.me) {
      return new WaitingState(this.runner);
    }
    this.runner.update(socket, now, lastUpdateTime, getAndWipeMoveBuffer());
    return;
  }

  exitState() {
    stopCapturingInputAndWipe();
  }
}


class Game {
  gameState: GameState;
  lastUpdateTime: number;
  socket: typeof Socket | undefined;

  constructor() {
    this.lastUpdateTime = 0;
    this.gameState = new InitialState();
  }

  setSocket(socket: typeof Socket) {
    this.socket = socket;
  }

  onUpdate = (update: Update) => {
    this.gameState.receiveUpdate(update);
  }

  onGameOver = () => {
    // SAMER: I don't think we need to do anything here?
    console.log("got game over");
  }

  gameLoop = (now: DOMHighResTimeStamp) => {
    if (!this.socket) {
      throw Error("Game.socket cannot be undefined");
    }
    const socket = this.socket!;
    window.requestAnimationFrame(this.gameLoop);

    if (this.lastUpdateTime === undefined) {
      this.lastUpdateTime = now;
    }
    const nextGameState = this.gameState.update(socket, now, this.lastUpdateTime);
    if (nextGameState) {
      this.gameState.exitState();
      this.gameState = nextGameState;
    }

    this.lastUpdateTime = now;
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
    game.setSocket(socket);

    game.startGameLoop();
  }).catch(console.error);
}

main();
