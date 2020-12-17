export const UPDATE_TICK_LENGTH_MS = 1000 / 60;

export const PLAYER_RADIUS = 15;
export const PLAYER_MAX_HP = 100;
export const PLAYER_SPEED = 200;
export const PLAYER_FIRE_COOLDOWN = 0.25;

export const BOMB_RADIUS = 10;
export const BOMB_EXPLOSION_RADIUS = 40;
export const BOMB_FUSE_TIME_MS = 2000;

export const TILE_SIZE = 50;

export const NUM_TILES = 15;

export const MAP_SIZE = TILE_SIZE * NUM_TILES;



export const MSG_TYPES = {
  JOIN_GAME: 'join_game',
  GAME_UPDATE: 'update',
  INPUT: 'input',
  GAME_OVER: 'game_over',
};
