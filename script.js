const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const playerRadius = 20;
const PLAYER_SPEED = 2.4;
let players = {};
let localPlayer = { id: null, x: canvas.width / 2, y: canvas.height / 2, velocity: { x: 0, y: 0 }, isHost: false };
let peer = new Peer();
let connections = [];
let hostId = null;

const TICK_RATE = 30;
const TICK_INTERVAL = 1000 / TICK_RATE;
let lastTick = Date.now();

peer.on("open", id => {
  localPlayer.id = id;
  const roomId = prompt("Insira o ID da sala para se conectar ou deixe vazio para criar uma nova:");
  roomId ? connectToHost(roomId) : createRoomAsHost();
});

function createRoomAsHost() {
  hostId = localPlayer.id;
  localPlayer.isHost = true;
  players[localPlayer.id] = { ...localPlayer };

  peer.on("connection", connection => {
    connections.push(connection);

    connection.on("open", () => {
      connection.send({ type: "init", players });
    });

    connection.on("data", data => handleHostData(data, connection));
    connection.on("close", () => removeConnection(connection.peer));
  });

  displayRoomId(localPlayer.id);
}

function connectToHost(roomId) {
  const conn = peer.connect(roomId);
  conn.on("open", () => {
    connections.push(conn);
    conn.send({ type: "newPlayer", player: { id: localPlayer.id, x: localPlayer.x, y: localPlayer.y } });

    conn.on("data", handleClientData);
    conn.on("close", () => alert("Você foi desconectado do host."));
  });
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

function sendPlayerAction(deltaX, deltaY) {
  if (localPlayer.isHost) {
    applyPlayerAction(localPlayer.id, deltaX, deltaY);
    broadcast({ type: "playerAction", playerId: localPlayer.id, deltaX, deltaY });
  } else {
    const conn = connections[0];
    if (conn && conn.open) {
      conn.send({ type: "playerAction", playerId: localPlayer.id, deltaX, deltaY });
    }
  }
}

function broadcast(data) {
  connections.forEach(conn => {
    if (conn.open) conn.send(data);
  });
}

function applyPlayerAction(playerId, deltaX, deltaY) {
  const player = players[playerId];
  if (!player) return;

  if (playerId === localPlayer.id) {
    player.velocity.x = deltaX;
    player.velocity.y = deltaY;

    player.x += deltaX;
    player.y += deltaY;
  } else {
    player.velocity.x = deltaX;
    player.velocity.y = deltaY;

    player.x += deltaX;
    player.y += deltaY;
  }
}

canvas.addEventListener("touchmove", e => {
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;

  // Calcular o ângulo
  const deltaX = touchX - localPlayer.x;
  const deltaY = touchY - localPlayer.y;
  directionAngle = Math.atan2(deltaY, deltaX);

  const moveX = PLAYER_SPEED * Math.cos(directionAngle);
  const moveY = PLAYER_SPEED * Math.sin(directionAngle);

  localPlayer.x += moveX;
  localPlayer.y += moveY;

  sendPlayerAction(moveX, moveY);

  touchStartX = touchX;
  touchStartY = touchY;
});

function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.arc(localPlayer.x, localPlayer.y, playerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "green";
  ctx.fill();
  ctx.closePath();

  Object.values(players).forEach(player => {
    if (player.id !== localPlayer.id) {
      const prevPos = player.lastPosition || { x: player.x, y: player.y };
      const interpolationFactor = 0.1;
      const interpolatedX = prevPos.x + (player.x - prevPos.x) * interpolationFactor;
      const interpolatedY = prevPos.y + (player.y - prevPos.y) * interpolationFactor;

      ctx.beginPath();
      ctx.arc(interpolatedX, interpolatedY, playerRadius, 0, Math.PI * 2);
      ctx.fillStyle = "blue";
      ctx.fill();
      ctx.closePath();

      player.lastPosition = { x: interpolatedX, y: interpolatedY };
    }
  });
}

function handleHostData(data, connection) {
  switch (data.type) {
    case "newPlayer":
      players[data.player.id] = { x: data.player.x, y: data.player.y, id: data.player.id };
      broadcast({ type: "updatePlayers", players });
      break;

    case "playerAction":
      const player = players[data.playerId];
      if (player) {
        player.x += data.deltaX;
        player.y += data.deltaY;
        broadcast({ type: "updatePlayers", players });
      }
      break;
  }
}

function handleClientData(data) {
  switch (data.type) {
    case "init":
      players = data.players;
      break;

    case "updatePlayers":
      players = data.players;
      break;

    case "playerAction":
      const player = players[data.playerId];
      if (player) {
        player.x += data.deltaX;
        player.y += data.deltaY;
      }
      break;
  }
}

function gameLoop() {
  if (!localPlayer.isHost) {
    localPlayer.x += localPlayer.velocity.x;
    localPlayer.y += localPlayer.velocity.y;
  }

  renderGame();
  requestAnimationFrame(gameLoop);
}

gameLoop();