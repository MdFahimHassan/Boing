// Everything that defines how the game *feels*. Tweak here.
export const TILE = 48; // px per tile
export const R = 17; // ball radius
export const DT = 1 / 120; // fixed physics step

export const P = {
  gravity: 1800,
  maxFall: 1250,
  speed: 270, // max run speed
  accel: 2600,
  decel: 1500,
  hop: 330, // idle bounce speed (small hops)
  jump: 705, // full jump speed
  rest: 0.52, // fraction of impact speed kept when landing without jumping
  maxBounce: 600,
  padLaunch: 1080,
  stompBounce: 560,
  wallRestitution: 0.25,
  coyote: 0.11, // pressing jump this soon after a bounce still counts
  jumpBuffer: 0.14, // pressing jump this soon before landing still counts
  waterGravity: 0.28,
  waterSpeed: 0.7,
  swimAccel: 2600,
  swimMaxUp: 250,
  waterDrag: 2.4,
  deathTime: 1.1,
  invuln: 1.6,
  enemySpeed: 55,
};

export const CRUMBLE = { shake: 0.45, gone: 2.6 };
