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
  if (e.key === "ArrowUp" && player.onground && Game.spawnProtection <= 0) {
    player.velY = -250; // jump strength
    player.onground = false;
    player.fallStartY = null; // reset fall start when jumping
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
    player.fallStartY = null; // reset fall start on reset
    Game.score = 0; // reset score
    Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles)); // restore collectibles
    updateHUD(Game.score, Game.lives, 1);
    Game.spawnProtection = 1; // freeze player for 1 second on manual reset
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
  gravity: 400,
  onground: false,
  lives: 3,
  hitObstacle: false,
  fallStartY: null // track starting height for bounce calculation
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
  spawnProtection: 0, // seconds remaining where player is frozen after spawn

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
    player.fallStartY = null; // reset fall start on start

    // Initialize game state
    this.score = 0;
    this.lives = 3;
    this.paused = false;
    this.levelCompleted = false;
    this.gameOver = false;
    this.spawnProtection = 1; // 1 second freeze on level start

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
    
    // Handle Y-axis collision separately to avoid multiple snaps
    if (axis === "y") {
      if (player.velY > 0) { // falling - find highest solid tile
        let maxY = -1;
        let maxTile = 0;
        for (let y = playerTop; y < playerBot; y++) {
          for (let x = playerLef; x < playerRig; x++) {
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const tile = tiles[y][x];
            if (tile === 1 || tile === 2 || tile === 3) {
              if (y > maxY) {
                maxY = y; // find the LOWEST (highest Y) solid tile
                maxTile = tile;
              }
            }
          }
        }
        if (maxY !== -1) {
          // If the tile we're landing on is an obstacle, trigger death
          if (maxTile === 2 && !player.hitObstacle) {
            const { spawn, tileSize: ts } = this.level;
            player.x = spawn.x * ts;
            player.y = spawn.y * ts;
            player.velX = 0;
            player.velY = 0;
            player.onground = false;
            player.fallStartY = null;
            Game.lives--;
            Game.score = 0;
            Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles));
            updateHUD(Game.score, Game.lives, 1);
            player.hitObstacle = true;
            if (Game.lives <= 0) {
              Game.gameOver = true;
            }
            Game.spawnProtection = 1; // freeze player for 1 second after respawn
            return;
          }

          // If the tile we're landing on is a bouncepad, launch upward strongly
          if (maxTile === 3) {
            player.y = maxY * tileSize - player.height; // snap to top of bouncepad
            player.velY = -350; // strong upward bounce
            player.onground = false;
            player.fallStartY = null;
            return;
          }

          player.y = maxY * tileSize - player.height; // snap to top of the lowest solid tile
          if (player.fallStartY !== null) {
            const heightFallen = player.fallStartY - player.y;
            const bounceVel = Math.min(80, -heightFallen * 9); // simple bounce calculation
            player.velY = -bounceVel;
            if (Math.abs(player.velY) < 2) {
              player.velY = 0;
              player.onground = true;
            } else {
              player.onground = false;
            }
            player.fallStartY = null;
          } else {
            player.velY = 0;
            player.onground = true;
          }
        }
      } else if (player.velY < 0) { // jumping - find lowest solid tile above
        let minY = 999;
        for (let y = playerTop; y < playerBot; y++) {
          for (let x = playerLef; x < playerRig; x++) {
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const tile = tiles[y][x];
            if (tile === 1 && y < minY) minY = y; // find the HIGHEST (lowest Y) solid tile that's not an obstacle
          }
        }
        if (minY !== 999) {
          player.y = (minY + 1) * tileSize;
          player.velY = 0;
        }
      }
      return; // Done with Y-axis, don't process tiles below
    }
    
    // Handle X-axis collision
    for (let y = playerTop; y < playerBot; y++) {
      for (let x = playerLef; x < playerRig; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const tile = tiles[y][x];
        if (tile === 1 || tile === 2) { // solid tile
          // Handle obstacle collision
          if (tile === 2 && !player.hitObstacle) {
            const { spawn, tileSize: ts } = this.level;
            player.x = spawn.x * ts;
            player.y = spawn.y * ts;
            player.velX = 0;
            player.velY = 0;
            player.onground = false;
            player.fallStartY = null;
            Game.lives--;
            Game.score = 0;
            Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles));
            updateHUD(Game.score, Game.lives, 1);
            player.hitObstacle = true;
            if (Game.lives <= 0) {
              Game.gameOver = true;
            }

            Game.spawnProtection = 1; // freeze player for 1 second after respawn
            return; // skip further collision processing this frame after hitting an obstacle
          }

          // 🔴 Obstacle check (works from any direction)
          if (tile === 2 && !player.hitObstacle) {

            const { spawn, tileSize: ts } = this.level;

            player.x = spawn.x * ts;
            player.y = spawn.y * ts;
            player.velX = 0;
            player.velY = 0;
            player.onground = false;
            player.fallStartY = null;

            Game.lives--;
            Game.score = 0;
            Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles));
            updateHUD(Game.score, Game.lives, 1);

            player.hitObstacle = true;

            if (Game.lives <= 0) {
              Game.gameOver = true;
          }

          return; // IMPORTANT: stop further collision processing
        }

          if (tile === 1) {
            if (axis === "x") {
              if (player.velX > 0) { // moving right
                player.x = x * tileSize - player.width;
              }
              else if (player.velX < 0) { // moving left
                player.x = (x + 1) * tileSize;
              }
              player.velX = 0;
            }

            if (axis === "y") {
              if (player.velY > 0) { // falling
                player.y = y * tileSize - player.height;
                player.velY = 0;
                player.onground = true;
                player.fallStartY = null; // reset fall start on landing
              }
              else if (player.velY < 0) { // jumping
                player.y = (y + 1) * tileSize;
                player.velY = 0;
              }
            }
          }

          if (axis === "x") {
            if (player.velX > 0) { // moving right
              player.x = x * tileSize - player.width;
            }
            else if (player.velX < 0) { // moving left
              player.x = (x + 1) * tileSize;
            }

            // Reverse vertical velocity (bounce)
            player.velY = -player.velY * 0.9; // simple bounce effect
            player.velX = 0;
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

    // Tick down spawn protection timer
    if (this.spawnProtection > 0) {
      this.spawnProtection = Math.max(0, this.spawnProtection - dt);
    }

    player.velX = 0; // reset horizontal velocity each frame

    if (this.spawnProtection <= 0) {
      if (input.isDown("ArrowRight")) {
        player.velX = player.speed;
      }
      if (input.isDown("ArrowLeft")) {
        player.velX = -player.speed;
      }
    }


    player.velY += player.gravity * dt; // apply gravity

    // Track fall start height
    if (player.velY > 0 && player.fallStartY === null) {
      player.fallStartY = player.y;
    }

    player.x += player.velX * dt;
    this.handleCcollision("x"); // handle collisions after horizontal movement
    player.y += player.velY * dt;
    this.handleCcollision("y"); // handle collisions after vertical movement

    // Check if player fell off the level
    if (player.y > this.level.height * this.level.tileSize) {
      player.velX = 0;
      player.velY = 0;
      player.onground = false;
      player.fallStartY = null; // reset fall start on fall off
      Game.score = 0; // reset score on fall
      Game.level.tiles = JSON.parse(JSON.stringify(Game.originalTiles)); // restore collectibles
      updateHUD(Game.score, Game.lives, 1);
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
          if (tile === 3) {
            ctx.fillStyle = "lime"; // bouncepad
            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            // Draw arrow to hint at bounce
            ctx.fillStyle = "darkgreen";
            const cx = x * tileSize + tileSize / 2;
            const cy = y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx - 6, cy + 6);
            ctx.lineTo(cx + 6, cy + 6);
            ctx.closePath();
            ctx.fill();
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

    //Draw player - flicker during spawn protection
    const isProtected = Game.spawnProtection > 0;
    const flicker = isProtected && Math.floor(performance.now() / 100) % 2 === 0;
    ctx.fillStyle = flicker ? "rgba(255,100,100,0.4)" : "red";
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
};

window.Game = Game; // expose Game globally

