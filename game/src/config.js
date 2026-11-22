// SHADOW PROTOCOL — shared tuning constants.
// One place for every number that shapes how the game feels, so balance
// changes never mean hunting through the other modules.
export const CONFIG = {
  TILE: 40,
  COLS: 32,
  ROWS: 20,
  WIDTH: 1280,
  HEIGHT: 800,

  // Movement (pixels per second)
  PLAYER_RUN: 168,
  PLAYER_SNEAK: 86,
  GUARD_PATROL: 58,
  GUARD_INVESTIGATE: 84,
  GUARD_CHASE: 138,
  DOG_PATROL: 74,
  DOG_CHASE: 176,

  // Vision cones
  CONE_RANGE: 205,
  CONE_ANGLE: (70 * Math.PI) / 180,
  DOG_CONE_RANGE: 125,
  DOG_CONE_ANGLE: (95 * Math.PI) / 180,
  CAMERA_RANGE: 215,
  CAMERA_ANGLE: (55 * Math.PI) / 180,

  // Detection meter: 0 = unseen, 0.55 = suspicious ("?"), 1 = alerted ("!")
  DETECT_BASE: 0.95, // per second, standing in a cone at mid range
  DETECT_CLOSE_MULT: 1.7, // point blank is much faster
  DETECT_SNEAK_MULT: 0.5, // sneaking buys time
  DETECT_DOG_MULT: 1.45,
  DETECT_CAMERA: 1.25,
  DETECT_DECAY: 0.55, // per second while unseen

  // Hearing
  NOISE_RUN_RADIUS: 140,
  NOISE_COIN_RADIUS: 250,
  NOISE_DOG_RADIUS: 210, // the dog hears running from far away
  NOISE_PULSE_EVERY: 0.3, // seconds between running noise pulses

  // Alarm: 0-100. Caught adds a chunk; 100 ends the mission.
  ALARM_CAUGHT: 30,
  ALARM_ALERT_RATE: 8, // per second while any guard is chasing
  ALARM_CAMERA_RATE: 10, // per second while a camera sees the player
  ALARM_DECAY: 1.5,

  // Interaction
  INTERACT_RADIUS: 52,
  CATCH_RADIUS: 26,
  HIDDEN_SPOT_RADIUS: 48, // guards must be this close to see a hidden player

  // Scoring
  LEVEL_BASE_SCORE: 1000,
  TIME_BONUS_PER_SEC: 10,
  COIN_BONUS: 50,
  DETECTION_PENALTY: 150,

  COLORS: {
    floorA: '#20242e',
    floorB: '#1b1f29',
    floorLine: '#262b38',
    wall: '#3a4152',
    wallTop: '#4d566e',
    shadow: '#0d1526',
    bush: '#1e4d2b',
    bushLeaf: '#2f7a44',
    grass: '#1a4020',
    grassBlade: '#69b455',
    grassBladeDark: '#3f8f46',
    grassDark: '#1d4d24',
    grassBladeLight: '#8fd07a',
    closet: '#5a4632',
    lampGlow: '#ffd98a',
    exit: '#39d98a',
    artifact: '#ffcf3f',
    keycard: '#39c5d8',
    document: '#f2f2e8',
    vault: '#8a93a8',
    player: '#e8e6df',
    playerSneak: '#9fb4d8',
    guard: '#ff5d5d',
    guardSuit: '#c93b3b',
    dog: '#8a6b4f',
    conePatrol: 'rgba(255, 214, 64, 0.20)',
    conePatrolEdge: 'rgba(255, 214, 64, 0.55)',
    coneSuspicious: 'rgba(255, 140, 40, 0.28)',
    coneSuspiciousEdge: 'rgba(255, 140, 40, 0.65)',
    coneAlerted: 'rgba(255, 60, 60, 0.32)',
    coneAlertedEdge: 'rgba(255, 60, 60, 0.75)',
    coneCamera: 'rgba(80, 200, 255, 0.20)',
    coneCameraEdge: 'rgba(80, 200, 255, 0.55)',
  },
};
