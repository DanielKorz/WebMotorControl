/**
 * app.js - Main UI logic for MotorCtrl WebSerial Application
 */

document.addEventListener("DOMContentLoaded", () => {
    // ---------------- 1. DOM Element References ----------------
    const compatWarning = document.getElementById("compatWarning");
    const baudSelect = document.getElementById("baudSelect");
    const dataBitsSelect = document.getElementById("dataBitsSelect");
    const stopBitsSelect = document.getElementById("stopBitsSelect");
    const paritySelect = document.getElementById("paritySelect");
    const flowControlSelect = document.getElementById("flowControlSelect");
    const btnConnect = document.getElementById("btnConnect");
    const chkDtr = document.getElementById("chkDtr");
    const chkRts = document.getElementById("chkRts");
    const statusBadge = document.getElementById("statusBadge");
    const statusText = document.getElementById("statusText");

    const rpmDisplay = document.getElementById("rpmDisplay");
    const rpmInput = document.getElementById("rpmInput");
    const btnApplyRpm = document.getElementById("btnApplyRpm");
    const rpmSlider = document.getElementById("rpmSlider");
    const sliderBox = document.getElementById("sliderBox");
    const sliderTicks = document.getElementById("sliderTicks");
    const chkHold = document.getElementById("chkHold");
    const gTarget = document.getElementById("gTarget");
    const gTorque = document.getElementById("gTorque");
    const gIq = document.getElementById("gIq");
    const presetButtons = document.querySelectorAll(".preset-row button");

    const maxVInput = document.getElementById("maxVInput");
    const maxIInput = document.getElementById("maxIInput");
    const motorSelect = document.getElementById("motorSelect");
    const statusAge = document.getElementById("statusAge");
    const rxDiag = document.getElementById("rxDiag");

    const chkPeriodic = document.getElementById("chkPeriodic");
    const btnReqStatus = document.getElementById("btnReqStatus");
    const btnFindZero = document.getElementById("btnFindZero");
    const btnSelfTest = document.getElementById("btnSelfTest");
    const btnControllerInfo = document.getElementById("btnControllerInfo");
    const btnClearFaults = document.getElementById("btnClearFaults");

    const txStat = document.getElementById("txStat");
    const rxStat = document.getElementById("rxStat");
    const btnClearLog = document.getElementById("btnClearLog");
    const logConsole = document.getElementById("logConsole");

    // Status Panel inputs mapping
    const statusInputs = {
        tickCount: document.getElementById("stat_tickCount"),
        version: document.getElementById("stat_version"),
        rpm: document.getElementById("stat_rpm"),
        encoderValue: document.getElementById("stat_encoderValue"),
        supplyVoltage: document.getElementById("stat_supplyVoltage"),
        bemfVoltage: document.getElementById("stat_bemfVoltage"),
        torque_mNm: document.getElementById("stat_torque_mNm"),
        iq: document.getElementById("stat_iq"),
        id: document.getElementById("stat_id"),
        vq: document.getElementById("stat_vq"),
        vd: document.getElementById("stat_vd"),
        vdq: document.getElementById("stat_vdq"),
        pcbTemp: document.getElementById("stat_pcbTemp"),
        motorTemp: document.getElementById("stat_motorTemp")
    };

    // ---------------- 2. WebSerial Controller Setup ----------------
    const serial = new WebSerialController({
        onMessage: handleParsedMessage,
        onText: handleTextStream,
        onConnectionChange: handleConnectionChange,
        onTx: handleTxPacket,
        onRxBytes: handleRxBytes,
        onError: handleProtocolError,
        onStatusStale: handleStatusStale
    });

    // Check browser compatibility
    const isFirefox = /firefox/i.test(navigator.userAgent);

    if (!serial.isSupported()) {
        compatWarning.style.display = "block";
        btnConnect.disabled = true;
    }

    if (isFirefox) {
        // Firefox has no native Web Serial. An add-on may provide navigator.serial, but
        // reception has been seen to fail (demands go out, no status comes back).
        compatWarning.innerHTML = serial.isSupported()
            ? "⚠️ <strong>Firefox detected.</strong> Firefox does not natively support Web Serial; " +
              "sending may work but received status data may not be displayed. " +
              "Please use Google Chrome, Microsoft Edge, Opera or Brave."
            : "⚠️ <strong>Firefox does not support Web Serial.</strong> " +
              "Please use Google Chrome, Microsoft Edge, Opera or Brave to connect over serial.";
        compatWarning.style.display = "block";
    }

    // ---------------- 3. Connection Handlers ----------------
    btnConnect.addEventListener("click", async () => {
        if (serial.isConnected()) {
            await serial.disconnect();
        } else {
            const config = {
                baudRate: baudSelect.value,
                dataBits: dataBitsSelect.value,
                stopBits: stopBitsSelect.value,
                parity: paritySelect.value,
                flowControl: flowControlSelect.value,
                dtr: chkDtr.checked,
                rts: chkRts.checked
            };
            btnConnect.disabled = true;
            try {
                await serial.connect(config);
            } catch (err) {
                // Handled in callback or cancelled
            } finally {
                btnConnect.disabled = false;
            }
        }
    });

    chkDtr.addEventListener("change", async () => {
        if (serial.isConnected()) {
            await serial.setSignals({ dataTerminalReady: chkDtr.checked });
            appendLog(`[SERIAL] DTR set to ${chkDtr.checked}\n`);
        }
    });

    chkRts.addEventListener("change", async () => {
        if (serial.isConnected()) {
            await serial.setSignals({ requestToSend: chkRts.checked });
            appendLog(`[SERIAL] RTS set to ${chkRts.checked}\n`);
        }
    });

    // ---------------- Theme ----------------
    // "default" is the original look; "python" follows the Python app's colours; "retro" is an
    // 80s green-phosphor terminal, "fresh" a modern dark glass UI and "alpha" the Alpha Machines look (all in style.css).
    const THEME_BUTTONS = {
        default: document.getElementById("themeDefault"),
        python: document.getElementById("themePython"),
        retro: document.getElementById("themeRetro"),
        fresh: document.getElementById("themeFresh"),
        alpha: document.getElementById("themeAlpha")
    };

    function applyTheme(name, save = true) {
        if (!(name in THEME_BUTTONS)) name = "default";
        if (name === "default") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", name);
        }
        Object.entries(THEME_BUTTONS).forEach(([key, btn]) => btn.setAttribute("aria-pressed", String(key === name)));
        if (save) {
            if (window.ThemeStore) window.ThemeStore.set(name); // localStorage + cookie, see index.html
        }
    }

    Object.entries(THEME_BUTTONS).forEach(([key, btn]) => btn.addEventListener("click", () => applyTheme(key)));

    // ---------------- Version ----------------
    const appVersionEl = document.getElementById("appVersion");
    appVersionEl.textContent = `v${APP_VERSION}`;
    appVersionEl.title = "Web app version - latest changes:\n- " + APP_CHANGELOG[0].changes.join("\n- ");
    document.title += ` v${APP_VERSION}`;

    function handleConnectionChange(connected, message) {
        const configInputs = [baudSelect, dataBitsSelect, stopBitsSelect, paritySelect, flowControlSelect];
        configInputs.forEach(el => { if (el) el.disabled = connected; });

        if (connected) {
            btnConnect.textContent = "Disconnect";
            btnConnect.className = "btn btn-danger";
            statusBadge.className = "status-badge connected";
            statusText.textContent = "Connected";
            chkDtr.checked = serial.dtrState;
            chkRts.checked = serial.rtsState;
            resetStatusPanel(true);
            focChart.clear();
            appendLog(`--- ${message} (web app v${APP_VERSION}) ---\n`);
        } else {
            resetStatusPanel(false);
            btnConnect.textContent = "Connect Serial";
            btnConnect.className = "btn btn-primary";
            statusBadge.className = "status-badge disconnected";
            statusText.textContent = "Disconnected";
            appendLog(`--- ${message} ---\n`);
        }
    }

    // ---------------- 4. Velocity demand + dial ----------------
    // The dial (js/gauge.js, as in the PyTesterApp web app) shows the measured speed with a needle and the demand
    // with a small marker. The slider glows from zero to the thumb in the dial's colours.
    const FULL_SCALE = 6000;
    const gauge = new SpeedGauge(document.getElementById("gauge"), { max: FULL_SCALE, reverse: true });
    let demandRpm = 0;

    function showTarget(rpm) {
        demandRpm = rpm;
        rpmSlider.value = rpm;
        rpmDisplay.innerHTML = `${rpm} <small>rpm</small>`;
        gTarget.textContent = rpm;
        gauge.setTarget(rpm);
        // the glow runs from zero (the middle of the track) to the thumb: green to the right, red to the left
        const f = Math.min(1, Math.abs(rpm) / FULL_SCALE);
        const span = 2 * FULL_SCALE;
        const f0 = FULL_SCALE / span;
        const f1 = (rpm + FULL_SCALE) / span;
        sliderBox.style.setProperty("--a", Math.min(f0, f1).toFixed(5));
        sliderBox.style.setProperty("--w", Math.abs(f1 - f0).toFixed(5));
        sliderBox.style.setProperty("--k", f.toFixed(3));
        sliderBox.dataset.dir = rpm > 0 ? "fwd" : rpm < 0 ? "rev" : "";
    }

    function setTargetRpm(val, sendImmediately = true) {
        const rpm = Math.max(-FULL_SCALE, Math.min(FULL_SCALE, Math.round(val)));
        showTarget(rpm);
        serial.setTargetRpm(rpm, sendImmediately);
    }

    // Slider input (while dragging)
    rpmSlider.addEventListener("input", (e) => setTargetRpm(parseInt(e.target.value, 10), true));

    // Released: without Hold the slider springs back to 0 and the motor stops
    rpmSlider.addEventListener("change", () => { if (!chkHold.checked) setTargetRpm(0, true); });
    chkHold.addEventListener("change", () => { if (!chkHold.checked) setTargetRpm(0, true); });

    // Step buttons: -/+ 20 % and 5 % of full scale
    function stepTarget(pct) {
        setTargetRpm(demandRpm + Math.round(FULL_SCALE * pct / 100), true);
    }
    document.getElementById("btnUp2").addEventListener("click", () => stepTarget(+20));
    document.getElementById("btnUp1").addEventListener("click", () => stepTarget(+5));
    document.getElementById("btnDown1").addEventListener("click", () => stepTarget(-5));
    document.getElementById("btnDown2").addEventListener("click", () => stepTarget(-20));

    // Direct entry Apply
    function applyInputRpm() {
        const text = rpmInput.value.trim();
        if (/^-?\d+$/.test(text)) {
            setTargetRpm(parseInt(text, 10), true);
            rpmInput.value = "";
        }
    }

    btnApplyRpm.addEventListener("click", applyInputRpm);
    rpmInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            applyInputRpm();
        } else if (e.key === "Escape") {
            rpmInput.value = "";
        }
    });
    rpmInput.addEventListener("input", () => { rpmInput.value = rpmInput.value.replace(/(?!^-)[^\d]/g, ""); });

    // Esc stops from anywhere on the page
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape" || e.repeat) return;
        if (demandRpm !== 0) appendLog("[CONTROL] Esc: stop\n");
        setTargetRpm(0, true);
    }, true);

    // Preset buttons
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = parseInt(btn.dataset.rpm, 10);
            if (!isNaN(target)) {
                setTargetRpm(target, true);
            }
        });
    });

    // Keep-alive toggle
    chkPeriodic.addEventListener("change", () => {
        serial.periodicSend = chkPeriodic.checked;
    });

    // Voltage / current limits sent with every demand (same defaults as the Python app).
    // The firmware latches them when a run starts, so a change only takes effect on the
    // next start from standstill.
    const limitHint = document.getElementById("limitHint");

    // Motor presets (MotorDriver/Source/MOTOR_DEF): peak-phase BEMF constant, nominal bus and the default limits.
    // maxI stays inside the sense chain's range (about 27 A peak on the most sensitive phase after the gain calibration).
    const MOTORS = {
        ind060: { name: "iND060", keMvPerRpm: 2.20, maxV: 24000, maxI: 22000 },
        ind057: { name: "iND057", keMvPerRpm: 3.80, maxV: 48000, maxI: 25000 }
    };
    const MOTOR_KEY = "motorctrl.motor";
    let motorId = "ind060";
    try {
        const saved = localStorage.getItem(MOTOR_KEY);
        if (saved && MOTORS[saved]) motorId = saved;
    } catch (e) { /* storage blocked: keep the default */ }

    function updateLimitHint() {
        const motor = MOTORS[motorId];
        // The firmware clamps Max V to the configured supply, so a nominal bus lower than Max V sets the ceiling
        const effMaxV = Math.min(serial.maxV, motor.maxV);
        const dqLimitMv = (effMaxV * 591) >> 10;    // control_voltageLimitMV() in APP_control.c
        const bemfRpm = Math.round(dqLimitMv / motor.keMvPerRpm);
        limitHint.textContent = `${motor.name}: dq ceiling ≈ ${(dqLimitMv / 1000).toFixed(1)} V (BEMF alone reaches it at ≈ ${bemfRpm} rpm)`;
        limitHint.classList.toggle("warn", bemfRpm < 6500);
    }

    function bindLimit(input, prop, min, max) {
        input.value = serial[prop];
        input.addEventListener("change", () => {
            const v = parseInt(input.value, 10);
            if (!isNaN(v)) {
                serial[prop] = Math.max(min, Math.min(max, v));
            }
            input.value = serial[prop];
            updateLimitHint();
        });
    }

    bindLimit(maxVInput, "maxV", 1000, 48000);
    bindLimit(maxIInput, "maxI", 0, 25000);

    function applyMotorPreset(id, persist) {
        if (!MOTORS[id]) return;
        motorId = id;
        motorSelect.value = id;
        serial.maxV = MOTORS[id].maxV;
        serial.maxI = MOTORS[id].maxI;
        maxVInput.value = serial.maxV;
        maxIInput.value = serial.maxI;
        if (persist) {
            try { localStorage.setItem(MOTOR_KEY, id); } catch (e) { /* storage blocked */ }
        }
        updateLimitHint();
    }
    motorSelect.addEventListener("change", () => {
        applyMotorPreset(motorSelect.value, true);
        appendLog(`[MOTOR] ${MOTORS[motorId].name}: Max V ${serial.maxV} mV, Max I ${serial.maxI} mA (applies on the next start from standstill)\n`);
    });
    applyMotorPreset(motorId, false);

    // ---------------- 5. Slider tick marks ----------------
    // A short mark every 1000 rpm, a labelled one every 2000, zero picked out. Each sits at its fraction of the range
    // (the --f variable); the stylesheet adds the thumb's half-width at both ends so they line up with the thumb.
    (function buildSliderTicks() {
        const marks = [];
        for (let v = -FULL_SCALE; v <= FULL_SCALE; v += 1000) {
            const major = v % 2000 === 0;
            marks.push(`<div class="tick${major ? " major" : ""}${v === 0 ? " zero" : ""}" style="--f:${((v + FULL_SCALE) / (2 * FULL_SCALE)).toFixed(5)}"><i></i>${major ? `<span>${v}</span>` : ""}</div>`);
        }
        sliderTicks.innerHTML = marks.join("");
    })();

    applyTheme(document.documentElement.getAttribute("data-theme") || "default", false);

    // ---------------- 6. Diagnostic Operations ----------------
    btnFindZero.addEventListener("click", async () => {
        if (!serial.isConnected()) {
            alert("Connect to the controller before finding zero index.");
            return;
        }
        const ok = await serial.SendDiagRequest(MotorProtocol.DIAG_RequestIdEnum.DIAG_REQ_CAL_FIND_INDEX);
        if (ok) {
            appendLog(">>> Sent DIAG_REQ_CAL_FIND_INDEX (Find Zero Index)\n");
        }
    });

    // Settings popup (js/settings.js): reads / writes the controller's stored configuration
    const btnSettings = document.getElementById("btnSettings");
    const settingsDialog = new SettingsDialog({ serial, appendLog });
    btnSettings.addEventListener("click", () => settingsDialog.open());

    btnControllerInfo.addEventListener("click", async () => {
        if (!serial.isConnected()) {
            alert("Connect to the controller to read its description.");
            return;
        }
        const okController = await serial.requestControllerInfo();
        const okMotor = await serial.requestMotorInfo();
        if (okController || okMotor) {
            appendLog(">>> Requested the controller and motor description (MSG_ID_CONTROLLER_INFO, MSG_ID_MOTOR_INFO)\n");
        }
    });

    // Same request as the Python app's Self-Test button. The firmware only starts it from idle;
    // progress and the PASSED / FAILED result arrive as diagnostic events in the log.
    btnSelfTest.addEventListener("click", async () => {
        if (!serial.isConnected()) {
            alert("Connect to the controller before running the self-test.");
            return;
        }
        const ok = await serial.SendDiagRequest(MotorProtocol.DIAG_RequestIdEnum.DIAG_REQ_SELFTEST);
        if (ok) {
            appendLog(">>> Sent DIAG_REQ_SELFTEST (Self-Test)\n");
        }
    });

    if (btnReqStatus) {
        btnReqStatus.addEventListener("click", async () => {
            if (!serial.isConnected()) {
                alert("Connect to the controller before requesting status.");
                return;
            }
            const ok = await serial.requestStatus();
            if (ok) {
                appendLog(">>> Sent MSG_ID_STATUS request (triggering telemetry stream)\n");
            }
        });
    }

    btnClearFaults.addEventListener("click", async () => {
        if (!serial.isConnected()) {
            alert("Connect to the controller before clearing faults.");
            return;
        }
        const ok = await serial.SendDiagRequest(MotorProtocol.DIAG_RequestIdEnum.DIAG_REQ_CLEAR_FAULTS);
        if (ok) {
            appendLog(">>> Sent DIAG_REQ_CLEAR_FAULTS command\n");
        }
    });

    // ---------------- 7. Status Panel & Logging ----------------
    function updateStatusPanel(s) {
        if (!s) return;

        const totalSec = Math.floor(s.tickCount / 1000);
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        statusInputs.tickCount.value = `${s.tickCount} (${timeStr})`;
        statusInputs.version.value = `${(s.version / 100).toFixed(2)}`;
        statusInputs.rpm.value = `${s.rpm} RPM`;
        gauge.setSpeed(s.rpm);
        gTorque.textContent = `${(s.torque_mNm / 1000).toFixed(3)} Nm`;
        gIq.textContent = `${s.iq} mA`;
        statusInputs.encoderValue.value = `${s.encoderValue}`;
        statusInputs.supplyVoltage.value = `${(s.supplyVoltage / 1000).toFixed(2)} V`;
        statusInputs.bemfVoltage.value = `${(s.bemfVoltage / 1000).toFixed(2)} V (${s.bemfVoltage} mV)`;
        statusInputs.torque_mNm.value = `${(s.torque_mNm / 1000).toFixed(3)} Nm`;

        statusInputs.iq.value = `${s.iq} mA`;
        statusInputs.id.value = `${s.id} mA`;
        statusInputs.vq.value = `${s.vq} mV`;
        statusInputs.vd.value = `${s.vd} mV`;

        // Magnitude of the dq voltage vector against the ceiling the firmware derives from
        // Max V - when this sits at the limit the current loop has run out of voltage.
        const vdq = Math.round(Math.hypot(s.vq, s.vd));
        // maxV is clamped to the configured supply by the firmware; the measured bus stands in for it
        const effMaxV = s.supplyVoltage > 6000 ? Math.min(serial.maxV, s.supplyVoltage) : Math.min(serial.maxV, MOTORS[motorId].maxV);
        const dqLimit = (effMaxV * 591) >> 10;
        statusInputs.vdq.value = `${vdq} mV (limit ≈ ${dqLimit})`;
        statusInputs.vdq.classList.toggle("warn", vdq > dqLimit * 0.95);

        statusInputs.pcbTemp.value = `${(s.pcbTemp / 1000).toFixed(1)} °C`;
        statusInputs.motorTemp.value = `${(s.motorTemp / 1000).toFixed(1)} °C`;

        updateFaultPanel(s.statusWord);

        statusAge.textContent = "live";
        statusAge.classList.remove("stale");
    }

    // ---------------- Faults & warnings panel ----------------
    // Bit layout of the status word (CTRL_STATE in the firmware's APP_faults.h):
    // bits 16-23 warnings, bits 24-31 faults.
    const FAULT_BITS = [
        { el: "flt_oc",    bit: 24, kind: "FAULT",   name: "OVERCURRENT" },
        { el: "flt_ot",    bit: 25, kind: "FAULT",   name: "OVERTEMPERATURE" },
        { el: "flt_stall", bit: 26, kind: "FAULT",   name: "STALL" },
        { el: "flt_self",  bit: 27, kind: "FAULT",   name: "SELF_TEST" },
        { el: "flt_uv",    bit: 28, kind: "FAULT",   name: "UNDERVOLTAGE" },
        { el: "flt_sm",    bit: 29, kind: "FAULT",   name: "SUPPLY_MISMATCH" },
        { el: "warn_ht",   bit: 16, kind: "WARNING", name: "TEMP_HIGH" },
        { el: "warn_sm",   bit: 17, kind: "WARNING", name: "SUPPLY_MISMATCH" }
    ].map(f => ({ ...f, node: document.getElementById(f.el) }));

    let prevStatusWord = null;

    function updateFaultPanel(word) {
        for (const f of FAULT_BITS) {
            const active = ((word >>> f.bit) & 1) === 1;
            f.node.classList.toggle("active", active);

            // Log changes, like the Python app. On the first status after connecting only
            // conditions that are already active are reported.
            const was = prevStatusWord === null ? false : (((prevStatusWord >>> f.bit) & 1) === 1);
            if (active && !was) {
                appendLog(`${f.kind}: ${f.name}`, f.kind === "FAULT" ? "error" : "warning");
            } else if (!active && was) {
                appendLog(`${f.kind}: ${f.name} cleared`);
            }
        }
        prevStatusWord = word;
    }

    function resetFaultPanel() {
        prevStatusWord = null;
        FAULT_BITS.forEach(f => f.node.classList.remove("active"));
    }

    // Diagnostic request buttons of the panel, same requests as the Python app sends.
    function bindRequestButton(id, request, args, label) {
        document.getElementById(id).addEventListener("click", async () => {
            if (!serial.isConnected()) {
                alert("Connect to the controller first.");
                return;
            }
            const ok = await serial.SendDiagRequest(MotorProtocol.DIAG_RequestIdEnum[request], ...(args()));
            if (ok) {
                appendLog(`>>> Sent ${request} (${label})\n`);
            }
        });
    }

    const SOUND_AMPLITUDE = 40;
    bindRequestButton("btnSoundTest", "DIAG_REQ_BEEP", () => [3000, 600, SOUND_AMPLITUDE], "Beep 3000 Hz, 600 ms");
    bindRequestButton("btnSoundPlay", "DIAG_REQ_SOUND_PATTERN",
        () => [parseInt(document.getElementById("soundPattern").value, 10), SOUND_AMPLITUDE], "Sound pattern");

    function resetStatusPanel(connected) {
        resetFaultPanel();
        Object.values(statusInputs).forEach(el => {
            el.value = "-";
            el.classList.remove("warn");
        });
        gauge.setSpeed(0);
        gTorque.textContent = "-";
        gIq.textContent = "-";
        statusAge.classList.remove("stale");
        statusAge.textContent = connected ? "waiting for status…" : "";
    }

    function handleStatusStale(stale, ageMs) {
        if (stale) {
            statusAge.textContent = `no status for ${Math.round(ageMs / 1000)} s - re-requesting`;
            statusAge.classList.add("stale");
        } else {
            statusAge.textContent = "live";
            statusAge.classList.remove("stale");
        }
    }

    // ---------------- Live FOC chart (Id / Iq in mA, Ud / Uq in V) ----------------
    const focChart = new FocChart(document.getElementById("focChart"), { windowSec: 5 });
    const legendEls = {
        id: document.getElementById("lg_id"),
        iq: document.getElementById("lg_iq"),
        vd: document.getElementById("lg_vd"),
        vq: document.getElementById("lg_vq")
    };

    // mV -> V with two decimals, without a "-0.00" for tiny negative values.
    function formatVolts(mv) {
        const text = (mv / 1000).toFixed(2);
        return text === "-0.00" ? "0.00" : text;
    }

    let lastLegendUpdate = 0;
    function updateChartLegend(v) {
        const now = performance.now();
        if (now - lastLegendUpdate < 100) return; // 10 Hz is plenty for numbers
        lastLegendUpdate = now;
        legendEls.id.textContent = `${v.id} mA`;
        legendEls.iq.textContent = `${v.iq} mA`;
        legendEls.vd.textContent = `${formatVolts(v.vd)} V`;
        legendEls.vq.textContent = `${formatVolts(v.vq)} V`;
    }

    document.getElementById("chartWindow").addEventListener("change", (e) => {
        focChart.setWindow(parseInt(e.target.value, 10));
    });

    const btnChartPause = document.getElementById("btnChartPause");
    btnChartPause.addEventListener("click", () => {
        focChart.setPaused(!focChart.paused);
        btnChartPause.textContent = focChart.paused ? "Resume" : "Pause";
    });

    document.getElementById("btnChartClear").addEventListener("click", () => focChart.clear());

    document.querySelectorAll(".chart-legend input[data-series]").forEach((cb) => {
        cb.addEventListener("change", () => focChart.setVisible(cb.dataset.series, cb.checked));
    });

    // Diagnostic events from the firmware (MSG_ID_DIAG_INFO), decoded as in the Python app's
    // DiagCodeParser. The prefix is the firmware tick in seconds and the sequence number.
    function logDiagInfo(info) {
        const d = DiagCodes.describeDiagInfo(info);
        if (d.powerUp) {
            appendLog("-----------------------------------------------------------------", "power_up");
        }
        const prefix = `[${(info.tick / 1000).toFixed(3)}] ${info.seq.toString(16).padStart(2, "0")} `;
        appendLog(d.text, d.style, prefix);
    }

    // Controller (power board) description (MSG_ControllerInfo)
    function logControllerInfo(c) {
        appendLog("Controller (power board) description", "highlight");
        appendLog(`  name / model / hw rev : ${c.name} / ${c.model} / ${c.hwRev}  (id ${c.controllerId})`, "normal");
        appendLog(`  firmware              : ${(c.fwVersion / 100).toFixed(2)}`, "normal");
        appendLog(`  current sensing       : shunt ${c.shuntUohm} uOhm, amplifier ${(c.csaGainX100 / 100).toString()} V/V, ADC ${c.adcBits} bit / ${c.adcVrefMv} mV`, "normal");
        appendLog(`  current scaling       : ${(c.iConvMul / (1 << c.iConvShift)).toFixed(3)} mA per count, full scale +-${(c.iFullScaleMa / 1000).toFixed(1)} A`, "normal");
        appendLog(`  overcurrent threshold : ${(c.overcurrentTripMa / 1000).toFixed(1)} A`, "normal");
        appendLog(`  voltage divider       : ${c.vbusRtopOhm} / ${c.vbusRbotOhm} ohm, ${(c.vConvMul / (1 << c.vConvShift)).toFixed(3)} mV per count`, "normal");
    }

    // Motor description (MSG_MotorInfo)
    function logMotorInfo(m) {
        const resistance = m.resistanceMul / Math.pow(2, m.resistanceShift);
        const inductance = m.inductanceMul / Math.pow(2, m.inductanceShift);
        appendLog("Motor description", "highlight");
        appendLog(`  name / model          : ${m.name} / ${m.model}  (id ${m.motorId})`, "normal");
        appendLog(`  poles / max speed     : ${m.polePairs} pole pairs, ${m.maxRpm} rpm`, "normal");
        appendLog(`  winding (per phase)   : R ${(resistance * 1000).toFixed(2)} mOhm, L ${(inductance * 1e6).toFixed(1)} uH`, "normal");
        appendLog(`  BEMF / torque const.  : ${(m.bemfMul / Math.pow(2, m.bemfShift)).toFixed(3)} V/krpm, ${(m.torqueMul / Math.pow(2, m.torqueShift)).toFixed(4)} Nm/A`, "normal");
        appendLog(`  supply (nom / min)    : ${(m.nominalSupplyMv / 1000).toFixed(1)} V / ${(m.minSupplyMv / 1000).toFixed(1)} V, max current default ${(m.maxCurrentLimitMa / 1000).toFixed(1)} A`, "normal");
        appendLog(`  calibration voltages  : cal ${m.calMaxVoltageMv} mV, index ${m.indexingMaxVoltageMv} mV, current sensor ${m.currentSensorCalMv} mV`, "normal");
        appendLog(`  voltage control       : drop ${m.voltageModeDropMv} mV, extra R ${m.voltageModeExtraRMohm} mOhm, ramp ${m.voltageRampMvPerMs} mV/ms`, "normal");
        appendLog(`  field weakening / lead: max Id ${(m.fieldWeakeningMaxIdMa / 1000).toFixed(1)} A, lead coefficient ${m.leadCoeffMul}`, "normal");
        appendLog(`  current loop Iq / Id  : Kp ${m.pidCurrentIqKp} Ki ${m.pidCurrentIqKi}  /  Kp ${m.pidCurrentIdKp} Ki ${m.pidCurrentIdKi}`, "normal");
        appendLog(`  speed-mode inner loop : Iq Kp ${m.pidSpeedIqKp} Ki ${m.pidSpeedIqKi}  /  Id Kp ${m.pidSpeedIdKp} Ki ${m.pidSpeedIdKi}`, "normal");
    }

    let lastBadStatusLog = 0;

    // Received messages are not echoed to the log; the RX diagnostics line carries the
    // per-message-id counts. Only STATUS drives the UI, and a STATUS that cannot be
    // decoded is reported.
    function handleParsedMessage(parsed) {
        rxStat.textContent = `RX: ${serial.rxCount} pkts (${serial.rxBytes} bytes)`;

        if (parsed.vac) {
            focChart.addSample(parsed.vac);
            updateChartLegend(parsed.vac);
        }

        if (parsed.controller) {
            logControllerInfo(parsed.controller);
        }

        if (parsed.motor) {
            logMotorInfo(parsed.motor);
        }

        if (parsed.config) {
            settingsDialog.handleConfig(parsed.config);
        }

        if (parsed.diag) {
            logDiagInfo(parsed.diag);
        } else if (parsed.msgId === MotorProtocol.DIAG_MessageIdEnum.MSG_ID_DIAG_INFO) {
            appendLog(`[WARN] MSG_ID_DIAG_INFO payload is ${parsed.payloadSize} bytes, expected 25\n`, "warning");
        }

        const isStatus = parsed.msgId === MotorProtocol.DIAG_MessageIdEnum.MSG_ID_STATUS;
        if (parsed.status) {
            updateStatusPanel(parsed.status);
        } else if (isStatus) {
            // A status packet that can't be decoded used to vanish silently, leaving the
            // panel blank - the usual cause is the firmware's status layout changing.
            const now = performance.now();
            if (now - lastBadStatusLog > 5000) {
                lastBadStatusLog = now;
                appendLog(`[WARN] MSG_ID_STATUS payload is ${parsed.payloadSize} bytes, expected >= 48 - status layout changed?\n`);
            }
        }
    }

    function handleRxBytes(totalBytes) {
        rxStat.textContent = `RX: ${serial.rxCount} pkts (${totalBytes} bytes)`;
    }

    // Receive-side health, refreshed twice a second: shows whether bytes arrive at all,
    // whether they frame and pass the CRC, and whether any of them are STATUS messages.
    setInterval(() => {
        if (!serial.isConnected()) {
            rxDiag.textContent = "RX diagnostics: not connected";
            return;
        }
        const d = serial.getRxDiagnostics();
        const age = d.statusAgeMs === null ? "never" : `${(d.statusAgeMs / 1000).toFixed(1)} s ago`;
        rxDiag.textContent =
            `RX bytes ${d.rxBytes} | frames ${d.frames} | STATUS ${d.statusFrames} (last ${age}) | ` +
            `CRC err ${d.crcErrors} | dropped ${d.droppedChars} | no-end ${d.noEnd} | no-start ${d.noStart}`;
    }, 500);

    function handleProtocolError(errMsg) {
        appendLog(`[WARN] ${errMsg}\n`);
    }

    function handleTextStream(textBytes) {
        let str = "";
        try {
            str = new TextDecoder("latin1").decode(textBytes);
        } catch (e) {
            str = Array.from(textBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        }
        appendLog(`[TEXT] ${str.trim()}\n`);
    }

    function handleTxPacket(rpm, count) {
        txStat.textContent = `TX: ${count} pkts (Last: ${rpm} RPM)`;
    }

    const LOG_MAX_CHARS = 60000;
    let logChars = 0;

    /**
     * Append one line to the log. `cls` is an optional style name (error, warning, prc, ...)
     * that maps to a .log-<cls> class; `prefix` is dimmed text shown before the line.
     */
    function appendLog(text, cls = null, prefix = "") {
        // Only follow the tail when the user hasn't scrolled up to read something.
        const atBottom = logConsole.scrollHeight - logConsole.scrollTop - logConsole.clientHeight < 24;

        const line = document.createElement("span");
        if (cls) line.className = `log-${cls}`;
        if (prefix) {
            const pre = document.createElement("span");
            pre.className = "log-seq";
            pre.textContent = prefix;
            line.appendChild(pre);
        }
        line.appendChild(document.createTextNode(text.replace(/\n$/, "")));
        logConsole.appendChild(line);
        logChars += text.length + prefix.length;

        if (logChars > LOG_MAX_CHARS) {
            while (logConsole.firstChild && logChars > LOG_MAX_CHARS / 2) {
                logChars -= logConsole.firstChild.textContent.length;
                logConsole.removeChild(logConsole.firstChild);
            }
        }
        if (atBottom) {
            logConsole.scrollTop = logConsole.scrollHeight;
        }
    }

    btnClearLog.addEventListener("click", () => {
        logConsole.textContent = "";
        logChars = 0;
    });

    appendLog(`WebMotorControl v${APP_VERSION} (${APP_CHANGELOG[0].date})\n`);
    if (isFirefox) {
        appendLog("[WARN] Firefox detected - Web Serial is not natively supported; use a Chromium-based browser.\n");
    }
});
