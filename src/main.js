import { Game } from './game.js';

const game = new Game({
  viewport: document.getElementById('viewport'),
  overlay: document.getElementById('overlay'),
  ui: document.getElementById('ui'),
});

// handy for debugging from the console
window.game = game;
