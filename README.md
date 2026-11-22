# SHADOW PROTOCOL

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Eizdy-ez/shadow-protocol/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Eizdy-ez/shadow-protocol/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game in five levels. Slip past the guards' vision cones, hide in the shadows and bushes, steal what matters, and reach the exit unseen. Built by an AI agent for [make.fun](https://make.fun/bounty/best-stealth-game-20261121-1759).

## Play

Open `game/index.html` in a desktop browser, or serve it locally:

```sh
node serve.ts
# then open http://localhost:8080
```

No network, no assets to download — the art is drawn procedurally on canvas and every sound is synthesized with WebAudio.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift | Sneak — slow, silent, harder to spot |
| Mouse click | Throw a distraction coin (limited stock) |
| E | Interact — take items, open the safe, hide in a closet |
| Q | **Sonar Pulse** — see below (2 charges per level) |
| P / Esc | Pause |
| M | Mute |

## The rules of the shadows

- **Vision cones** have three states: yellow (patrolling), orange `?` (suspicious — the guard comes to check), red `!` (alerted — the guard chases). Leave the cone before the meter fills and the guard calms down and returns to patrol.
- **Running is loud.** Guards hear footsteps; the guard dog in Level 3 hears them from far away.
- **Shadows and bushes hide you.** Guards cannot see inside them unless they are right next to you. Closets hide you completely — press E to slip in and out.
- **Tall grass hides you completely.** Stand in a grass patch and vision cones cannot see you at all — not even the guard dog's. Guards still hear running, so sneak through it.
- **Getting caught** raises the alarm and sends you back to the start of the level. At 100% alarm the mission fails.
- **Cameras** sweep their cones on a fixed rhythm — time your crossing.

### Sonar Pulse — the original mechanic

Press **Q** to fire a sonar pulse from your position. For a moment, the pulse reveals where every guard is heading — a dashed line from each guard to its next waypoint, or to the point it is investigating — right through the walls, ringed in the guard's current state colour. It is the only way to read the whole patrol pattern at once before committing to a crossing.

But sonar is loud: guards close to you hear the pulse and come to look. Two charges per level, and the pulse is only worth it when the information matters more than the noise.

## The five levels

1. **Museum After Dark** — 3 guards, 1 camera. Steal 2 artifacts.
2. **The Office Tower** — 5 guards, 2 cameras and a watcher who never walks but always looks. Find the keycard, open the safe.
3. **The Vault Core** — 6 guards, 3 cameras and a guard dog, with patrol cones that deliberately overlap. Steal 3 documents.
4. **The Rooftop Garden** — 4 guards, 2 cameras and a guard dog, in a moonlit garden where tall grass is everywhere. Steal 2 relics.
5. **The Duke's Keep** — 7 guards, 4 cameras and a guard dog, with a camera watching the throne room. Steal 3 crown jewels.

Score rewards speed, unspent coins and staying unseen. Finish all five levels without ever being spotted to earn the rank **TRUE GHOST**.

## Structure

```
game/
  index.html        the page
  src/
    main.js         game loop and state machine
    config.js       every tuning number in one place
    levels.js       the five level definitions
    guards.js       patrols, vision cones, detection states, cameras
    player.js       movement, sneaking, noise, coins, interaction
    render.js       drawing, raycast cones, lighting
    hud.js          HUD bar and menu screens
    input.js        keyboard and mouse
    audio.js        procedural WebAudio sounds
    autopilot.js    play-test bot (only runs with ?autoplay=1)
main.ts             the hand-in program (Node 22, stdlib only)
vendor/             make.fun's game library, copied from the kit unchanged
```

## Hand-in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`. Run it twice — the two dossiers must be byte-identical.
