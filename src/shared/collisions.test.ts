import { coordToTile, circleRectangleCollision } from './collisions';
import { TILE_SIZE, MAP_SIZE } from './constants';

test('coordToTile works', () => {
  expect(coordToTile({
    x: TILE_SIZE - 1,
    y: TILE_SIZE - 1,
  })).toEqual({
    row: 0,
    col: 0,
  });

  expect(coordToTile({
    x: TILE_SIZE,
    y: TILE_SIZE,
  })).toEqual({
    row: 1,
    col: 1,
  });

  expect(coordToTile({
    x: MAP_SIZE - 1,
    y: MAP_SIZE - 1,
  })).toEqual({
    row: (MAP_SIZE / TILE_SIZE) - 1,
    col: (MAP_SIZE / TILE_SIZE) - 1,
  });
});
