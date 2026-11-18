# SOLMAR BAY — an open-world crime game at golden hour

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/RieryBuild/makefun-gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/RieryBuild/makefun-gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A make.fun entry for the **gta6-01 "Make GTA 6"** bounty: an original
open-world crime game set in Solmar Bay, a sunset coastal city. Dana Vega
has to save Rosa's garage from the Dockside Kings — five story missions,
$50,000 on the line, and the SBPD on her tail the whole way. This is the v2
rebuild: the story and systems from the first entry, with the art layer
rebuilt from the ground up.

## The rebuild

The first version played well but looked like a flat Flash web game — block
characters, boxy cars, a noon sun with no shadows to speak of. The v2
rebuild is about depth:

- **Golden-hour lighting** — a low warm sun, long shadows, a gradient sky
  that runs violet to pink to gold, and fog that lets the skyline layer
  itself into foreground, midground and background.
- **A city with elevation** — beach dunes in the south, hills to the west
  and north, raised roads, and buildings from two-storey walkups to
  sixteen-storey towers so the skyline is never a flat wall.
- **People, not blocks** — proportioned humanoids built from capsules,
  cylinders and spheres, with faces, hair, clothing and a full walk/run
  cycle; the player, the cops, the Kings and the crowd all share the rig.
- **Modelled vehicles** — hoods, glass cabins, wheels with hubs, lights,
  mirrors, spoilers and a police cruiser with a light bar and livery.
- **Real geometry everywhere** — palms with drooping fronds, a ferris wheel
  on the boardwalk, piers and boats, cranes and containers at the docks,
  lamps, benches, hydrants and traffic lights on every corner — and a
  coral-and-white lighthouse at the end of the middle pier, closing the
  east–west boulevard with a landmark the whole city can see.

## What's in the game

- **Five story missions** — delivery, car theft, a dock shootout, a
  three-star getaway and a final showdown with the Kings' boss, Kane —
  with dialogue, a waypoint beacon and stage progress on the HUD.
- **Open-world driving and combat** — on-foot movement and arcade driving
  with handbrake drifts and near-miss bonuses, a rifle with reload and
  aim, tracers and muzzle flash.
- **A 1–5 star wanted system** — SBPD cruisers that ram, officers on foot
  who arrest, and a helicopter with a spotlight from three stars up, with
  a live response list naming every unit.
- **A living city** — traffic that brakes and respawns, pedestrians who
  stroll and flee, a day clock starting at 17:24, three invented radio
  stations, ten Sunset Postcards to collect, armour vests to pick up, and
  a reputation system (REP 1 "New in Town" up to REP 6 "Solmar Legend")
  that grows as Dana works.
- **BUSTED and WASTED** — hospital and police-station respawns with fines,
  plus autosave to localStorage every 30 seconds and on mission completion.

## Controls

WASD move / drive · Mouse look · Left-click shoot · Right-click aim ·
E interact · R reload · Space handbrake · Shift run · N next radio station ·
M mute · P pause.

## Run it

```
node serve.ts
```

Then open http://localhost:8080. The game is static files under `game/`
and plays with no network request — Three.js r147 is vendored at
`game/vendor/three.min.js`, and all textures and sounds are generated in
code (procedural canvas textures, synthesized WebAudio).

Screenshots are staged by the game's own code: `?shot=chase|city|mission|combat`
plays a seeded autopilot forward and freezes one frame of real play.

## Layout

`game/src/` is split into one-job modules: `settings.js` (tuning and the
sunset palette), `terrain.js` (heightfield, sky, sea, lights), `skyline.js`
(buildings and colliders), `props.js` (palms, wheel, piers, street props),
`humanoid.js` and `automobile.js` (the character and vehicle models),
`hero.js` (player + camera), `heat.js` (wanted + police), `gunplay.js`,
`story.js`, `traffic-flow.js`, `crowd.js`, `postcards.js`, `interface.js`
(HUD), `radar.js` (minimap), `soundscape.js`, `persistence.js`,
`staging.js` (?shot= scenes), `engine.js` (the game) and `boot.js` (entry).

Everything here is original work for this bounty — no names, characters,
maps, art or music from any commercial game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wa8s3t3t&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
