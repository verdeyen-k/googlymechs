# 🤖 Googly Mechs

Build a robot mech with googly eyes, then watch it fight all by itself. 2 to 4 teams, on one device or online with a room code.

## How to play

Each team builds a mech:

- **Pick a body:** 🕷️ Spider (fast and small, but fragile), 🤖 Humanoid (its arms shoot and swing 20% faster), or 🐕 4-Legged (slow, but very tough).
- **Spend 12 bolts on power-ups,** each with 3 levels. Level 1 costs 1 bolt, level 2 costs 2 more, level 3 costs 3 more.
  - 🛡️ **Armor:** take 20%, 35% or 55% less damage.
  - 🔫 **Gun:** every mech has a little blaster. Upgrades make it faster and stronger, and level 3 has two barrels.
  - 🗡️ **Melee:** a giant sword that hits hard up close and knocks enemies back.
  - 📏 **Size:** bigger mechs have more health and longer swords, but they're slower and easier to hit.
  - 🎯 **Targeting:** the gun aims ahead of moving enemies, at where they'll be when the shot gets there, and shoots steadier. The higher the level, the better it leads them. Level 3 leads them perfectly.
  - 🧠 **Intelligence:** the mech fights smarter. Level 1 picks on hurt enemies, and gun mechs run from swords (without getting stuck in corners) and step out from behind pillars. Level 2 also dodges bullets. Level 3 dodges like a ninja, and sword mechs zigzag when charging at a gun.

The map is shown while you build, so you can build for it. Online, the host picks the map (or 🎲 for a random one). On one device, the first team picks it before anyone is ready. Changing the map un-readies everyone so they can change their builds. The maps:

- 🏟️ **Open Arena:** lots of room to run around.
- 🟤 **Mud Pit:** mud slows spiders down a lot, humanoids a bit, and 4-legged mechs hardly at all.
- 🗿 **Pillars:** stone pillars block bullets, so sword mechs can sneak up.
- ⛓️ **The Cage:** a small fenced-in arena with nowhere to run.
- 🧱 **Close Corners:** every mech starts in a small walled-in corner room with a door, with mud in the middle. Best for 4-legged mechs.

The fight itself: Sword mechs charge in, and gun mechs keep their distance and circle. The last mech standing wins. After 90 seconds, the mech with the most health left wins.

## Files

- `index.html`: the page and styles.
- `mechs.js`: the parts, the fight, the drawing and online rooms. Online games use Firebase (`googlymechs/rooms/<CODE>`). Only the builds and a random seed are shared, and every device works out the same fight from them.
