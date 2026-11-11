# Spambot 2048 3D

A retro-styled browser game and Chrome extension where you play as your inbox address, dodging spam traffic and surviving the 3D cyber-mail corridor.

## Overview

Spambot 2048 3D is a fast, arcade-style runner built with HTML, CSS, and JavaScript. It presents a pseudo-3D perspective, lane-based dodging gameplay with an email-security theme, synthwave-inspired visuals, and a gritty CRT-terminal aesthetic.

The goal is simple: survive as long as possible, avoid incoming spam threats, and beat your previous high score.

## Features

- 3D-inspired lane runner gameplay
- Retro terminal / cyberpunk visual style
- Keyboard and touch controls
- Persistent local high score tracking
- Synth-based sound effects and ambient loop
- Chrome extension packaging with an installable manifest

## How to Run

Because this project is packaged as a Chrome extension, the easiest way to run it is:

1. Open Google Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this project folder: `Spambot-2048-3D`.
6. Click the extension icon to launch the game.

You can also open the project files directly in a browser for quick testing, though the extension flow is the intended setup.

## Controls

### Keyboard

- `A` / `Left Arrow`: move left
- `D` / `Right Arrow`: move right
- `W` / `Up Arrow` / `Space`: jump / action
- `S` / `Down Arrow`: duck / lower
- `E`, `Shift`, or `Enter`: action input

### Touch / Mobile

- Swipe left or right to change lanes
- Swipe up to jump / trigger action
- Swipe down to lower / duck
- Tap to perform a quick action

## Project Structure

```text
Spambot-2048-3D/
├── background.js
├── game.js
├── icons/
│   ├── spambot_icon_48x48.png
│   └── spambot_icon_128x128.png
├── manifest.json
├── popup.html
└── README.md
```

## Gameplay Notes

- The player moves through a three-lane corridor.
- Spam objects approach from the distance and must be dodged.
- Collision ends the run and presents the final score.
- High score data is stored in browser local storage.

## License

Covered under GPL-3 License

## Credits

This game was built as a browser-based arcade project with a cyber-security and spam-filter theme. It uses a retro-engineering aesthetic and custom JavaScript rendering to recreate a 3D corridor feel without a full 3D engine.
