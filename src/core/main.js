const canvas = document.getElementById("gameCanvas");
if (!canvas) {
  console.error("Canvas element not found! Make sure #gameCanvas exists in HTML.");
}
const ctx = canvas?.getContext("2d");

// Simple input handler
const input = {
  keys: {},
  isDown(key) {
    return this.keys[key] || false;
  }
};

document.addEventListener("keydown", (e) => {
  input.keys[e.key] = true;

  // Jump on Up Arrow key press
  if (e.key === "ArrowUp" && player.onground) {
    player.velY = -350; // jump strength
    player.onground = false;
  }

  // Reset level on R key press
  if (e.key === "r" || e.key === "R") {
    const { spawn, tileSize } = Game.level;
    player.x = spawn.x * tileSize;
    player.y = spawn.y * tileSize;
    player.velX = 0;
    player.velY = 0;
    player.onground = false;
    player.hitObstacle = false;
    Game.score = 0; // reset score
    Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles)); // restore collectibles
    updateHUD(Game.score, Game.lives, 1);
  }
});

document.addEventListener("keyup", (e) => {
  input.keys[e.key] = false;
});

const player = { // player properties
  x: 100,
  y: 100,
  width: 32,
  height: 32,
  velX: 0,
  velY: 0,
  speed: 200,
  gravity: 800,
  onground: false,
  lives: 3,
  hitObstacle: false
};

const DEFAULT_LEVEL = {
  levelId: 1,
  levelName: "Test Level",
  tileSize: 32,
  width: 10,
  height: 6,
  spawn: { x: 0, y: 4 },
  tiles: [
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,2,0,0,0,4,0],
    [1,1,1,1,1,1,1,1,1,1]
  ]
};

const Game = {
  lastTime: 0,
  deltaTime: 0,
  level: null, // store level data here
  score: 0,
  lives: 3,
  originalTiles: null, // store original tile map
  paused: false, // pause state
  levelCompleted: false, // level completion state
  gameOver: false, // game over state

  async loadLevel(path) {
    // attempt fetch, fall back to default if network fails (e.g. file://)
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn(`Unable to load level from ${path}, using default.`, err);
      return DEFAULT_LEVEL;
    }
  },

  start() {
    if (!this.level) {
      console.error("Game.start() called without level data. Aborting.");
      return;
    }

    // Position player at spawn point (convert tile coords to pixels)
    const { spawn, tileSize } = this.level;
    player.x = spawn.x * tileSize;
    player.y = spawn.y * tileSize;
    player.velX = 0;
    player.velY = 0;
    player.onground = false;
    player.hitObstacle = false;

    // Initialize game state
    this.score = 0;
    this.lives = 3;
    this.paused = false;
    this.levelCompleted = false;
    this.gameOver = false;

    // Update HUD
    updateHUD(this.score, this.lives, 1);

    // Canvas is now visible when game starts
    canvas.style.display = "block";
    
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  },

  loop(timestamp) {
    this.deltaTime = Math.min((timestamp - this.lastTime) / 1000, 1/30); // cap deltaTime to prevent large jumps
    this.lastTime = timestamp;

    if (!this.paused && !this.levelCompleted && !this.gameOver) {
      this.update(this.deltaTime);
      this.render();
    } else {
      this.render(); // still render to show completion or game over message
    }

    requestAnimationFrame(this.loop.bind(this));
  },

  handleCcollision(axis) {
    if (!this.level) return;

    const {tiles, tileSize, width, height} = this.level;

    const playerLef = Math.floor(player.x / tileSize);
    const playerRig = Math.ceil((player.x + player.width) / tileSize);
    const playerTop = Math.floor(player.y / tileSize);
    const playerBot = Math.ceil((player.y + player.height) / tileSize);
    
    for (let y = playerTop; y < playerBot; y++) {
      for (let x = playerLef; x < playerRig; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue; // out of bounds

        const tile = tiles[y][x];
        if (tile === 1 || tile === 2) { // solid tile
          if (axis === "x") {
            if (player.velX > 0) { // moving right
              player.x = x * tileSize - player.width; // snap to left of tile
            }
            else if (player.velX < 0) { // moving left
              player.x = (x + 1) * tileSize; // snap to right of tile
            }
            player.velX = 0; // stop horizontal movement
          }
          else if (axis === "y") {
            if (player.velY > 0) { // falling
              player.y = y * tileSize - player.height; // snap to top of tile
              player.velY = 0; // stop vertical movement
              player.onground = true; // player is on the ground
            }
            else if (player.velY < 0) { // jumping
              player.y = (y + 1) * tileSize; // snap to bottom of tile
              player.velY = 0; // stop upward movement
            }
          }
        }

        // Handle obstacle collision (tile 2)
        if (tile === 2 && !player.hitObstacle) {
          const { spawn, tileSize } = this.level;
          player.x = spawn.x * tileSize;
          player.y = spawn.y * tileSize;
          player.velX = 0;
          player.velY = 0;
          player.onground = false;
          Game.lives--;
          Game.score = 0; // reset score on hit
          Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles)); // restore collectibles
          updateHUD(Game.score, Game.lives, 1);
          player.hitObstacle = true;
          if (Game.lives <= 0) {
            Game.gameOver = true;
          }
        }

        // Handle collectible collision (tile 4) - now acts as goal
        if (tile === 4 && !Game.levelCompleted) {
          Game.levelCompleted = true;
          tiles[y][x] = 0; // remove goal
        }
      }
    }
  },

  update(dt) {

    player.hitObstacle = false; // reset flag each frame

    player.velX = 0; // reset horizontal velocity each frame

    if (input.isDown("ArrowRight")) {
      player.velX = player.speed;
    }
    if (input.isDown("ArrowLeft")) {
      player.velX = -player.speed;
    }


    player.velY += player.gravity * dt; // apply gravity
    player.x += player.velX * dt;
    this.handleCcollision("x"); // handle collisions after horizontal movement
    player.y += player.velY * dt;
    this.handleCcollision("y"); // handle collisions after vertical movement

    // Check if player fell off the level
    if (player.y > this.level.height * this.level.tileSize) {
      const { spawn, tileSize } = this.level;
      player.x = spawn.x * tileSize;
      player.y = spawn.y * tileSize;
      player.velX = 0;
      player.velY = 0;
      player.onground = false;
      Game.lives--;
      Game.score = 0; // reset score on fall
      Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles)); // restore collectibles
      updateHUD(Game.score, Game.lives, 1);
      if (Game.lives <= 0) {
        Game.gameOver = true;
      }
    }
  },

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.levelCompleted) {
      ctx.fillStyle = "white";
      ctx.font = "30px monospace";
      ctx.fillText("Level Complete!", canvas.width / 2 - 100, canvas.height / 2);
      return;
    }

    if (this.gameOver) {
      ctx.fillStyle = "white";
      ctx.font = "30px monospace";
      ctx.fillText("Game Over!", canvas.width / 2 - 80, canvas.height / 2);
      return;
    }

    if (this.level) {
      const { tiles, tileSize, width, height } = this.level;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const tile = tiles[y][x];
          if (tile === 1) {
            ctx.fillStyle = "brown"; // ground
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
          if (tile === 2) {
            ctx.fillStyle = "blue"; // obstacle
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
          if (tile === 4) {
            ctx.fillStyle = "yellow"; // collectible
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
          }
        }
      }
    }

    ctx.fillStyle = "white";
    ctx.font = "20px monospace";
    ctx.fillText("Platformer Skeleton Running", 20, 40);

    //Draw player
    ctx.fillStyle = "red";
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
};

window.Game = Game; // expose Game globally

