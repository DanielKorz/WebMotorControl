/**
 * chart.js - live rotating-frame (FOC) chart, the web counterpart of the Python app's
 * "FOC Graph - Rotating frame": Id / Iq (mA) on the left axis, Ud / Uq (V) on the right.
 * Plain canvas, no libraries. Fed by MSG_ID_V_AC_STATUS (~20 Hz).
 */

class FocChart {
    constructor(canvas, { windowSec = 5 } = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.windowSec = windowSec;
        this.paused = false;

        // Per-series colours match the Python app (Id blue, Iq red, Ud orange, Uq green) in
        // the light themes; the active theme can override them through --chart-* variables.
        this.series = [
            { key: "id", label: "Id", unit: "mA", axis: "i", color: "#2563eb", visible: true },
            { key: "iq", label: "Iq", unit: "mA", axis: "i", color: "#dc2626", visible: true },
            { key: "vd", label: "Ud", unit: "V",  axis: "v", color: "#f59e0b", visible: true },
            { key: "vq", label: "Uq", unit: "V",  axis: "v", color: "#16a34a", visible: true }
        ];

        this.maxKeepSec = 60;
        this.points = [];           // {t (ms), id, iq, vd (mV), vq}
        this.frozenAt = 0;          // time the view was paused at
        this.last = null;
        this.dirty = true;
        this._raf = 0;

        // Canvas colours come from the theme's CSS variables; re-read them when it changes.
        this.colors = null;
        this._themeObserver = new MutationObserver(() => { this.colors = null; this.dirty = true; });
        this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        this._resizeObserver = new ResizeObserver(() => { this.dirty = true; });
        this._resizeObserver.observe(canvas);
        this._loop = this._loop.bind(this);
        this._raf = requestAnimationFrame(this._loop);
    }

    addSample(s, now = performance.now()) {
        this.last = s;
        if (this.paused) return;
        this.points.push({ t: now, id: s.id, iq: s.iq, vd: s.vd, vq: s.vq });
        const cutoff = now - this.maxKeepSec * 1000;
        let drop = 0;
        while (drop < this.points.length && this.points[drop].t < cutoff) drop++;
        if (drop > 0) this.points.splice(0, drop);
        this.dirty = true;
    }

    setWindow(sec) { this.windowSec = sec; this.dirty = true; }

    setPaused(paused) {
        this.paused = paused;
        this.frozenAt = performance.now();
        this.dirty = true;
    }

    clear() { this.points = []; this.last = null; this.dirty = true; }

    setVisible(key, visible) {
        const s = this.series.find(x => x.key === key);
        if (s) { s.visible = visible; this.dirty = true; }
    }

    _readColors() {
        const style = getComputedStyle(document.documentElement);
        const v = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
        this.colors = {
            grid: v("--chart-grid", "#e2e8f0"),
            gridMinor: v("--chart-grid-minor", "#eef2f7"),
            zero: v("--chart-zero", "#64748b"),
            text: v("--chart-text", "#475569"),
            title: v("--chart-title", "#334155"),
            border: v("--chart-border", "#94a3b8"),
            hint: v("--chart-hint", "#94a3b8")
        };
        const seriesColors = {
            id: v("--chart-id", "#2563eb"), iq: v("--chart-iq", "#dc2626"),
            vd: v("--chart-vd", "#f59e0b"), vq: v("--chart-vq", "#16a34a")
        };
        for (const s of this.series) s.color = seriesColors[s.key];
    }

    _loop() {
        // The time axis scrolls with the clock, so redraw continuously while running.
        if (this.dirty || !this.paused) {
            this._draw();
            this.dirty = false;
        }
        this._raf = requestAnimationFrame(this._loop);
    }

    /** Round a magnitude up to a round step so the axes do not jitter every frame. */
    static niceMax(v) {
        if (v <= 0) return 1;
        const exp = Math.pow(10, Math.floor(Math.log10(v)));
        const f = v / exp;
        const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
        return steps.find(x => f <= x) * exp;
    }

    _draw() {
        const canvas = this.canvas;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        if (w < 80 || h < 60) return;

        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        if (!this.colors) this._readColors();
        const col = this.colors;
        const ctx = this.ctx;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        const m = { l: 52, r: 46, t: 10, b: 26 };
        const pw = w - m.l - m.r, ph = h - m.t - m.b;
        const now = this.paused ? this.frozenAt : performance.now();
        const t0 = now - this.windowSec * 1000;

        const visible = this.points.filter(p => p.t >= t0 - 1000);

        // Symmetric autoscale per axis over the visible window.
        let maxI = 0, maxV = 0;
        for (const p of visible) {
            if (p.t < t0) continue;
            for (const s of this.series) {
                if (!s.visible) continue;
                const a = Math.abs(p[s.key]);
                if (s.axis === "i") maxI = Math.max(maxI, a); else maxV = Math.max(maxV, a / 1000);
            }
        }
        const rangeI = FocChart.niceMax(Math.max(maxI * 1.1, 100));
        const rangeV = FocChart.niceMax(Math.max(maxV * 1.1, 1));

        const xOf = t => m.l + ((t - t0) / (this.windowSec * 1000)) * pw;
        const yOf = (val, range) => m.t + ph / 2 - (val / range) * (ph / 2);

        ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

        // Grid + axes: 4 divisions each side of zero share the same horizontal lines.
        const divs = 4;
        for (let i = -divs; i <= divs; i++) {
            const y = m.t + ph / 2 - (i / divs) * (ph / 2);
            ctx.beginPath();
            ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y);
            ctx.strokeStyle = i === 0 ? col.zero : col.grid;
            ctx.lineWidth = i === 0 ? 1.2 : 1;
            ctx.stroke();

            ctx.fillStyle = col.text;
            ctx.textAlign = "right"; ctx.textBaseline = "middle";
            ctx.fillText(String(Math.round(rangeI * i / divs)), m.l - 6, y);
            ctx.textAlign = "left";
            ctx.fillText((rangeV * i / divs).toFixed(rangeV >= 8 ? 0 : 1), m.l + pw + 6, y);
        }

        // Vertical time grid, labelled in seconds back from "now".
        const stepSec = this.windowSec <= 10 ? 1 : this.windowSec <= 30 ? 5 : 10;
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        for (let s = 0; s <= this.windowSec; s += stepSec) {
            const x = m.l + pw - (s / this.windowSec) * pw;
            ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph);
            ctx.strokeStyle = col.gridMinor; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = col.text;
            ctx.fillText(s === 0 ? "now" : `-${s}s`, x, m.t + ph + 6);
        }

        ctx.strokeStyle = col.border; ctx.lineWidth = 1;
        ctx.strokeRect(m.l, m.t, pw, ph);

        // Axis titles.
        ctx.save();
        ctx.fillStyle = col.title; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("Current [mA]", 0, 0);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = col.title; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.translate(w - 10, m.t + ph / 2); ctx.rotate(Math.PI / 2); ctx.fillText("Voltage [V]", 0, 0);
        ctx.restore();

        // Traces, clipped to the plot area.
        ctx.save();
        ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
        for (const s of this.series) {
            if (!s.visible || visible.length === 0) continue;
            const range = s.axis === "i" ? rangeI : rangeV;
            const scale = s.axis === "i" ? 1 : 0.001;
            ctx.beginPath();
            let started = false, prevT = 0;
            for (const p of visible) {
                const x = xOf(p.t), y = yOf(p[s.key] * scale, range);
                // Break the line across gaps (link dropout) instead of drawing a false ramp.
                if (!started || p.t - prevT > 500) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                started = true; prevT = p.t;
            }
            ctx.strokeStyle = s.color; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.restore();

        if (this.points.length === 0) {
            ctx.fillStyle = col.hint; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.fillText("waiting for MSG_ID_V_AC_STATUS…", m.l + pw / 2, m.t + ph / 2);
        }

    }
}

if (typeof window !== "undefined") {
    window.FocChart = FocChart;
}
