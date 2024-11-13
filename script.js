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
let speed = 2.4;
let directionAngle = 0;

const { Engine, World, Bodies, Body } = Matter;
const engine = Engine.create();
const world = engine.world;
world.gravity.y = 0;
const playerBodies = {};

peer.on("open", id => {
  localPlayer.id = id;
  const roomId = prompt("Insira o ID da sala para se conectar ou deixe vazio para criar uma nova:");

  if (roomId) {
    connectToHost(roomId);
  } else {
    createRoomAsHost();
  }
});

function createRoomAsHost() {
  hostId = localPlayer.id;
  localPlayer.isHost = true;
  displayRoomId(localPlayer.id);

  players[localPlayer.id] = { x: localPlayer.x, y: localPlayer.y, id: localPlayer.id };
  
  playerBodies[localPlayer.id] = Bodies.circle(localPlayer.x, localPlayer.y, playerRadius, {
    restitution: 0.8,
    friction: 0.1,
    frictionAir: 0.05,
    label: localPlayer.id,
  });
  World.add(world, playerBodies[localPlayer.id]);

  peer.on("connection", connection => {
    connections.push(connection);
    connection.on("open", () => {
      connection.send({ type: "init", players, score });
    });

    connection.on("data", data => {
      handleHostData(data, connection);
    });

    connection.on("close", () => {
      const disconnectedPlayer = connections.find(c => c.peer === connection.peer);
      if (disconnectedPlayer) {
        connections.splice(connections.indexOf(disconnectedPlayer), 1);
        handleHostData({ type: "playerDisconnected", playerId: connection.peer });
      }
    });
  });
}

function connectToHost(hostRoomId) {
  const conn = peer.connect(hostRoomId);
  conn.on("open", () => {
    connections.push(conn);

    conn.send({ type: "newPlayer", player: { id: localPlayer.id, x: localPlayer.x, y: localPlayer.y } });

    conn.on("data", handleClientData);
  });

  conn.on("close", () => {
    alert("Você foi desconectado do host.");
    players = {};
  });
}

function handleHostData(data, connection) {
  switch (data.type) {
    case "newPlayer":
      players[data.player.id] = { x: data.player.x, y: data.player.y, id: data.player.id };
      addRemotePlayer(data.player);
      broadcast({ type: "updatePlayers", players });
      break;

    case "playerAction":
      const player = players[data.playerId];
      if (data.action === "move") {
        const body = playerBodies[data.playerId];
        if (body) {
          Body.setVelocity(body, { x: data.deltaX, y: data.deltaY });
          syncHostPositions();
        }
        broadcast({ type: "updatePlayers", players });
      }
      break;

    case "playerDisconnected":
      delete players[data.playerId];
      World.remove(world, playerBodies[data.playerId]);
      delete playerBodies[data.playerId];
      broadcast({ type: "updatePlayers", players });
      break;
  }
}

function handleClientData(data) {
  switch (data.type) {
    case "init":
      players = data.players;
      score = data.score;

      Object.values(players).forEach(player => {
        if (!playerBodies[player.id]) {
          addRemotePlayer(player);
        }
      });
      break;

    case "updatePlayers":
      players = data.players;

      Object.values(players).forEach(player => {
        const body = playerBodies[player.id];
        if (body) {
          Body.setPosition(body, { x: player.x, y: player.y });
        }
      });
      break;

    case "updateScore":
      score = data.score;
      break;
  }
}

function broadcast(data) {
  if (localPlayer.isHost) {
    connections.forEach(conn => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }
}

function sendPlayerAction(actionType, deltaX = 0, deltaY = 0) {
  if (localPlayer.isHost) {
    handleHostData({
      type: "playerAction",
      playerId: localPlayer.id,
      action: actionType,
      deltaX,
      deltaY,
    });
  } else {
    const conn = connections[0];
    if (conn && conn.open) {
      conn.send({ type: "playerAction", playerId: localPlayer.id, action: actionType, deltaX, deltaY });
    }
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

function addRemotePlayer(player) {
  if (!playerBodies[player.id]) {
    const body = Bodies.circle(player.x, player.y, playerRadius, {
      restitution: 0.8,
      friction: 0.1,
      frictionAir: 0.05,
      label: player.id,
    });
    playerBodies[player.id] = body;
    World.add(world, body);
  }
}

function syncHostPositions() {
  Object.values(players).forEach(player => {
    const body = playerBodies[player.id];
    if (body) {
      player.x = body.position.x;
      player.y = body.position.y;
    }
  });
}

function syncPlayers() {
  Object.values(players).forEach(player => {
    const body = playerBodies[player.id];
    if (body) {
      player.x = body.position.x;
      player.y = body.position.y;
    }
  });
}

canvas.addEventListener("touchmove", e => {
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;

  const deltaX = touchX - localPlayer.x;
  const deltaY = touchY - localPlayer.y;
  directionAngle = Math.atan2(deltaY, deltaX);

  const moveX = speed * Math.cos(directionAngle);
  const moveY = speed * Math.sin(directionAngle);

  const body = playerBodies[localPlayer.id];
  if (body) {
    Body.setVelocity(body, { x: moveX, y: moveY });
  }

  sendPlayerAction("move", moveX, moveY);
});

function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  Object.values(players).forEach(player => {
    ctx.beginPath();
    ctx.arc(player.x, player.y, playerRadius, 0, Math.PI * 2);
    ctx.fillStyle = player.id === localPlayer.id ? "green" : "blue";
    ctx.fill();
    ctx.closePath();
  });
}

(function gameLoop() {
  Engine.update(engine);
  syncPlayers();
  renderGame();
  requestAnimationFrame(gameLoop);
})();