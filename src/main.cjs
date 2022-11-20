const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3000;

const express = require('express');
const app = express();
const http = require('http');
const WebSocketServer = require('ws').Server;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

class Client {
  constructor(ws) {
    this.ws = ws;
    this.id = generateUUID();
  }

  id = null;
  ws = null;
}

var players = [];
var clients = [];

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

wss.on('connection', (ws) => {
  ws.isAlive = true;

  clients.push(new Client(ws));
  console.log(`a user connected ${getClient(ws).id}`);
  players.push({id: getClient(ws).id, x: 0, y: 0, rotation: 0, team: Math.floor(Math.random() * 2) + 1});
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({event: 'players', players: players, playerID: getClient(client).id}));
    }
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw)
      const event = data.event;
      switch (event) {
        case 'move':
          const player = players.find(player => player.id === getClient(ws).id);
          const movementData = data.player
          player.x = movementData.x;
          player.y = movementData.y;
          player.rotation = movementData.rotation;
          for(const client of clients) {
            if (client.ws === ws && client.ws.readyState !== 1) continue;
            client.ws.send(JSON.stringify({event: 'move', player: player, playerID: client.id}));
          }
          break;
        case 'pong':
          ws.isAlive = true;
          break;
        }
    } catch (error) {
      console.error(error)
    }    
  });

  ws.on('close', () => {
    console.log('a user disconnected');
    players = players.filter(player => player.id !== getClient(ws).id);
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify({event: 'players', players: players, playerID: getClient(client).id}));
      }
    });

  });
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.send(JSON.stringify({event: 'ping'}));
  });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
});

server.listen(port, () => {
  console.log('listening on *:' + port);
});

function getClient(ws) {
  return clients.find(client => client.ws === ws);
}

function generateUUID() {
  let d = new Date().getTime();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}