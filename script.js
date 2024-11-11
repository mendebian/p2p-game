const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const playerRadius = 20;
let players = {};
let localPlayer = { x: canvas.width / 2, y: canvas.height / 2, id: null };
let peer = new Peer();
let connections = [];

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
  const input = document.createElement("input");
  input.value = localPlayer.id;
  input.readOnly = true;
  input.style.position = "absolute";
  input.style.top = "20px";
  input.style.left = "20px";
  document.body.appendChild(input);

  peer.on("connection", connection => {
    connection.on("data", updatePlayers);
    connection.send({ id: localPlayer.id, x: localPlayer.x, y: localPlayer.y });
    connections.push(connection);
  });
}

function connectToRoom(roomId) {
  const conn = peer.connect(roomId);
  conn.on("open", () => {
    conn.on("data", updatePlayers);
    conn.send({ id: localPlayer.id, x: localPlayer.x, y: localPlayer.y });
    connections.push(conn);
  });
}

function updatePlayers(data) {
  players = data.players;
}

function sendUpdate() {
  connections.forEach(conn => {
    if (conn.open) {
      conn.send({ players });
    }
  });
}

function checkCollisionsLocally() {
  const playerIds = Object.keys(players);

  playerIds.forEach(id => {
    if (id !== localPlayer.id) {
      const otherPlayer = players[id];
      const dx = otherPlayer.x - localPlayer.x;
      const dy = otherPlayer.y - localPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 2 * playerRadius) {
        const angle = Math.atan2(dy, dx);
        const overlap = 2 * playerRadius - distance;
        const pushStrength = 0.2 * overlap;
        const pushX = Math.cos(angle) * pushStrength;
        const pushY = Math.sin(angle) * pushStrength;

        localPlayer.x -= pushX;
        localPlayer.y -= pushY;
        otherPlayer.x += pushX;
        otherPlayer.y += pushY;

        players[localPlayer.id] = { x: localPlayer.x, y: localPlayer.y };
        players[id] = { x: otherPlayer.x, y: otherPlayer.y };
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
    ctx.fillStyle = "blue";
    ctx.fill();
    ctx.closePath();
  });

  sendUpdate();
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

function gameLoop() {
  renderGame();
  requestAnimationFrame(gameLoop);
}

gameLoop();