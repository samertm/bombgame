import { Player, Move } from './types';
import { PLAYER_SPEED } from './constants';

export function movePlayer(player: Player, dt: number, move: Move) {
  // TODO: Fix bugs
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
}
