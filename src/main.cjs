const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3000;

const express = require('express');
const app = express();
const http = require('http');
const WebSocketServer = require('ws').Server;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

var players = [];
var clients = {};

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

wss.on('connection', (ws) => {
  const playerID = generateUUID()
  console.log(`a user connected ${playerID}`);
  clients[ws] = playerID;
  players.push({id: playerID, x: 0, y: 0, rotation: 0, team: Math.floor(Math.random() * 2) + 1});
  ws.send(JSON.stringify({event: 'players', players: players, playerID: playerID}));

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw)
      const event = data.event;
      if (event !== 'move') return;
      const player = players.find(player => player.id === playerID);
      const movementData = data.player
      player.x = movementData.x;
      player.y = movementData.y;
      player.rotation = movementData.rotation;
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify({event: 'move', player: player, playerID: clients[client]}));
        }
      });
    } catch (error) {
      console.error(error)
    }    
  });

  ws.on('disconnect', () => {
    console.log('a user disconnected');
    players = players.filter(player => player.id !== playerID);
    ws.send(JSON.stringify({event: 'players', players: players, playerID: clients[ws]}));
  });
});

server.listen(port, () => {
  console.log('listening on *:' + port);
});

function generateUUID() {
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
  return uuid;
}