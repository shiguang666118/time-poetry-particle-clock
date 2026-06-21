import './style.css';
import { DEFAULT_INTERACTION_STATE, THEME_ORDER, applyDragRotation, clampZoom } from './interaction';
import type { ThemeName } from './interaction';
import { createParticleWatchScene } from './scene';

const app = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const cursorField = document.querySelector<HTMLElement>('#cursorField');
const timeDigital = document.querySelector<HTMLElement>('#timeDigital');
const dateDisplay = document.querySelector<HTMLElement>('#dateDisplay');
const weekdayEl = document.querySelector<HTMLElement>('#weekday');
const themeIndicator = document.querySelector<HTMLElement>('#themeIndicator');
const themeFlashRing = document.querySelector<HTMLElement>('#themeFlashRing');

if (!app || !canvas || !cursorField) {
  throw new Error('Particle watch UI failed to initialize.');
}

const watchScene = createParticleWatchScene(canvas);
const cursor = cursorField;
let interactionState = {
  ...DEFAULT_INTERACTION_STATE,
  rotationX: -0.5,
  rotationY: 0,
  zoom: 8.15,
  orbitSpeed: 0,
  autopilot: false,
  theme: 'aurora' as ThemeName,
  timeMultiplier: 1
};

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

function syncInteraction(): void {
  watchScene.setInteractionState(interactionState);
}

function moveCursor(clientX: number, clientY: number): void {
  cursor.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
}

// ── Digital time HUD updater ──
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function updateTimeHud(): void {
  const now = new Date();
  const h = pad2(now.getHours());
  const m = pad2(now.getMinutes());
  const s = pad2(now.getSeconds());

  if (timeDigital) {
    timeDigital.innerHTML = `${h}:${m}<span class="seconds">:${s}</span>`;
  }
  if (dateDisplay) {
    dateDisplay.textContent = `${pad2(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }
  if (weekdayEl) {
    weekdayEl.textContent = WEEKDAYS[now.getDay()];
  }
}

setInterval(updateTimeHud, 100);
updateTimeHud();

// ── Theme switching (double-click / double-tap) ──
let currentThemeIndex = 0;

function cycleTheme(): void {
  currentThemeIndex = (currentThemeIndex + 1) % THEME_ORDER.length;
  const newTheme = THEME_ORDER[currentThemeIndex];

  interactionState = { ...interactionState, theme: newTheme };
  watchScene.setTheme(newTheme);
  syncInteraction();

  // Update DOM
  if (app) {
    app.setAttribute('data-theme', newTheme);
  }

  // Update theme indicator
  if (themeIndicator) {
    themeIndicator.textContent = newTheme.toUpperCase();
    themeIndicator.classList.add('flash');
    setTimeout(() => themeIndicator.classList.remove('flash'), 600);
  }

  // Flash ring animation
  if (themeFlashRing) {
    themeFlashRing.classList.remove('active');
    // Force reflow to restart animation
    void themeFlashRing.offsetWidth;
    themeFlashRing.classList.add('active');
    setTimeout(() => themeFlashRing.classList.remove('active'), 700);
  }
}

canvas.addEventListener('dblclick', (event) => {
  event.preventDefault();
  cycleTheme();
});

// ── Long-press time acceleration ──
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let isAccelerating = false;

function startAcceleration(): void {
  isAccelerating = true;
  app?.classList.add('is-accelerating');
  watchScene.setTimeMultiplier(12);
}

function stopAcceleration(): void {
  if (isAccelerating) {
    isAccelerating = false;
    app?.classList.remove('is-accelerating');
    watchScene.setTimeMultiplier(1);
  }
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// ── Pointer events ──
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  app!.classList.add('is-pointing');
  canvas.setPointerCapture(event.pointerId);
  moveCursor(event.clientX, event.clientY);
  watchScene.setPointerFromClient(event.clientX, event.clientY, 1.55);

  // Start long-press timer
  longPressTimer = setTimeout(() => {
    startAcceleration();
  }, 500);
});

canvas.addEventListener('pointermove', (event) => {
  app!.classList.add('is-pointing');
  moveCursor(event.clientX, event.clientY);
  watchScene.setPointerFromClient(event.clientX, event.clientY, dragging ? 1.35 : 0.78);

  if (!dragging) return;

  // If moved significantly, cancel long-press
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
    stopAcceleration();
  }

  interactionState = applyDragRotation(interactionState, dx, dy);
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  syncInteraction();
});

canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  canvas.releasePointerCapture(event.pointerId);
  stopAcceleration();
});

canvas.addEventListener('pointerleave', () => {
  if (!dragging) {
    app!.classList.remove('is-pointing');
    watchScene.clearPointer();
  }
  stopAcceleration();
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    interactionState = {
      ...interactionState,
      zoom: clampZoom(interactionState.zoom + event.deltaY * 0.0024),
      autopilot: false
    };
    syncInteraction();
  },
  { passive: false }
);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    interactionState = {
      ...interactionState,
      autopilot: !interactionState.autopilot
    };
    syncInteraction();
  }

  if (event.code === 'KeyR') {
    watchScene.replay();
  }

  // T key to cycle theme via keyboard too
  if (event.code === 'KeyT') {
    cycleTheme();
  }
});

window.addEventListener('beforeunload', () => {
  watchScene.dispose();
});

syncInteraction();
watchScene.start();
