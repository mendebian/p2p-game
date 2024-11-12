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
let speed = 2.4;  // Velocidade constante do jogador

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

  peer.on("connection", connection => {
    connections.push(connection);
    connection.on("open", () => {
      connection.send({ type: "init", players, score });
    });

    connection.on("data", data => {
      handleHostData(data, connection);
    });

    connection.on("close", () => {
      // Remove jogador desconectado
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

    // Envia os dados do jogador local para o host.
    conn.send({ type: "newPlayer", player: { id: localPlayer.id, x: localPlayer.x, y: localPlayer.y } });

    // Recebe dados centralizados do host.
    conn.on("data", handleClientData);
  });

  conn.on("close", () => {
    // O jogador foi desconectado do host.
    alert("Você foi desconectado do host.");
    players = {}; // Limpa o estado local.
  });
}

function handleHostData(data, connection) {
  switch (data.type) {
    case "newPlayer":
      // Adiciona novo jogador ao estado global e envia atualização para todos.
      players[data.player.id] = { x: data.player.x, y: data.player.y, id: data.player.id };
      broadcast({ type: "updatePlayers", players });
      break;

    case "playerAction":
      // Processa a ação enviada pelo jogador.
      const player = players[data.playerId];
      if (data.action === "move") {
        player.x += data.deltaX;
        player.y += data.deltaY;
        broadcast({ type: "updatePlayers", players });
      }
      break;

    case "playerDisconnected":
      // Remove jogador do estado global e envia atualização para todos.
      delete players[data.playerId];
      broadcast({ type: "updatePlayers", players });
      break;
  }
}

function handleClientData(data) {
  switch (data.type) {
    case "init":
      // Recebe o estado inicial do host.
      players = data.players;
      score = data.score;
      break;

    case "updatePlayers":
      players = data.players;
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
    // O host processa localmente suas próprias ações.
    handleHostData({
      type: "playerAction",
      playerId: localPlayer.id,
      action: actionType,
      deltaX,
      deltaY,
    });
  } else {
    const conn = connections[0]; // Apenas o host está conectado.
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

// Movimentos
let touchStartX, touchStartY;
canvas.addEventListener("touchstart", e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
});

canvas.addEventListener("touchmove", e => {
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;

  // Calcula o ângulo entre o ponto de toque e a posição do jogador
  const deltaX = touchX - localPlayer.x;
  const deltaY = touchY - localPlayer.y;
  const angle = Math.atan2(deltaY, deltaX);

  // Calcula os deltas de movimento baseados no ângulo e na velocidade
  const moveX = speed * Math.cos(angle);
  const moveY = speed * Math.sin(angle);

  // Atualiza a posição do jogador
  localPlayer.x += moveX;
  localPlayer.y += moveY;

  // Envia a atualização para o host ou processa localmente
  sendPlayerAction("move", moveX, moveY);

  touchStartX = touchX;
  touchStartY = touchY;
});

// Game loop apenas renderiza localmente os dados recebidos.
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
  renderGame();
  requestAnimationFrame(gameLoop);
})();