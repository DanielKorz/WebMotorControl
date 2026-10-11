/**
 * settings.js - controller settings dialog (the configuration stored in the controller's flash).
 *
 * Counterpart of the Python app's settings window: reads MSG_ID_CONFIG from the controller, lets the values be edited in a popup,
 * validates them with the same limits as the Python app and writes them back. The three groups follow what the values belong to:
 * the motor, the power board and the application. Calibration results (electrical zero, encoder direction, current offsets, the
 * pole-pair angle table) are not part of this message - they are created by the calibrations and saved with "Save cal".
 *
 * Fields marked "unused" are stored and returned by the controller but nothing in the firmware reads them yet.
 * Fields marked "fixed" are shown but cannot be edited here (they are properties of the motor / encoder); the value read from the
 * controller is written back unchanged. The phase-advance switches are not offered at all (also written back unchanged).
 */

/* key = field of the unpacked config message (protocol.js unpackConfigPayload) */
const SETTINGS_GROUPS = Object.freeze([
    {
        id: "motor",
        title: "Motor",
        hint: "Properties of the motor and its encoder. The electrical zero, encoder direction and angle table come from the calibrations.",
        fields: [
            { key: "motorPolePairs", label: "Pole pairs", unit: "", fixed: true,
              tip: "Fixed. The firmware takes the pole pairs from the motor header (MOTOR_POLE_PAIRS); the stored value is not used." },
            { key: "encoderCount", label: "Encoder counts / rev", unit: "", fixed: true,
              tip: "Fixed. The firmware works with 16384 counts per revolution; the stored value is not used." }
        ]
    },
    {
        id: "power",
        title: "Power board",
        hint: "Supply, current limit and the current-sensor gains (per board - they come from the gain calibration).",
        fields: [
            { key: "supplyVoltage_mV", label: "Nominal supply", unit: "mV", min: 10000, max: 60000,
              tip: "Bus voltage the drive expects: PWM duty scaling, supply-mismatch fault (+-5 V) and the ceiling of the host Max V." },
            { key: "minSupplyLimit_mV", label: "Minimum supply", unit: "mV", min: 10000, max: 60000,
              tip: "Undervoltage fault below this bus voltage. Must not be above the nominal supply." },
            { key: "maxCurrentLimit_mA", label: "Maximum current", unit: "mA", min: 10000, max: 60000,
              tip: "Ceiling the host Max I is clamped to (and the current limit used by run on start). Keep it inside the sense range of the board." },
            { key: "currentConvCoefA", label: "Current gain, phase A", unit: "x/1024 mA/count", min: 1000, max: 1000000, column: "one",
              tip: "Counts to mA, 16500 nominal for the 1 mOhm shunts. From calibrate_current_gains.py." },
            { key: "currentConvCoefB", label: "Current gain, phase B", unit: "x/1024 mA/count", min: 1000, max: 1000000, column: "one" },
            { key: "currentConvCoefC", label: "Current gain, phase C", unit: "x/1024 mA/count", min: 1000, max: 1000000, column: "one" },
            { key: "maxOutputVoltAmpl_mV", label: "Max output voltage", unit: "mV", min: 10000, max: 60000, unused: true,
              tip: "Stored only. Must not be above the nominal supply." },
            { key: "maxTemperatureLimit_degC", label: "Maximum temperature", unit: "degC", min: 0, max: 120, unused: true,
              tip: "Stored only - the firmware uses fixed thresholds (warning 90, fall-back 100, fault 110 degC)." },
            { key: "temperatureWarning_degC", label: "Warning temperature", unit: "degC", min: 0, max: 120, unused: true,
              tip: "Stored only." }
        ]
    },
    {
        id: "app",
        title: "Application",
        hint: "How the drive behaves.",
        fields: [
            { key: "runOnStartAtSpeed_rpm", label: "Run on start", unit: "rpm", min: -10000, max: 10000, runOnStart: true,
              tip: "0 = off. Otherwise, after every power-up and once the drive is ready, the controller plays a warning chirp and starts the motor 1 s later at this speed (negative = reverse). Host speed targets are ignored while it runs, except STOP; a STOP or a fault gives the host control back. It never restarts before the next power-up." },
            { key: "accelerationGradient", label: "Acceleration ramp", unit: "rpm/s", min: 500, max: 20000 },
            { key: "maxSpeed_rpm", label: "Maximum speed", unit: "rpm", min: 1000, max: 20000,
              tip: "Also the speed ceiling of run on start." },
            { key: "fastStopGradient", label: "Fast stop ramp", unit: "rpm/s", min: 500, max: 20000, unused: true },
            { key: "immediateStopGradient", label: "Immediate stop ramp", unit: "rpm/s", min: 10000, max: 20000, unused: true },
            { key: "loadCalibration", label: "Load calibration at start", type: "bool", unused: true,
              tip: "Stored only - the firmware always loads a saved calibration at power-up." },
            { key: "runSelfTest", label: "Run self-test at start", type: "bool", unused: true },
            { key: "runIndexing", label: "Find index at start", type: "bool", unused: true }
        ]
    }
]);

/* What "Defaults" fills in: the firmware's own defaults (CFG_setDefaultValues). The board / supply values are kept. */
const SETTINGS_DEFAULTS = Object.freeze({
    accelerationGradient: 3333, fastStopGradient: 10000, immediateStopGradient: 20000,
    maxSpeed_rpm: 6000, maxOutputVoltAmpl_mV: 23000, maxTemperatureLimit_degC: 100, temperatureWarning_degC: 90,
    loadCalibration: 0, runSelfTest: 0, runIndexing: 0,
    runOnStartAtSpeed_rpm: 0
});

class SettingsDialog {
    constructor({ serial, appendLog }) {
        this.serial = serial;
        this.appendLog = appendLog;
        this.overlay = document.getElementById("settingsModal");
        this.form = document.getElementById("settingsForm");
        this.status = document.getElementById("settingsStatus");
        this.btnSave = document.getElementById("btnSettingsSave");
        this.btnReload = document.getElementById("btnSettingsReload");
        this.btnDefaults = document.getElementById("btnSettingsDefaults");
        this.btnClose = document.getElementById("btnSettingsClose");
        this.inputs = {};
        this.loaded = null;         // last config received from the controller
        this._build();
        this._wire();
    }

    _build() {
        this.form.innerHTML = "";
        for (const group of SETTINGS_GROUPS) {
            const box = document.createElement("fieldset");
            box.className = "settings-group";
            box.innerHTML = `<legend>${group.title}</legend><div class="settings-hint">${group.hint}</div>`;
            const grid = document.createElement("div");
            grid.className = "settings-grid";
            let oneColumn = null;       // consecutive fields with column: "one" are stacked in one column
            for (const f of group.fields) {
                const row = document.createElement("label");
                row.className = "settings-row" + (f.unused ? " unused" : "") + (f.fixed ? " fixed" : "");
                if (f.tip) row.title = f.tip;
                const name = document.createElement("span");
                name.className = "settings-name";
                name.textContent = f.label;
                if (f.unused || f.fixed) {
                    const tag = document.createElement("span");
                    tag.className = "settings-tag";
                    tag.textContent = f.fixed ? "fixed" : "unused";
                    name.appendChild(tag);
                }
                const input = document.createElement("input");
                input.dataset.key = f.key;
                if (f.type === "bool") {
                    input.type = "checkbox";
                } else {
                    input.type = "number";
                    input.step = "1";
                    input.className = "text-input";
                }
                const unit = document.createElement("span");
                unit.className = "settings-unit";
                unit.textContent = f.unit || "";
                row.append(name, input, unit);
                if (f.column === "one") {
                    if (!oneColumn) {
                        oneColumn = document.createElement("div");
                        oneColumn.className = "settings-onecol";
                        grid.appendChild(oneColumn);
                    }
                    oneColumn.appendChild(row);
                } else {
                    oneColumn = null;
                    grid.appendChild(row);
                }
                this.inputs[f.key] = { input, field: f, row };
            }
            box.appendChild(grid);
            this.form.appendChild(box);
        }
    }

    _wire() {
        this.btnClose.addEventListener("click", () => this.close());
        this.overlay.addEventListener("mousedown", (e) => { if (e.target === this.overlay) this.close(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !this.overlay.hidden) this.close(); });
        this.btnReload.addEventListener("click", () => this.reload());
        this.btnSave.addEventListener("click", () => this.save());
        this.btnDefaults.addEventListener("click", () => this.fillDefaults());
    }

    isOpen() {
        return !this.overlay.hidden;
    }

    open() {
        this.overlay.hidden = false;
        this.reload();
        const first = this.form.querySelector("input");
        if (first) first.focus();
    }

    close() {
        this.overlay.hidden = true;
    }

    _setStatus(text, level = "") {
        this.status.textContent = text;
        this.status.className = "settings-status" + (level ? " " + level : "");
    }

    async reload() {
        if (!this.serial.isConnected()) {
            this._setStatus("Not connected - connect to the controller to read its settings.", "warn");
            this._enableEditing(false);
            return;
        }
        this._setStatus("Reading the settings from the controller...");
        const ok = await this.serial.requestConfig();
        if (!ok) this._setStatus("Could not send the request.", "bad");
    }

    _enableEditing(on) {
        for (const { input, field } of Object.values(this.inputs)) input.disabled = !on || !!field.fixed;
        this.btnSave.disabled = !on;
        this.btnDefaults.disabled = !on;
    }

    /** Called by the app for every MSG_ID_CONFIG reply (GET_ACK) */
    handleConfig(cfg) {
        this.loaded = cfg;
        for (const { input, field } of Object.values(this.inputs)) {
            const v = cfg[field.key];
            if (field.type === "bool") input.checked = !!v; else input.value = v;
        }
        this._enableEditing(true);
        const pending = this._pendingSave;
        this._pendingSave = null;
        const runOn = this.inputs.runOnStartAtSpeed_rpm;
        if (cfg.legacyLayout) {
            // Older firmware: the message has no run-on-start field
            runOn.input.disabled = true;
            this._setStatus(`Loaded (controller firmware older than 2.25: no run-on-start setting).`, "warn");
        } else if (pending) {
            const mismatch = Object.keys(pending).filter((k) => cfg[k] !== pending[k]);
            if (mismatch.length === 0) {
                this._setStatus("Saved and confirmed by the controller.", "ok");
            } else {
                this._setStatus(`The controller did not apply: ${mismatch.join(", ")}. It ignores a write while a run-on-start motor is running - send STOP, then Save again.`, "bad");
            }
        } else {
            this._setStatus("Loaded from the controller.", "ok");
        }
    }

    fillDefaults() {
        for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
            const entry = this.inputs[key];
            if (!entry || entry.input.disabled) continue;
            if (entry.field.type === "bool") entry.input.checked = !!value; else entry.input.value = value;
        }
        this._setStatus("Defaults filled in (supply, current limit and gains kept). Press Save to write them.", "warn");
    }

    /** Returns { values, errors }. values holds numbers (booleans as 0/1). */
    validate() {
        const values = {};
        const errors = [];
        for (const { input, field } of Object.values(this.inputs)) {
            if (field.fixed) continue;      // not editable: the value read from the controller is written back as it is
            if (field.type === "bool") {
                values[field.key] = input.checked ? 1 : 0;
                continue;
            }
            const text = input.value.trim();
            if (field.runOnStart && text === "") { values[field.key] = 0; continue; }   // empty = off
            const n = Number(text);
            if (text === "" || !Number.isInteger(n)) {
                errors.push(`${field.label}: enter a whole number.`);
                continue;
            }
            values[field.key] = n;
            if (field.runOnStart) {
                if (n !== 0 && (Math.abs(n) < 50 || Math.abs(n) > 10000)) {
                    errors.push("Run on start must be 0 (off) or 50-10000 rpm (negative = reverse).");
                }
            } else if (n < field.min || n > field.max) {
                errors.push(`${field.label} out of range (${field.min}-${field.max}${field.unit ? " " + field.unit : ""}).`);
            }
        }
        if (errors.length === 0) {
            if (values.minSupplyLimit_mV > values.supplyVoltage_mV) errors.push("Minimum supply cannot be higher than the nominal supply.");
            if (values.maxOutputVoltAmpl_mV > values.supplyVoltage_mV) errors.push("Max output voltage amplitude cannot be higher than the nominal supply.");
            if (values.runOnStartAtSpeed_rpm !== 0 && Math.abs(values.runOnStartAtSpeed_rpm) > values.maxSpeed_rpm) {
                errors.push("Run on start speed is above the maximum speed.");
            }
        }
        return { values, errors };
    }

    async save() {
        if (!this.serial.isConnected()) {
            this._setStatus("Not connected.", "bad");
            return;
        }
        if (!this.loaded) {
            this._setStatus("Read the settings first.", "warn");
            return;
        }
        const { values, errors } = this.validate();
        if (errors.length) {
            this._setStatus(errors[0] + (errors.length > 1 ? `  (+${errors.length - 1} more)` : ""), "bad");
            return;
        }
        const was = this.loaded.runOnStartAtSpeed_rpm || 0;
        const now = values.runOnStartAtSpeed_rpm;
        if (now !== 0 && now !== was) {
            const ok = window.confirm(
                `Run on start is set to ${now} rpm.\n\nAfter every power-up the controller will play a warning chirp and start the motor ` +
                `by itself 1 s later, and keep it running until a fault, a STOP or power-down.\n\nSave this setting?`);
            if (!ok) return;
        }
        // keep fields the dialog does not edit (version byte comes from the protocol)
        const toSend = Object.assign({}, this.loaded, values);
        const sent = await this.serial.sendConfig(toSend);
        if (!sent) {
            this._setStatus("Could not send the settings.", "bad");
            return;
        }
        this._pendingSave = this.loaded.legacyLayout
            ? Object.fromEntries(Object.entries(values).filter(([k]) => k !== "runOnStartAtSpeed_rpm"))
            : values;
        this.appendLog(">>> Sent the controller settings (MSG_ID_CONFIG SET)\n");
        this._setStatus("Saved - reading back to confirm...", "warn");
        // The controller writes its flash on a SET (and drops it while a run-on-start motor is running: a STOP / fault frees it)
        setTimeout(() => this.reload(), 600);
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SETTINGS_GROUPS, SETTINGS_DEFAULTS };
} else {
    window.SettingsDialog = SettingsDialog;
    window.SETTINGS_GROUPS = SETTINGS_GROUPS;
}
