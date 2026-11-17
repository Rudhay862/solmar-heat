// Keyboard and mouse input. Held keys give a steering vector; one-shot presses
// (confirm, pause, enter/exit car, honk) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_EXIT = 4;
export const ACTION_HONK = 8;
export const ACTION_RESTART = 16;
export const ACTION_MISSION = 32;
export const ACTION_PUNCH = 64;
export const ACTION_FIRE = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER_EXIT = new Set(['KeyE']);
const HONK = new Set(['KeyH']);
const RESTART = new Set(['KeyR']);
const MISSION = new Set(['KeyM']);
const PUNCH = new Set(['KeyF']);
const FIRE = new Set(['KeyJ']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER_EXIT.has(event.code)) actions |= ACTION_ENTER_EXIT;
    else if (HONK.has(event.code)) actions |= ACTION_HONK;
    else if (RESTART.has(event.code)) actions |= ACTION_RESTART;
    else if (MISSION.has(event.code)) actions |= ACTION_MISSION;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (FIRE.has(event.code)) actions |= ACTION_FIRE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || BRAKE.has(event.code) || CONFIRM.has(event.code) || PAUSE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  function has(keys) {
    for (const code of keys) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Normalised -1..1 steering vector {x, y} from WASD / arrow keys. */
    vector() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    },
    running() { return has(RUN); },
    braking() { return has(BRAKE); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last pointer position and whether it was clicked since the last read. */
    takeMouse() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return { x: mouseX, y: mouseY, clicked };
    },
  };
}
