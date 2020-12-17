import { MoveField, SequencedMove, Move } from '../shared/types';

const smove: SequencedMove = {
  sequence: 0,
  move: {
    left: false,
    right: false,
    up: false,
    down: false,
    bomb: false,
  }
}

const keyCodeToMoveField = Object.freeze<{[keycode: number]: MoveField}>({
  32: 'bomb', // spacebar
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
});

function isMoveZero(move: Move): boolean {
  return !move.left && !move.right && !move.up && !move.down && !move.bomb;
}

let moveBuffer: SequencedMove[] = []

let sequence = 1;

function copySequencedMove(sm: SequencedMove): SequencedMove {
  return {
    sequence: sm.sequence,
    move: {
      left: sm.move.left,
      right: sm.move.right,
      up: sm.move.up,
      down: sm.move.down,
      bomb: sm.move.bomb,
    },
  }
}

let lastSequencedMove: SequencedMove | undefined;

function keyHandler(event: KeyboardEvent, enable: boolean) {
  const moveField = keyCodeToMoveField[event.keyCode];
  if (!moveField) {
    return;
  }
  const changed = smove.move[moveField] !== enable;
  smove.move[moveField] = enable;
  if (changed) {
    const copiedMove = copySequencedMove(smove);
    copiedMove.sequence = sequence;
    sequence++;
    lastSequencedMove = copiedMove;
    moveBuffer.push(copiedMove);
  }
}

export function getAndWipeMoveBuffer() {
  if (moveBuffer.length === 0 && lastSequencedMove && !isMoveZero(lastSequencedMove.move)) {
    // Use the last move if it's non-zero and the buffer is empty.
    // This is needed for the client-side prediction of the player
    // movement to work.
    const copiedMove = copySequencedMove(lastSequencedMove);
    copiedMove.sequence = sequence;
    sequence++;
    lastSequencedMove = copiedMove;
    return [copiedMove];
  }

  const buf = moveBuffer;
  moveBuffer = [];
  return buf;
}

function keyDownHandler(event: KeyboardEvent) {
  return keyHandler(event, true);
}

function keyUpHandler(event: KeyboardEvent) {
  return keyHandler(event, false);
}

export function startCapturingInput() {
  window.addEventListener('keydown', keyDownHandler);
  window.addEventListener('keyup', keyUpHandler);
}

export function stopCapturingInputAndWipe() {
  window.removeEventListener('keydown', keyDownHandler);
  window.removeEventListener('keyup', keyUpHandler);
  smove.sequence = 0;
  smove.move = {
    left: false,
    right: false,
    up: false,
    down: false,
    bomb: false,
  };
}
