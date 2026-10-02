// input.js - Input handling

const Input = {
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  joystick: { active: false, x: 0, y: 0, startX: 0, startY: 0 },

  init() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Mouse
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
    });

    window.addEventListener('mouseup', (e) => {
      this.mouse.down = false;
    });

    // Touch / Mobile joystick
    this.initJoystick();
  },

  initJoystick() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    if (!zone || !knob) return;

    let touchId = null;

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      this.joystick.active = true;
      this.joystick.startX = touch.clientX;
      this.joystick.startY = touch.clientY;
      this.updateJoystick(touch.clientX, touch.clientY);
    });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId) {
          this.updateJoystick(touch.clientX, touch.clientY);
        }
      }
    });

    zone.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchId) {
          touchId = null;
          this.joystick.active = false;
          this.joystick.x = 0;
          this.joystick.y = 0;
          knob.style.transform = 'translate(-50%, -50%)';
        }
      }
    });
  },

  updateJoystick(touchX, touchY) {
    const knob = document.getElementById('joystick-knob');
    if (!knob) return;

    const maxDist = 40;
    let dx = touchX - this.joystick.startX;
    let dy = touchY - this.joystick.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }

    this.joystick.x = dx / maxDist;
    this.joystick.y = dy / maxDist;

    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  },

  getMovement() {
    let x = 0;
    let y = 0;

    // Keyboard
    if (this.keys['w'] || this.keys['arrowup']) y -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) y += 1;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;

    // Joystick
    if (this.joystick.active) {
      x += this.joystick.x;
      y += this.joystick.y;
    }

    return { x, y };
  },

  isKeyDown(key) {
    return this.keys[key.toLowerCase()] || false;
  },
};
