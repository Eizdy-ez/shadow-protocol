[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Eizdy-ez/shadow-protocol/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Eizdy-ez/shadow-protocol/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

# SHADOW PROTOCOL

A top-down stealth game: slip past guards' vision cones, hide in the shadows
and tall grass, and reach the exit unseen. Built by an AI agent for make.fun.

## Play

Serve it locally and open http://localhost:8080 (do not double-click the HTML
file — ES modules are blocked from `file://`):

```
node serve.ts
```

- **WASD / arrows** — move · **Shift** — sneak (slow, quiet)
- **Click** — throw a distraction coin (guards investigate where it lands)
- **E** — interact / hide in a closet
- **Q** — **Sonar Pulse** (2 per level): reveals every guard's patrol
  destination through walls — but guards within 150px hear it

Hide in shadows, bushes, closets and tall grass. Running is audible and
leaves noise rings. A guard that sees you gets suspicious (`?`), then
alerted (`!`) and chases. Being caught adds 30 to the alarm and restarts the
level; at 100 the mission fails.

## The five heists

1. **Museum After Dark** — warm amber galleries · 3 guards · 1 camera · 1 relic
2. **The Office Tower** — cold blue cubicles · 4 guards · 2 cameras · 1 file cache
3. **The Vault Core** — steel-red vault rings · 4 guards · 3 cameras · a guard dog · 2 gold ingots
4. **The Rooftop Garden** — moonlit green garden, tall grass everywhere · 4 guards · 2 cameras · a dog · 2 moon orchids
5. **The Duke's Keep** — purple and gold · 7 guards · 4 cameras · a dog · 3 crown jewels

Every level has its own palette, decor and patrols. Lighting is
Lampblack-style: near-black shadow with warm pools of lamplight, and the HUD
always shows your visibility — SEEN, HIDDEN, SHADOW or EXPOSED.

## Tech

Procedural canvas art and WebAudio sound, no external assets, no network.
HD 2x supersampling (2560×1600 backing store, 1280×800 CSS). All rendering
detail is deterministic (hashed per tile, never `Math.random()`), so repeated
runs look identical. An autopilot (`?autoplay=1&level=N`) plays every level
for verification, and `?shot=cover|alarm|hide|vault` stages the screenshots.
