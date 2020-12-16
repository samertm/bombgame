import { debounce } from 'throttle-debounce';
import { getAsset } from './assets';
import { ClientState, Player, Bomb } from '../shared/types';

import {
  PLAYER_RADIUS,
  MAP_SIZE,
  BOMB_RADIUS,
  BOMB_EXPLOSION_RADIUS,
  TILE_SIZE,
} from '../shared/constants';

import { debugEnabled } from './debug';

const canvas = document.getElementById('game-canvas')! as HTMLCanvasElement;
const context = canvas.getContext('2d')!;
setCanvasDimensions();

function setCanvasDimensions() {
  const scaleRatio = Math.max(1, 800 / window.innerWidth);
  canvas.width = scaleRatio * window.innerWidth;
  canvas.height = scaleRatio * window.innerHeight;
}

window.addEventListener('resize', debounce(40, setCanvasDimensions));

export function renderGame(state?: ClientState) {
  if (!state) {
    return;
  }
  const { me, debugServerMe, others, bombs } = state;

  // Draw background
  renderBackground(me.x, me.y);

  // Draw boundaries
  context.strokeStyle = 'black';
  context.lineWidth = 1;
  context.strokeRect(canvas.width / 2 - me.x, canvas.height / 2 - me.y, MAP_SIZE, MAP_SIZE);

  renderGrid(me);

  // Draw bombs
  for (const b of bombs) {
    renderBomb(me, b);
  }

  // Draw all players
  if (debugEnabled()) {
    renderPlayer(me, debugServerMe, true);
  }
  renderPlayer(me, me);
  for (const other of others) {
    renderPlayer(me, other);
  }
}

function renderGrid(me: Player) {
  const startX = canvas.width / 2 - me.x;
  const startY = canvas.height / 2 - me.y;
  let dark = false;
  for (let col = 0; col < Math.trunc(MAP_SIZE / TILE_SIZE); col++) {
    for (let row = 0; row < Math.trunc(MAP_SIZE / TILE_SIZE); row++) {
      if (dark) {
        context.fillStyle = '#bf4000';
      } else {
        context.fillStyle = '#fc5603';
      }
      dark = !dark;
      context.fillRect(
        startX + col * TILE_SIZE,
        startY + row * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE);
    }
  }
}

function renderBackground(x: number, y: number) {
  const backgroundX = MAP_SIZE / 2 - x + canvas.width / 2;
  const backgroundY = MAP_SIZE / 2 - y + canvas.height / 2;
  const backgroundGradient = context.createRadialGradient(
    backgroundX,
    backgroundY,
    MAP_SIZE / 10,
    backgroundX,
    backgroundY,
    MAP_SIZE / 2,
  );
  backgroundGradient.addColorStop(0, 'black');
  backgroundGradient.addColorStop(1, 'gray');
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

// Renders a ship at the given coordinates
function renderPlayer(me: Player, player: Player, debug?: boolean) {
  const { x, y } = player;
  const canvasX = canvas.width / 2 + x - me.x;
  const canvasY = canvas.height / 2 + y - me.y;

  // Draw ship
  context.save();
  context.translate(canvasX, canvasY);
  context.drawImage(
    getAsset('ship.svg'),
    -PLAYER_RADIUS,
    -PLAYER_RADIUS,
    PLAYER_RADIUS * 2,
    PLAYER_RADIUS * 2,
  );
  context.restore();
}

function renderBomb(me: Player, bomb: Bomb) {
  const { x, y } = bomb;
  const radius = (bomb.exploded) ? BOMB_EXPLOSION_RADIUS : BOMB_RADIUS;
  context.drawImage(
    getAsset('bullet.svg'),
    canvas.width / 2 + x - me.x - radius,
    canvas.height / 2 + y - me.y - radius,
    radius * 2,
    radius * 2,
  );
}

export function renderMainMenu() {
  const t = Date.now() / 7500;
  const x = MAP_SIZE / 2 + 800 * Math.cos(t);
  const y = MAP_SIZE / 2 + 800 * Math.sin(t);
  renderBackground(x, y);
}
