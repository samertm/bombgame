import { debounce } from 'throttle-debounce';
import { getAsset } from './assets';
import { ClientState, Player, Bomb, Block, Coord, Explosion, Powerup } from '../shared/types';

import {
  PLAYER_RADIUS,
  MAP_SIZE,
  BOMB_RADIUS,
  BOMB_EXPLOSION_RADIUS,
  TILE_SIZE,
  POWERUP_RADIUS,
} from '../shared/constants';

import { tileToCoord } from '../shared/collisions';

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
  const {
    me,
    debugServerMe,
    others,
    bombs,
    blocks,
    explosions,
    powerups,
  } = state;
  // The camera x/y is the center of the camera, relative to the grid.
  const camera = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
  };

  // Draw background
  renderBackground(camera.x, camera.y);

  // Draw boundaries
  context.strokeStyle = 'black';
  context.lineWidth = 1;
  context.strokeRect(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y, MAP_SIZE, MAP_SIZE);

  renderGrid(camera);

  // Draw explosions
  for (const e of explosions) {
    renderExplosion(camera, e);
  }

  // Draw bombs
  for (const b of bombs) {
    renderBomb(camera, b);
  }

  // Draw blocks
  for (const row of blocks) {
    for (const bl of row) {
      if (bl) {
        renderBlock(camera, bl);
      }
    }
  }

  // Draw powerups
  for (const p of powerups) {
    renderPowerup(camera, p);
  }

  // Draw all players
  if (debugEnabled() && debugServerMe) {
    renderPlayer(camera, debugServerMe, true);
  }
  if (me) {
    renderPlayer(camera, me);
  }
  for (const other of others) {
    renderPlayer(camera, other);
  }
}

function renderGrid(camera: Coord) {
  const startX = canvas.width / 2 - camera.x;
  const startY = canvas.height / 2 - camera.y;
  let dark = false;
  for (let col = 0; col < Math.trunc(MAP_SIZE / TILE_SIZE); col++) {
    for (let row = 0; row < Math.trunc(MAP_SIZE / TILE_SIZE); row++) {
      if (dark) {
        context.fillStyle = '#166b36';
      } else {
        context.fillStyle = '#19803f';
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
function renderPlayer(camera: Coord, player: Player, debug?: boolean) {
  const { x, y } = player;
  const canvasX = canvas.width / 2 + x - camera.x;
  const canvasY = canvas.height / 2 + y - camera.y;

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

  context.font = "14px Helvetica";
  context.fillStyle = 'black';
  context.fillText(
    player.username,
    canvasX - PLAYER_RADIUS,
    canvasY - PLAYER_RADIUS - 8);
}

function renderBomb(camera: Coord, bomb: Bomb) {
  const { x, y } = bomb;
  const radius = (bomb.exploded) ? BOMB_EXPLOSION_RADIUS : BOMB_RADIUS;
  context.drawImage(
    getAsset('bullet.svg'),
    canvas.width / 2 + x - camera.x - radius,
    canvas.height / 2 + y - camera.y - radius,
    radius * 2,
    radius * 2,
  );
}

function renderBlock(camera: Coord, block: Block) {
  const { x, y } = block;
  if (block.destructable) {
    context.fillStyle = '#919191';
  } else {
    context.fillStyle = '#5e5e5e';
  }
  if (block.destroyed) {
    context.fillStyle = '#f27e7e';
  }
  context.fillRect(
    canvas.width / 2 + x - camera.x - TILE_SIZE/2,
    canvas.height / 2 + y - camera.y - TILE_SIZE/2,
    TILE_SIZE,
    TILE_SIZE,
  );
}

function renderExplosion(camera: Coord, explosion: Explosion) {
  for (const t of explosion.tiles) {
    const coord = tileToCoord(t);
    context.fillStyle = '#eb4034';
    context.fillRect(
      canvas.width / 2 + coord.x - camera.x - TILE_SIZE/2,
      canvas.height / 2 + coord.y - camera.y - TILE_SIZE/2,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
}

function renderPowerup(camera: Coord, powerup: Powerup) {
  context.beginPath();
  context.arc(
    canvas.width / 2 + powerup.x - camera.x,
    canvas.height / 2 + powerup.y - camera.y,
    POWERUP_RADIUS,
    0,
    2 * Math.PI,
    false,
  );
  if (powerup.destroyed) {
    context.fillStyle = '#f27e7e';
  } else if (powerup.powerupType === 'bombsize') {
    context.fillStyle = 'green';
  } else if (powerup.powerupType === 'numbombs') {
    context.fillStyle = 'yellow';
  }
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = '#003300';
  context.stroke();
}

export function renderMainMenu() {
  const t = Date.now() / 7500;
  const x = MAP_SIZE / 2 + 800 * Math.cos(t);
  const y = MAP_SIZE / 2 + 800 * Math.sin(t);
  renderBackground(x, y);
}
