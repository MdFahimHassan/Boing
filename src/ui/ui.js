document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  const startScreen = document.getElementById("start-screen");
  const hud = document.getElementById("hud");

  startBtn.addEventListener("click", () => {
    console.log("Game Started!");
    startScreen.classList.add("hidden");
    hud.classList.remove("hidden");

    // Load level + start game loop
    fetch("src/levels/level01.json")
      .then(res => res.json())
      .then(levelData => {
        Game.level = levelData;   // store level data
        Game.start();             // start the loop
      })
      .catch(err => console.error("Error loading level:", err));
  });
});

// Example function to update HUD
function updateHUD(score, lives, level) {
  document.getElementById("score").textContent = `Score: ${score}`;
  document.getElementById("lives").textContent = `Lives: ${lives}`;
  document.getElementById("level").textContent = `Level: ${level}`;
}
