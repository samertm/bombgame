import { MoveField, SequencedMove } from '../shared/types';

const smove: SequencedMove = {
  sequence: 0,
  move: {
    left: false,
    right: false,
    up: false,
    down: false,
  }
}

const keyCodeToDirection = Object.freeze<{[keycode: number]: MoveField}>({
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
});

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
    },
  }
}

let lastMove: SequencedMove | undefined;

function keyHandler(event: KeyboardEvent, enable: boolean) {
  const arrow = keyCodeToDirection[event.keyCode];
  if (!arrow) {
    return;
  }
  const changed = smove.move[arrow] !== enable;
  smove.move[arrow] = enable;
  if (changed) {
    const copiedMove = copySequencedMove(smove);
    copiedMove.sequence = sequence;
    sequence++;
    lastMove = copiedMove;
    moveBuffer.push(copiedMove);
  }
}

export function getAndWipeMoveBuffer() {
  if (moveBuffer.length === 0 && lastMove) {
    // Use the last move instead if the buffer is empty.
    const copiedMove = copySequencedMove(lastMove);
    copiedMove.sequence = sequence;
    sequence++;
    lastMove = copiedMove;
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

export function stopCapturingInput() {
  window.removeEventListener('keydown', keyDownHandler);
  window.removeEventListener('keyup', keyUpHandler);
}
