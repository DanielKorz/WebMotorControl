/**
 * Web app version and changelog.
 * Bump APP_VERSION and add an entry at the top of APP_CHANGELOG for every behavioural change.
 * The version is shown in the header, logged to the console log at start-up and on connect.
 */
const APP_VERSION = "1.7.1";

const APP_CHANGELOG = [
    {
        version: "1.7.1",
        date: "2026-10-04",
        changes: [
            "Theme choice is also saved in a one-year cookie (backup for blocked/cleared site storage) and the storage key is namespaced (motorctrl.theme) so other pages on the same domain cannot clash."
        ]
    },
    {
        version: "1.7.0",
        date: "2026-10-04",
        changes: [
            "Two more themes: 'retro' (80s green-phosphor CRT terminal with scanlines) and 'fresh' (modern dark glass UI, indigo/cyan accent).",
            "Chart and slider ticks now take their colours from the active theme."
        ]
    },
    {
        version: "1.6.0",
        date: "2026-10-04",
        changes: [
            "Theme buttons in the header: the current theme and a theme matching the Python app (sage-green window, cream panels, green buttons); the choice is remembered."
        ]
    },
    {
        version: "1.5.8",
        date: "2026-10-04",
        changes: [
            "Status panel: temperatures shown as degrees C with 1 decimal, firmware version as x.yy, without the raw values in brackets."
        ]
    },
    {
        version: "1.5.7",
        date: "2026-10-04",
        changes: [
            "Status panel: supplyVoltage shown as volts only (2 decimals); torque as Nm with 3 decimals, no mNm figure."
        ]
    },
    {
        version: "1.5.6",
        date: "2026-10-04",
        changes: [
            "Log made wider and the chart narrower so diagnostic lines do not wrap.",
            "Log now scrolls inside a fixed-height panel instead of growing the page."
        ]
    },
    {
        version: "1.5.5",
        date: "2026-10-04",
        changes: [
            "Request Status and Find Zero Index buttons disabled (status is requested automatically on connect and by the stale-status watchdog)."
        ]
    },
    {
        version: "1.5.4",
        date: "2026-10-04",
        changes: [
            "Removed the per-message-id list from the RX diagnostics line."
        ]
    },
    {
        version: "1.5.3",
        date: "2026-10-04",
        changes: [
            "Removed the 'Hex dump raw RX' option (debugging aid no longer needed)."
        ]
    },
    {
        version: "1.5.2",
        date: "2026-10-04",
        changes: [
            "Sounds moved into their own panel next to Faults & Warnings (Beep, pattern list, Play)."
        ]
    },
    {
        version: "1.5.1",
        date: "2026-10-04",
        changes: [
            "Removed the Trigger OC / UV / OT / HT test buttons from the Faults & Warnings panel (developer-only)."
        ]
    },
    {
        version: "1.5.0",
        date: "2026-10-04",
        changes: [
            "Faults & Warnings panel as in the Python app: OC / OT / SELF / STALL / UV / SM (red) and HTW / SMW (orange) indicators from the status word, changes written to the log.",
            "Clear Faults moved into the panel; Trigger OC / UV / OT / HT test buttons; Sound beep and the 10 sound patterns with Play."
        ]
    },
    {
        version: "1.4.1",
        date: "2026-10-04",
        changes: [
            "Self-Test button (DIAG_REQ_SELFTEST), as in the Python app; results appear in the log as decoded diagnostic events."
        ]
    },
    {
        version: "1.4.0",
        date: "2026-10-04",
        changes: [
            "Diagnostic events (MSG_ID_DIAG_INFO) are decoded into the log like the Python app: DIAG_CODE table, enum names, V/A formatting, colour styles (diagcodes.js, generated from DiagCodeParser.py).",
            "Log lines are individual elements; each diagnostic line is prefixed with firmware time [s] and sequence number.",
            "Connection statistics (TX/RX counters, RX diagnostics, hex dump) moved under the port configuration."
        ]
    },
    {
        version: "1.3.1",
        date: "2026-10-04",
        changes: [
            "Chart legend values use a fixed-width tabular field so the labels no longer shift or change size as the numbers change; no more '-0.00 V'."
        ]
    },
    {
        version: "1.3.0",
        date: "2026-10-04",
        changes: [
            "Live FOC chart like the Python app: Id / Iq (mA, left axis) and Ud / Uq (V, right axis) from MSG_ID_V_AC_STATUS, with window (5-60 s), pause, clear and per-trace toggles.",
            "Layout: chart on the left, log on the right."
        ]
    },
    {
        version: "1.2.2",
        date: "2026-10-04",
        changes: [
            "Received messages are no longer echoed to the log ([RX] ID=... lines); removed the 'Log periodic RX' checkbox. Per-id counts remain in the RX diagnostics line."
        ]
    },
    {
        version: "1.2.1",
        date: "2026-10-04",
        changes: [
            "Firefox notice: banner and log warning that Web Serial is not natively supported (status data may not be received)."
        ]
    },
    {
        version: "1.2.0",
        date: "2026-10-04",
        changes: [
            "RX diagnostics line under the log: bytes, frames, STATUS count and age, CRC errors, dropped bytes, per-id counts.",
            "Optional hex dump of the first 600 raw RX bytes, to debug a link that shows no status data."
        ]
    },
    {
        version: "1.1.0",
        date: "2026-10-04",
        changes: [
            "Serial writes are serialised; a failed write no longer disconnects the port (fixes frozen status panel).",
            "Speed demands throttled to 50 ms (leading + trailing, 0 rpm sent immediately).",
            "Default limits now match the Python app: Max V 48000 mV, Max I 30000 mA (10 V / 10 A caused the noisy run near 1000 rpm).",
            "Max V / Max I inputs with dq-ceiling hint.",
            "Status panel: |vdq| with ceiling warning, status-stale watchdog (2 s) with automatic re-request, reset on connect/disconnect.",
            "Log: periodic RX hidden unless 'Log periodic RX' is ticked, capped size, scroll-aware, undecodable STATUS warning.",
            "Added version display and changelog."
        ]
    },
    {
        version: "1.0.0",
        date: "2026-09",
        changes: [
            "Initial WebSerial speed controller (speed demand, status panel, log)."
        ]
    }
];

if (typeof window !== "undefined") {
    window.APP_VERSION = APP_VERSION;
    window.APP_CHANGELOG = APP_CHANGELOG;
}
