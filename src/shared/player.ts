import { SequencedPlayer, Player, Move, Block } from './types';
import { PLAYER_SPEED, PLAYER_RADIUS, MAP_SIZE } from './constants';
import {
  playerToCircle,
  blockToRectangle,
  circleRectangleCollision,
  coordToTile,
} from './collisions';

export function copySequencedPlayer(p: SequencedPlayer): SequencedPlayer {
  return {
    sequence: p.sequence,
    id: p.id,
    x: p.x,
    y: p.y,
  };
}

export function movePlayer(player: Player, dt: number, move: Move, blocks: (Block | undefined)[][]) {
  let playerTile = coordToTile(player);
  if (move.right && move.left) {
  } else if (move.right) {
    player.x += dt * PLAYER_SPEED;

    // Check right collisions.
    const b = (blocks[playerTile.row]) ?
          blocks[playerTile.row][playerTile.col+1] : undefined;
    if (b) {
      const blockRect = blockToRectangle(b);
      if (circleRectangleCollision(playerToCircle(player), blockRect)) {
        player.x = blockRect.left - PLAYER_RADIUS;
      }
    }

  } else if (move.left) {
    player.x -= dt * PLAYER_SPEED;

    // Check left collisions.
    const b = (blocks[playerTile.row]) ?
          blocks[playerTile.row][playerTile.col-1] : undefined;
    if (b) {
      const blockRect = blockToRectangle(b);
      if (circleRectangleCollision(playerToCircle(player), blockRect)) {
        player.x = blockRect.right + PLAYER_RADIUS;
      }
    }
  }
  if (player.x < PLAYER_RADIUS) {
    player.x = PLAYER_RADIUS;
  } else if (player.x > MAP_SIZE - PLAYER_RADIUS) {
    player.x = MAP_SIZE - PLAYER_RADIUS;
  }

  playerTile = coordToTile(player);

  if (move.up && move.down) {
  } else if (move.up) {
    player.y -= dt * PLAYER_SPEED;

    // Check top collisions.
    const b = (blocks[playerTile.row-1]) ?
          blocks[playerTile.row-1][playerTile.col] : undefined;
    if (b) {
      const blockRect = blockToRectangle(b);
      if (circleRectangleCollision(playerToCircle(player), blockRect)) {
        player.y = blockRect.bottom + PLAYER_RADIUS;
      }
    }
  } else if (move.down) {
    player.y += dt * PLAYER_SPEED;

    // Check bottom collision.
    const b = (blocks[playerTile.row+1]) ?
          blocks[playerTile.row+1][playerTile.col] : undefined;
    if (b) {
      const blockRect = blockToRectangle(b);
      if (circleRectangleCollision(playerToCircle(player), blockRect)) {
        player.y = blockRect.top - PLAYER_RADIUS;
      }
    }
  }

  if (player.y < PLAYER_RADIUS) {
    player.y = PLAYER_RADIUS;
  } else if (player.y > MAP_SIZE - PLAYER_RADIUS) {
    player.y = MAP_SIZE - PLAYER_RADIUS;
  }
}
