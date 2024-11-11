const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const playerRadius = 20;
let players = {};
let localPlayer = { x: canvas.width / 2, y: canvas.height / 2, id: null, isHost: false };
let score = { home: 0, away: 0 };
let peer = new Peer();
let connections = [];
let hostId = null;

peer.on("open", id => {
  localPlayer.id = id;
  const roomId = prompt("Insira o ID da sala para se conectar ou deixe vazio para criar uma nova:");

  if (roomId) {
    connectToRoom(roomId);
  } else {
    createRoom();
  }
});

function createRoom() {
  hostId = localPlayer.id;
  localPlayer.isHost = true;
  displayRoomId(localPlayer.id);

  players[localPlayer.id] = { x: localPlayer.x, y: localPlayer.y, id: localPlayer.id };
  broadcast({ type: "init", players, score, hostId });

  peer.on("connection", connection => {
    connections.push(connection);
    connection.on("open", () => {
      connection.send({ type: "init", players, score, hostId });
    });

    connection.on("data", handleData);
  });
}

function connectToRoom(roomId) {
  const conn = peer.connect(roomId);
  conn.on("open", () => {
    connections.push(conn);

    conn.on("data", handleData);
    conn.send({ type: "newPlayer", player: { id: localPlayer.id, x: localPlayer.x, y: localPlayer.y } });
  });

  peer.on("connection", connection => {
    connections.push(connection);

    connection.on("data", handleData);
  });
}

function handleData(data) {
  switch (data.type) {
    case "init":
      players = data.players;
      score = data.score;
      hostId = data.hostId;
      break;

    case "newPlayer":
      players[data.player.id] = { x: data.player.x, y: data.player.y, id: data.player.id };
      broadcast({ type: "updatePlayers", players });
      break;

    case "updatePlayers":
      players = data.players;
      break;

    case "playerDisconnected":
      delete players[data.playerId];
      broadcast({ type: "updatePlayers", players });
      break;

    case "updateScore":
      score = data.score;
      break;

    case "hostChange":
      hostId = data.hostId;
      localPlayer.isHost = localPlayer.id === hostId;
      break;
  }
}

function broadcast(data) {
  connections.forEach(conn => {
    if (conn.open) {
      conn.send(data);
    }
  });
}

peer.on("disconnected", () => {
  if (localPlayer.isHost) {
    electNewHost();
  }
});

function electNewHost() {
  const sortedIds = Object.keys(players).sort();
  const newHostId = sortedIds[0];

  if (localPlayer.id === newHostId) {
    localPlayer.isHost = true;
    hostId = newHostId;
    broadcast({ type: "hostChange", hostId });
  }
}

function displayRoomId(id) {
  const input = document.createElement("input");
  input.value = id;
  input.readOnly = true;
  input.style.position = "absolute";
  input.style.top = "20px";
  input.style.left = "20px";
  document.body.appendChild(input);
}

function checkCollisionsLocally() {
  const playerIds = Object.keys(players);

  playerIds.forEach(id => {
    if (id !== localPlayer.id) {
      const player = players[id];
      const dx = player.x - localPlayer.x;
      const dy = player.y - localPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 2 * playerRadius) {
        const angle = Math.atan2(dy, dx);
        const overlap = 2 * playerRadius - distance;
        const pushStrength = 0.2 * overlap;

        const pushX = Math.cos(angle) * pushStrength;
        const pushY = Math.sin(angle) * pushStrength;

        if (id === localPlayer.id) {
          localPlayer.x -= pushX;
          localPlayer.y -= pushY;
        }

        players[id].x += pushX;
        players[id].y += pushY;
      }
    }
  });
}

function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  checkCollisionsLocally();

  Object.values(players).forEach(player => {
    ctx.beginPath();
    ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
    ctx.fillStyle = player.id === localPlayer.id ? "green" : "blue";
    ctx.fill();
    ctx.closePath();
  });
    
  sendUpdate();
}

function sendUpdate() {
  broadcast({ type: "updatePlayers", players });

  if (localPlayer.isHost) {
    broadcast({ type: "updateScore", score });
  }
}

let touchStartX, touchStartY;
canvas.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});

canvas.addEventListener("touchmove", e => {
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;

  const deltaX = touchX - touchStartX;
  const deltaY = touchY - touchStartY;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    localPlayer.x += deltaX > 0 ? 5 : -5;
  } else {
    localPlayer.y += deltaY > 0 ? 5 : -5;
  }

  touchStartX = touchX;
  touchStartY = touchY;

  players[localPlayer.id] = { x: localPlayer.x, y: localPlayer.y };
  renderGame();
});

peer.on("connection", conn => {
  conn.on("close", () => {
    const disconnectedPlayer = connections.find(c => c.peer === conn.peer);
    if (disconnectedPlayer) {
      connections.splice(connections.indexOf(disconnectedPlayer), 1);
      handleData({ type: "playerDisconnected", playerId: conn.peer });
    }

    if (conn.peer === hostId && localPlayer.isHost) {
      electNewHost();
    }
  });
});

(function gameLoop() {
  renderGame();
  requestAnimationFrame(gameLoop);
})();