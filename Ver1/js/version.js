/**
 * Web app version and changelog.
 * Bump APP_VERSION and add an entry at the top of APP_CHANGELOG for every behavioural change.
 * The version is shown in the header, logged to the console log at start-up and on connect.
 */
const APP_VERSION = "1.2.1";

const APP_CHANGELOG = [
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
