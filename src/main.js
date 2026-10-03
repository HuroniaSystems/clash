import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import { Game } from './game.js';
import { sound } from './audio/sound.js';

for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true });
}

const game = new Game({
  viewport: document.getElementById('viewport'),
  overlay: document.getElementById('overlay'),
  ui: document.getElementById('ui'),
});

// handy for debugging from the console
window.game = game;
