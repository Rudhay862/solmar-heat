# Solmar Heat

[![Solmar Heat — gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
![Rank](https://make.fun/badge/gta6-01/Rudhay862/solmar-heat/rank.svg)
![Reward](https://make.fun/badge/gta6-01/Rudhay862/solmar-heat/reward.svg)

An original open-world crime game set in **Puerto Solmar**, a fictional sun-soaked
coastal city. Explore on foot and by car, steal cars, outrun the police, and run
deliveries for the city's fixers. Built for the
[Make GTA 6 bounty](https://make.fun/c/gta6-01) on make.fun.

Play it here: https://make.fun/r/dzgseakx

## What is in the game

- **A city to explore** — a procedural road grid with districts (Old Town, Downtown,
  Marina, Palm Heights, Central Plaza, Harbor Docks, Sunset Beach), a park, a plaza
  with a fountain, docks with piers and crates, and a beach with open water.
- **Driving** — arcade car physics with acceleration, steering, handbrake drifts and
  skid marks. Steal any parked car with **E**; traffic drives the roads around you.
- **On foot** — walk and run through the streets; pedestrians stroll the sidewalks.
- **Wanted level** — stealing a car, hitting a pedestrian or shooting someone
  raises the heat (0–5 stars). At wanted 1 and above police patrol cars chase you
  along the road grid and ram you. Wanted 3 brings a second patrol car, wanted 4
  parks a roadblock across the road ahead, and at wanted 3 and above the police
  shoot back at you on foot. Lay low and the heat cools off.
- **Missions** — press **M** to work for Marisol Vega, the city's fixer. A four-job
  story arc: a first delivery ($250), a timed delivery to the Marina in 75 seconds
  ($300), a getaway where you shake 2 stars and reach the Palm Heights safehouse
  ($350), and a three-package pickup chain ($400). After the arc, M hands out
  repeatable street jobs ($150–$300). The objective marker shows in the world and
  on the minimap; a failed timed job can be retried with M.
- **Combat** — on foot, **F** punches; after the first Marisol job you own a pistol
  (aim with the mouse, click or **J** to fire, with muzzle flash and tracers).
  Ammo is limited — green AMMO crates around the city restock it.
- **HUD + minimap** — cash, health, wanted stars, in-game clock, speed, the current
  objective, a live feed of events, and a minimap with roads, the player, police
  and the mission marker.
- **Save** — progress autosaves to the browser (cash, health, position, wanted
  level, mission). Continue with **C** on the title screen.
- **Sound** — synthesised only (WebAudio): engine hum that follows your speed,
  police siren, pickup blips and crash thuds. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive (W accelerate, S brake/reverse) |
| Shift | Run on foot |
| Space | Handbrake (drift) |
| E | Get in / out of a car |
| F | Punch (on foot) |
| J or mouse click | Fire the pistol (on foot, after the first Marisol job) |
| M | Take the next job from Marisol Vega |
| P / Esc | Pause |
| Enter | Start / restart |
| C | Continue saved game |

## How to run locally

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network
requests — the game is plain static files under `game/`.

## Screenshots

`screenshots/` holds renders of the game itself: the title screen over the living
city, driving through traffic with a wanted level, the delivery mission in
progress, and an on-foot police chase on Sunset Beach.

## Tech

Plain JavaScript ES modules, no libraries, no build step. One file per job:
`world.js` (city + pedestrians), `player.js` (on foot), `vehicles.js` (driving +
traffic), `police.js` (wanted level + road-following chase), `missions.js` (Marisol's
story arc + street jobs), `combat.js` (punch + pistol + police return fire),
`render.js` (top-down camera rendering), `hud.js` (HUD + minimap), `save.js`,
`audio.js` (synthesised sound), `shots.js` (deterministic screenshot scenes).
