import { SequencedPlayer, Player, Move, Block, Bomb, Tile } from './types';
import { PLAYER_SPEED, PLAYER_RADIUS, MAP_SIZE } from './constants';
import {
  playerToCircle,
  coordToRectangle,
  circleRectangleCollision,
  coordToTile,
  Rectangle,
} from './collisions';

export function copySequencedPlayer(p: SequencedPlayer): SequencedPlayer {
  return {
    sequence: p.sequence,
    id: p.id,
    x: p.x,
    y: p.y,
  };
}

function checkBlockCollision(player: Player, blocks: (Block | undefined)[][], tile: Tile): Rectangle | undefined {
  const b = (blocks[tile.row]) ? blocks[tile.row][tile.col] : undefined;
  if (!b) {
    return;
  }
  const blockRect = coordToRectangle(b);
  if (circleRectangleCollision(playerToCircle(player), blockRect)) {
    return blockRect;
  }
  return;
}

function checkBombCollision(player: Player, bombs: Bomb[]): Bomb | undefined {
  for (const b of bombs) {
    if (circleRectangleCollision(playerToCircle(player), coordToRectangle(b))) {
      return b;
    }
  }
  return;
}

export function movePlayer(player: Player, dt: number, move: Move, blocks: (Block | undefined)[][], bombs: Bomb[]) {
  // Ignore any bombs we're currently colliding with.
  let ignoreBomb = checkBombCollision(player, bombs);

  if (move.right && move.left) {
  } else if (move.right) {
    player.x += dt * PLAYER_SPEED;
  } else if (move.left) {
    player.x -= dt * PLAYER_SPEED;
  }
  if (player.x < PLAYER_RADIUS) {
    player.x = PLAYER_RADIUS;
  } else if (player.x > MAP_SIZE - PLAYER_RADIUS) {
    player.x = MAP_SIZE - PLAYER_RADIUS;
  }

  if (move.up && move.down) {
  } else if (move.up) {
    player.y -= dt * PLAYER_SPEED;
  } else if (move.down) {
    player.y += dt * PLAYER_SPEED;
  }

  if (player.y < PLAYER_RADIUS) {
    player.y = PLAYER_RADIUS;
  } else if (player.y > MAP_SIZE - PLAYER_RADIUS) {
    player.y = MAP_SIZE - PLAYER_RADIUS;
  }

  // Check collisions

  const playerTile = coordToTile(player);

  // Check right collisions (top right, right, bottom right).
  for (const rowoffset of [-1, 0, 1]) {
    const blockRect = checkBlockCollision(player, blocks, {
      row: playerTile.row + rowoffset,
      col: playerTile.col + 1,
    });
    if (blockRect) {
      player.x = blockRect.left - PLAYER_RADIUS;
      break;
    }
  }

  // Check left collisions (top left, left, bottom left).
  for (const rowoffset of [-1, 0, 1]) {
    const blockRect = checkBlockCollision(player, blocks, {
      row: playerTile.row + rowoffset,
      col: playerTile.col - 1,
    });
    if (blockRect) {
      player.x = blockRect.right + PLAYER_RADIUS;
      break;
    }
  }

  // Check top collision.
  let blockRect = checkBlockCollision(player, blocks, {row: playerTile.row - 1, col: playerTile.col});
  if (blockRect) {
    player.y = blockRect.bottom + PLAYER_RADIUS;
  }

  // Check bottom collision.
  blockRect = checkBlockCollision(player, blocks, {row: playerTile.row + 1, col: playerTile.col});
  if (blockRect) {
    player.y = blockRect.top - PLAYER_RADIUS;
  }

  // Check bomb collision.
  let bomb = checkBombCollision(player, bombs);
  if (bomb && !(ignoreBomb && ignoreBomb.id === bomb.id)) {
    const bombRect = coordToRectangle(bomb);
    if (
      player.x + PLAYER_RADIUS > bombRect.left &&
        player.x + PLAYER_RADIUS < bombRect.right &&
        player.y > bombRect.top &&
        player.y < bombRect.bottom
    ) {

      player.x = bombRect.left - PLAYER_RADIUS;
    } else if (
      player.x - PLAYER_RADIUS < bombRect.right &&
        player.x - PLAYER_RADIUS > bombRect.left &&
        player.y > bombRect.top &&
        player.y < bombRect.bottom
    ) {

      player.x = bombRect.right + PLAYER_RADIUS;
    } else if (
      player.y - PLAYER_RADIUS < bombRect.bottom &&
        player.y - PLAYER_RADIUS > bombRect.top &&
        player.x > bombRect.left &&
        player.x < bombRect.right
    ) {

      player.y = bombRect.bottom + PLAYER_RADIUS;
    } else if (
      player.y + PLAYER_RADIUS > bombRect.top &&
        player.y + PLAYER_RADIUS < bombRect.bottom &&
        player.x > bombRect.left &&
        player.x < bombRect.right
    ) {

      player.y = bombRect.top - PLAYER_RADIUS;
    }
  }
}
