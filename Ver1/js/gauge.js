// Shaft-speed dial: 0 at the top, forward to the right (green), reverse to the left (red), a needle for the
// measured speed, a small marker for the demanded one, and the reading below. SVG, coloured from CSS
// variables (--gauge-*), so every theme can restyle it. The needle eases toward the reading each frame.
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

class SpeedGauge {
  /**
   * @param {HTMLElement} host   element the dial is drawn into
   * @param {object} opt         { max: full scale in rpm, reverse: bool, sweep: degrees from 0 to full scale }
   */
  constructor(host, { max = 4000, reverse = true, sweep = 140 } = {}) {
    this.host = host;
    this.max = max;
    this.reverse = reverse;
    this.sweep = sweep;
    this.speed = 0;                 // the reading
    this.target = 0;                // the demand
    this.shown = 0;                 // the needle's current value, eased toward `speed`
    this.cx = 110;
    this.cy = 104;
    this.build();
    this.raf = requestAnimationFrame(this.frame);
  }

  #el(name, attrs = {}, parent = null) {
    const e = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent?.append(e);
    return e;
  }

  #polar(r, deg) {
    const a = (deg * Math.PI) / 180;
    return [this.cx + r * Math.sin(a), this.cy - r * Math.cos(a)];
  }

  #angle(rpm) {
    const lim = this.reverse ? -this.max : 0;
    return (Math.max(lim, Math.min(this.max, rpm)) / this.max) * this.sweep;
  }

  #arc(r, a0, a1) {
    const [x0, y0] = this.#polar(r, a0), [x1, y1] = this.#polar(r, a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  /** a step of 1, 2 or 5 x 10^n that gives no more than six labels per side */
  #step() {
    for (const s of [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]) if (this.max / s <= 6) return s;
    return this.max;
  }

  build() {
    const host = this.host;
    host.textContent = '';
    const svg = this.#el('svg', { viewBox: '0 0 220 214', class: 'gauge', role: 'img', 'aria-label': 'Shaft velocity' }, host);

    this.#el('circle', { cx: this.cx, cy: this.cy, r: 102, class: 'g-dial' }, svg);

    // a soft glow behind the coloured scale: the same arcs, wide and blurred. It brightens on the side the shaft turns.
    const fx = this.#el('defs', {}, svg);
    const blur = this.#el('filter', { id: 'g-blur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, fx);
    this.#el('feGaussianBlur', { stdDeviation: 4.5 }, blur);
    this.glowFwd = this.#el('path', { d: this.#arc(90, 0, this.sweep), class: 'g-glow g-fwd', filter: 'url(#g-blur)' }, svg);
    this.glowRev = this.reverse ? this.#el('path', { d: this.#arc(90, 0, -this.sweep), class: 'g-glow g-rev', filter: 'url(#g-blur)' }, svg) : null;

    // coloured scale: forward right, reverse left
    this.#el('path', { d: this.#arc(90, 0, this.sweep), class: 'g-arc g-fwd' }, svg);
    if (this.reverse) this.#el('path', { d: this.#arc(90, 0, -this.sweep), class: 'g-arc g-rev' }, svg);

    // ticks: minor at half a step, major (with a label) at each step
    const step = this.#step();
    const lo = this.reverse ? -this.max : 0;
    for (let v = Math.ceil(lo / (step / 2)) * (step / 2); v <= this.max + 1e-6; v += step / 2) {
      const major = Math.abs(v % step) < 1e-6;
      const a = (v / this.max) * this.sweep;
      const [x0, y0] = this.#polar(major ? 76 : 80, a), [x1, y1] = this.#polar(86, a);
      this.#el('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? 'g-tick g-major' : 'g-tick' }, svg);
      if (major) {
        const [tx, ty] = this.#polar(63, a);
        const t = this.#el('text', { x: tx, y: ty + 3.5, class: 'g-num', 'text-anchor': 'middle' }, svg);
        t.textContent = String(Math.abs(v));
      }
    }

    const title = this.#el('text', { x: this.cx, y: this.cy - 8, class: 'g-title', 'text-anchor': 'middle' }, svg);
    title.textContent = 'Shaft Velocity';

    // demand marker: a small triangle on the scale
    this.marker = this.#el('path', { d: 'M 0 -97 L -4 -104 L 4 -104 Z', class: 'g-marker', transform: `translate(${this.cx} ${this.cy})` }, svg);

    // needle and hub
    this.needle = this.#el('g', { transform: `translate(${this.cx} ${this.cy})` }, svg);
    this.#el('line', { x1: 0, y1: 0, x2: 0, y2: -84, class: 'g-needle' }, this.needle);
    this.#el('circle', { cx: this.cx, cy: this.cy, r: 4, class: 'g-hub' }, svg);

    // the reading, on a darker base at the bottom of the dial
    this.#el('path', { d: 'M 60 161 L 160 161 L 172 202 L 48 202 Z', class: 'g-base' }, svg);
    this.value = this.#el('text', { x: this.cx, y: 184, class: 'g-value', 'text-anchor': 'middle' }, svg);
    this.value.textContent = '0';
    const unit = this.#el('text', { x: this.cx, y: 198, class: 'g-unit', 'text-anchor': 'middle' }, svg);
    unit.textContent = 'RPM';
    this.#glass(svg);
    this.draw();
  }

  /** the cover glass: a rim, an inner shade at the edge, a soft glare over the upper half and a thin highlight */
  #glass(svg) {
    const defs = this.#el('defs', {}, svg);
    const grad = (id, kind, attrs, stops) => {
      const g = this.#el(kind, { id, ...attrs }, defs);
      for (const [o, color, op] of stops) this.#el('stop', { offset: o, 'stop-color': color, 'stop-opacity': op }, g);
    };
    grad('g-rim', 'linearGradient', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, '#ffffff', 0.55], [0.5, '#ffffff', 0.08], [1, '#000000', 0.6]]);
    grad('g-shade', 'radialGradient', { cx: 0.5, cy: 0.5, r: 0.5 }, [[0.72, '#000000', 0], [1, '#000000', 0.4]]);
    grad('g-glare', 'linearGradient', { x1: 0, y1: 0, x2: 0.15, y2: 1 }, [[0, '#ffffff', 0.34], [0.6, '#ffffff', 0.07], [1, '#ffffff', 0]]);
    const clip = this.#el('clipPath', { id: 'g-clip' }, defs);
    this.#el('circle', { cx: this.cx, cy: this.cy, r: 100 }, clip);

    const glass = this.#el('g', { class: 'g-glass', 'pointer-events': 'none' }, svg);
    this.#el('circle', { cx: this.cx, cy: this.cy, r: 100, fill: 'url(#g-shade)' }, glass);
    const glare = this.#el('g', { 'clip-path': 'url(#g-clip)' }, glass);
    // a lens-shaped reflection across the top of the dial
    this.#el('path', {
      d: `M ${this.cx - 98} ${this.cy - 8} C ${this.cx - 70} ${this.cy - 88}, ${this.cx + 70} ${this.cy - 88}, ${this.cx + 98} ${this.cy - 8} `
       + `C ${this.cx + 52} ${this.cy - 34}, ${this.cx - 52} ${this.cy - 34}, ${this.cx - 98} ${this.cy - 8} Z`,
      fill: 'url(#g-glare)',
    }, glare);
    // bezel
    this.#el('circle', { cx: this.cx, cy: this.cy, r: 101.5, fill: 'none', stroke: 'url(#g-rim)', 'stroke-width': 3 }, glass);
    // thin highlight on the upper-left edge
    this.#el('path', { d: this.#arc(96, -62, -18), fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.45, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, glass);
  }

  /** change the full scale (and whether reverse is drawn) - rebuilds the scale */
  setRange(max, reverse) {
    if (max === this.max && reverse === this.reverse) return;
    this.max = Math.max(1, max);
    this.reverse = reverse;
    this.build();
  }

  setSpeed(rpm) { this.speed = rpm; this.value.textContent = String(Math.round(rpm)); }
  setTarget(rpm) { this.target = rpm; this.draw(); }

  draw() {
    this.needle.setAttribute('transform', `translate(${this.cx} ${this.cy}) rotate(${this.#angle(this.shown).toFixed(2)})`);
    this.marker.setAttribute('transform', `translate(${this.cx} ${this.cy}) rotate(${this.#angle(this.target).toFixed(2)})`);
    this.marker.style.display = this.target === 0 ? 'none' : '';
    // glow: a base level always, more on the side the needle is on, in proportion to the speed
    const k = Math.min(1, Math.abs(this.shown) / this.max);
    this.glowFwd.style.opacity = (0.3 + (this.shown > 0 ? 0.6 * k : 0)).toFixed(2);
    if (this.glowRev) this.glowRev.style.opacity = (0.3 + (this.shown < 0 ? 0.6 * k : 0)).toFixed(2);
  }

  frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const d = this.speed - this.shown;
    if (Math.abs(d) < this.max * 0.0005) { if (this.shown !== this.speed) { this.shown = this.speed; this.draw(); } return; }
    this.shown += d * 0.2;
    this.draw();
  };
}
