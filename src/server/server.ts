import express from 'express';
import { Socket } from 'socket.io';
import { SequencedMove } from '../shared/types';
import Game from './Game';

const constants = require('../shared/constants');

const app = express();
app.use(express.static('public'));

if (process.env.NODE_ENV === 'development') {
  const webpack = require('webpack');
  const webpackDevMiddleware = require('webpack-dev-middleware');
  const webpackConfig = require('../../webpack.dev.js');

  const compiler = webpack(webpackConfig);
  app.use(webpackDevMiddleware(compiler));
} else {
  app.use(express.static('dist'));
}

const port = process.env.PORT || '3000';
const server = app.listen(port);
console.log(`Server listening on port ${port}`);

const io = require("socket.io")(server);

const game = new Game();

game.startUpdate();

io.on('connection', (socket: Socket) => {
  console.log('Player connected!', socket.id);

  socket.on(constants.MSG_TYPES.JOIN_GAME, (username: string) => {
    game.addPlayer(socket, username);
  });
  socket.on(constants.MSG_TYPES.INPUT, (input: SequencedMove[]) => {
    game.handleInput(socket, input);
  });
  socket.on('disconnect', () => {
    console.log("Removing player", socket.id);
    game.removePlayer(socket);
  });
});
