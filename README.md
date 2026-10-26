# 🤖 Googly Mechs

Build a robot mech with googly eyes, then watch it fight all by itself. 2 to 4 teams, on one device or online with a room code.

## How to play

Each team builds a mech:

- **Pick a body:** 🕷️ Spider (fast and small, but fragile), 🤖 Humanoid (its arms shoot and swing 20% faster), or 🐕 4-Legged (slow, but very tough).
- **Spend 10 bolts on power-ups,** each with 3 levels. Level 1 costs 1 bolt, level 2 costs 2 more, level 3 costs 3 more.
  - 🛡️ **Armor:** take 20%, 35% or 55% less damage.
  - 🔫 **Gun:** every mech has a little blaster. Upgrades make it faster and stronger, and level 3 has two barrels.
  - 🗡️ **Melee:** a giant sword that hits hard up close and knocks enemies back.
  - 📏 **Size:** bigger mechs have more health and longer swords, but they're slower and easier to hit.

Then the mechs fight on their own. Sword mechs charge in, and gun mechs keep their distance and circle. The last mech standing wins. After 90 seconds, the mech with the most health left wins.

## Files

- `index.html`: the page and styles.
- `mechs.js`: the parts, the fight, the drawing and online rooms. Online games use Firebase (`googlymechs/rooms/<CODE>`). Only the builds and a random seed are shared, and every device works out the same fight from them.
