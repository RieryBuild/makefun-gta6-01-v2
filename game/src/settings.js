// SOLMAR BAY v2 — the numbers every system agrees on.
// One job: layout, tuning and the sunset look, in one place, so the city,
// the traffic, the police, the missions and the camera all share one map
// and one golden hour. Nothing here draws anything; it only declares.

// ---- The map: an 8x8 street grid on a coastal shelf (metres, origin = city centre) ----
export const STREET_PITCH = 48;   // centreline to centreline of parallel streets
export const STREET_WIDTH = 14;   // asphalt width
export const BLOCK_LO = -4;       // block indices BLOCK_LO..BLOCK_HI, city spans -192..192
export const BLOCK_HI = 3;
export const CITY_HALF = 192;     // half-width of the built-up city
export const WORLD_HALF = 330;    // half-width of the ground plane + sea
export const STREET_LINES = [-144, -96, -48, 0, 48, 96, 144]; // street centrelines

// A block (bx, bz) spans x in [bx*48+7, (bx+1)*48-7]; its middle is bx*48+24.
export function blockMiddle(bx, bz) {
  return { x: bx * STREET_PITCH + STREET_PITCH / 2, z: bz * STREET_PITCH + STREET_PITCH / 2 };
}

// ---- Landmark addresses (x, z) ----
export const GARAGE = { x: -24, z: -24 };            // Rosa's garage, the story hub
export const GARAGE_APRON = { x: -24, z: -38 };      // forecourt in front of the workshop
export const HOSPITAL_DOOR = { x: -72, z: -134 };    // respawn after WASTED
export const STATION_DOOR = { x: -120, z: 134 };     // respawn after BUSTED
export const DOCKS = { x: 184, z: 0 };               // east piers, Kings territory
export const HIDEOUT = { x: 150, z: 150 };           // beach house, getaway goal
export const BEACH_LOT = { x: 8, z: 148 };           // where the Kings park their prize
export const WAREHOUSE_PICKUP = { x: 168, z: -48 };  // m1 crate
export const SPAWN_POINT = { x: -24, z: -48 };       // first step: on the road by the garage

// ---- Golden hour: the light that makes the city read as a place, not a diagram ----
export const SUNSET = {
  sunColor: 0xff9a4d,        // low amber sun
  sunIntensity: 2.4,
  sunElevation: 0.30,        // radians above the horizon — long shadows
  sunAzimuth: -2.35,         // out over the west sea, so the city glows sideways
  skyZenith: 0x3d2b5c,       // violet dusk overhead
  skyMid: 0xc65a7a,          // rose band
  skyHorizon: 0xffb36b,      // amber at the horizon
  fogColor: 0xe08a68,        // warm haze that swallows the far skyline
  fogNear: 110,
  fogFar: 430,
  hemiSky: 0x9a7ab0,         // violet bounce from the sky
  hemiGround: 0x8a5f43,      // warm bounce from the streets
  hemiIntensity: 0.85,
  exposure: 1.15,
  seaColor: 0x274b73,        // deep blue sea catching the sunset
  sandColor: 0xe3c98f,
};

// Stucco + paint palettes for the facades (a warm coastal city, no two streets alike).
export const FACADE_SETS = [
  { base: '#f0dcc0', trim: '#cbb28c', glass: '#5d7f9e' },
  { base: '#f2cdb4', trim: '#d9a586', glass: '#4f7390' },
  { base: '#d9e2c2', trim: '#b3c298', glass: '#5d7f9e' },
  { base: '#eeb9b0', trim: '#d18f87', glass: '#46667f' },
  { base: '#c4d3e6', trim: '#9db2cc', glass: '#3f5f7d' },
  { base: '#e9dfc8', trim: '#cdbb96', glass: '#6d8fa8' },
  { base: '#e8c9a0', trim: '#c9a26e', glass: '#54708a' },
  { base: '#d8c8de', trim: '#b39ec2', glass: '#5d7f9e' },
];

// ---- Terrain: gentle shelf, beach dunes, hills hemming the west and north ----
export const TERRAIN = {
  duneStart: 196,      // south beach dunes begin here (z > duneStart)
  duneHeight: 1.4,
  hillStart: 212,      // hills rise beyond this |x| / |z|
  hillWest: 15,        // west ridge height
  hillNorth: 11,       // north ridge height
  seaFloor: -2.5,      // ground under the eastern sea
};

// ---- Reputation: the street learns Dana's name as she works ----
// Solmar Bay's own ranks — earned by finishing missions, driving hard and
// finding postcards. The HUD shows the level, the rank name and the bar to
// the next rank.
export const REP_RANKS = [
  { level: 1, name: 'NEW IN TOWN', at: 0 },
  { level: 2, name: 'STREET KNOWN', at: 250 },
  { level: 3, name: 'GARAGE REGULAR', at: 600 },
  { level: 4, name: 'BAY RUNNER', at: 1100 },
  { level: 5, name: 'DOCKSIDE NAME', at: 1800 },
  { level: 6, name: 'SOLMAR LEGEND', at: 2800 },
];
export const REP_AWARDS = { mission: 150, nearMiss: 25, drift: 25, postcard: 50 };

// ---- Armour vests: pickup spots that refill Dana's vest ----
export const ARMOUR_PICKUPS = [
  { x: -30, z: -38, name: "Rosa's Garage" },
  { x: -72, z: -128, name: 'Solmar General' },
  { x: 176, z: 24, name: 'The Docks' },
];
export const ARMOUR_MAX = 100;
export const ARMOUR_PICKUP_VALUE = 50;

// ---- The lighthouse: Solmar Bay's signature landmark ----
export const LIGHTHOUSE = { x: 254, z: 0 }; // end of the middle pier, closing the z=0 boulevard

// ---- The hero ----
export const HERO = {
  walk: 5.4,
  run: 9.0,
  maxHealth: 100,
  startCash: 250,
  regenDelay: 8,       // quiet seconds before health returns
  regenRate: 2.5,      // health per second
  eyeHeight: 1.62,
};

// ---- Driving ----
export const DRIVE = {
  accel: 15,
  brake: 28,
  topSpeed: 36,        // m/s, ~130 km/h
  reverse: 11,
  steerRate: 2.0,      // rad/s at full lock
  drag: 0.55,
  handbrakeGrip: 0.35, // grip left while the handbrake is held
};

// ---- The rifle ----
export const RIFLE = {
  mag: 12,
  damage: 34,
  range: 95,
  interval: 0.16,      // seconds between shots
  reload: 1.4,
};

// ---- Heat: the SBPD response ----
export const HEAT = {
  maxStars: 5,
  decayDelay: 18,      // unseen seconds before a star drops
  spawnRange: 70,
  arrestHold: 2.5,     // seconds an officer must stay close to cuff Dana
  bustedFine: 200,
  wastedFine: 150,
  heliStars: 3,        // the helicopter joins at 3 stars
};

// ---- The living city ----
export const CITY_LIFE = {
  traffic: 14,
  trafficSpeed: 9,
  peds: 26,
  pedWalk: 1.4,
  pedFlee: 4.4,
};

// ---- The story ----
export const TITLE = 'SOLMAR BAY';
export const SUBTITLE = 'a sun-soaked open-world crime story';
export const HERO_NAME = 'Dana Vega';
export const GOAL_CASH = 50000;   // the garage's protection bill. Mission rewards
// (800 + 1500 + 2500 + 3000 + 42000) plus $250 start cash land Dana at
// $50,050 — the goal is reachable by finishing the story.
export const POSTCARD_REWARD = 200;
export const INTRO =
  'Dana Vega drives courier runs out of Rosa\u2019s garage on Marlin Street. ' +
  'The Dockside Kings want the garage — fifty thousand dollars of "protection" ' +
  'or they burn it down. Dana has one week, one rusty van, and no intention of paying.';
export const SAVE_KEY = 'solmar-bay-save-v2';
export const DEFAULT_SEED = 1;

// ---- Camera: low and close, so Dana is LARGE in frame ----
export const CAMERA = {
  onFootDist: 3.9,
  onFootHeight: 1.9,
  onFootShoulder: 0.5,   // over-the-shoulder offset while aiming
  driveDist: 7.8,
  driveHeight: 3.1,
  fov: 60,
  driveFov: 66,
  fovKick: 7,            // extra FOV at top speed
};
