const args = process.argv.slice(2);
const port = parseInt(args[0]) || 3000;

const express = require('express');
const app = express();
const http = require('http');
const WebSocketServer = require('ws').Server;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
var Vec2D = require('vector2d');

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
var commands = [
  "/rename <name>",
]

var planets = [];

function generateFirst() {
    planets.push({
        id: 'spawn',
        origin: new Vec2D.Vector(50, 50),
        position: new Vec2D.Vector(50, 50),
        radius: 100,
        mass: 100,
        imageId: 0
    });
}

function generatePlanet(posX, posY) {
  var planet = {
    id: generateUUID(),
    origin: new Vec2D.Vector(posX, posY),
    position: new Vec2D.Vector(posX, posY),
    radius: Math.random() * 500,
    mass: Math.random() * 100,
    imageId: Math.floor(Math.random() * 9)
  };
  planets.push(planet);
  console.log("Generated planet: " + planet.id + " at " + planet.position.x + ", " + planet.position.y);
}

generateFirst();


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

wss.on('connection', (ws) => {
  ws.isAlive = true;

  clients.push(new Client(ws));
  console.log(`a user connected ${getClient(ws).id} from ${ws._socket.remoteAddress}`);
  players.push({id: getClient(ws).id, name: getClient(ws).id, x: 0, y: 0, rotation: 0, team: Math.floor(Math.random() * 2) + 1, planets_nearby: []});
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({event: 'players', players: players, playerID: getClient(client).id}));
    }
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw)
      const event = data.event;
      const player = players.find(player => player.id === getClient(ws).id);
      switch (event) {
        case 'move':
          const movementData = data.player
          player.x = movementData.x;
          player.y = movementData.y;
          player.rotation = movementData.rotation;
          var planets_nearby = planets.filter(planet => {
            // Only get planets within 1000 units of the player
            var distance = Math.sqrt(Math.pow(planet.position.x - player.x, 2) + Math.pow(planet.position.y - player.y, 2));
            return distance < 2000;
          });
          player.planets_nearby = planets_nearby;
          for(const client of clients) {
            if (client.ws === ws && client.ws.readyState !== 1) continue;
            client.ws.send(JSON.stringify({event: 'move', player: player, playerID: client.id}));
          }
          break;
        case 'world':
          var planets_nearby = planets.filter(planet => {
            // Only get planets within 1000 units of the player
            var distance = Math.sqrt(Math.pow(planet.position.x - player.x, 2) + Math.pow(planet.position.y - player.y, 2));
            return distance < 2000;
          });
          player.planets_nearby = planets_nearby;
          ws.send(JSON.stringify({event: 'world', planets: planets_nearby, playerID: player.id}));
          break;
        case 'new_planet':
            generatePlanet(player.x, player.y);
            for(const client of clients) {
              if (client.ws === ws && client.ws.readyState !== 1) continue;
              var client_player = players.find(player => player.id === client.id);
              if(client_player) {
                var planets_nearby = planets.filter(planet => {
                  // Only get planets within 1000 units of the player
                  var distance = Math.sqrt(Math.pow(planet.position.x - client_player.x, 2) + Math.pow(planet.position.y - client_player.y, 2));
                  return distance < 2000;
                });
                client_player.planets_nearby = planets_nearby;
                client.ws.send(JSON.stringify({event: 'world', planets: planets_nearby, playerID: client_player.id}));
              }
            }
            break;
        case 'pong':
          ws.isAlive = true;
          break;
        case 'commands':
          ws.send(JSON.stringify({event: 'commands', commands: commands}));
          break;
        case 'console':
          console.log(data.command);
          if(!data.command) break;
          if(data.command.startsWith('/rename ')) {
            const newName = data.command.split(' ')[1];
            const player = players.find(player => player.id === getClient(ws).id);
            player.name = newName;
            for(const client of clients) {
              if (client.ws === ws && client.ws.readyState !== 1) continue;
              client.ws.send(JSON.stringify({event: 'rename', player: player, playerID: client.id}));
            }
          } else {
            if(data.command.startsWith('/')) {
              ws.send(JSON.stringify({event: 'console', message: 'Unknown command'}));
            } else {
              const player = players.find(player => player.id === getClient(ws).id);
              for(const client of clients) {
                if (client.ws === ws && client.ws.readyState !== 1) continue;
                client.ws.send(JSON.stringify({event: 'chat', message: data.command, player: player, playerID: client.id}));
              }
            }
          }
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