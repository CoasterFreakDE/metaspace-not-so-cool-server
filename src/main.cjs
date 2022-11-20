const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3000;

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "http://127.0.0.1:5173"
  }
});

var players = [];

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  const playerID = socket.id
  players.push({id: playerID, x: 0, y: 0, rotation: 0, team: Math.floor(Math.random() * 2) + 1});
  io.emit('players', players);

  socket.on('move', (data) => {
    const player = players.find(player => player.id === playerID);
    player.x = data.x;
    player.y = data.y;
    player.rotation = data.rotation;
    io.emit('move', player);
  });

  socket.on('disconnect', () => {
    console.log('a user disconnected');
    const playerID = socket.id
    players = players.filter(player => player.id !== playerID);
    io.emit('players', players);
  });
});

server.listen(port, () => {
  console.log('listening on *:' + port);
});