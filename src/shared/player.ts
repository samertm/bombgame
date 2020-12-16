import { SequencedPlayer, Player, Move } from './types';
import { PLAYER_SPEED, PLAYER_RADIUS, MAP_SIZE } from './constants';

export function copySequencedPlayer(p: SequencedPlayer): SequencedPlayer {
  return {
    sequence: p.sequence,
    id: p.id,
    x: p.x,
    y: p.y,
  };
}

export function movePlayer(player: Player, dt: number, move: Move) {
  if (move.right && move.left) {
  } else if (move.right) {
    player.x += dt * PLAYER_SPEED;
  } else if (move.left) {
    player.x -= dt * PLAYER_SPEED;
  }

  if (move.up && move.down) {
  } else if (move.up) {
    player.y -= dt * PLAYER_SPEED;
  } else if (move.down) {
    player.y += dt * PLAYER_SPEED;
  }

  if (player.x < PLAYER_RADIUS) {
    player.x = PLAYER_RADIUS;
  } else if (player.x > MAP_SIZE - PLAYER_RADIUS) {
    player.x = MAP_SIZE - PLAYER_RADIUS;
  }
  if (player.y < PLAYER_RADIUS) {
    player.y = PLAYER_RADIUS;
  } else if (player.y > MAP_SIZE - PLAYER_RADIUS) {
    player.y = MAP_SIZE - PLAYER_RADIUS;
  }
}
