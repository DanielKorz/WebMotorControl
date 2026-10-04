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
    const ticksCanvas = document.getElementById("ticksCanvas");
    const presetButtons = document.querySelectorAll(".preset-row button");

    const maxVInput = document.getElementById("maxVInput");
    const maxIInput = document.getElementById("maxIInput");
    const chkLogRx = document.getElementById("chkLogRx");
    const statusAge = document.getElementById("statusAge");
    const rxDiag = document.getElementById("rxDiag");
    const chkHexDump = document.getElementById("chkHexDump");

    const chkPeriodic = document.getElementById("chkPeriodic");
    const btnReqStatus = document.getElementById("btnReqStatus");
    const btnFindZero = document.getElementById("btnFindZero");
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
        statusWord: document.getElementById("stat_statusWord"),
        iq: document.getElementById("stat_iq"),
        id: document.getElementById("stat_id"),
        vq: document.getElementById("stat_vq"),
        vd: document.getElementById("stat_vd"),
        vdq: document.getElementById("stat_vdq"),
        pcbTemp: document.getElementById("stat_pcbTemp"),
        motorTemp: document.getElementById("stat_motorTemp"),
        faultWord: document.getElementById("stat_faultWord")
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

    // ---------------- 4. Speed Demand Controls ----------------
    function setTargetRpm(val, sendImmediately = true) {
        const rpm = Math.max(0, Math.min(6000, Math.round(val)));
        rpmSlider.value = rpm;
        rpmInput.value = rpm;
        rpmDisplay.textContent = `${rpm} RPM`;
        serial.setTargetRpm(rpm, sendImmediately);
    }

    // Slider input (while dragging)
    rpmSlider.addEventListener("input", (e) => {
        const rpm = parseInt(e.target.value, 10);
        rpmDisplay.textContent = `${rpm} RPM`;
        rpmInput.value = rpm;
        serial.setTargetRpm(rpm, true);
    });

    // Direct entry Apply
    function applyInputRpm() {
        const val = parseInt(rpmInput.value, 10);
        if (!isNaN(val)) {
            setTargetRpm(val, true);
        } else {
            rpmInput.value = rpmSlider.value;
        }
    }

    btnApplyRpm.addEventListener("click", applyInputRpm);
    rpmInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            applyInputRpm();
        }
    });

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

    function updateLimitHint() {
        const dqLimitMv = (serial.maxV * 591) >> 10; // control_voltageLimitMV() in APP_control.c
        const bemfRpm = Math.round(dqLimitMv / 3.8);   // iND057: 3.8 mV per rpm
        limitHint.textContent = `dq ceiling ≈ ${(dqLimitMv / 1000).toFixed(1)} V (BEMF alone reaches it at ≈ ${bemfRpm} rpm)`;
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
    bindLimit(maxIInput, "maxI", 0, 30000);
    updateLimitHint();

    // ---------------- 5. Canvas Slider Ticks ----------------
    function drawSliderTicks() {
        const canvas = ticksCanvas;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const w = rect.width;
        if (w <= 20) return;

        ctx.clearRect(0, 0, w, rect.height);

        const margin = 8;
        const span = w - 2 * margin;

        // Minor ticks every 500 RPM
        for (let rpm = 0; rpm <= 6000; rpm += 500) {
            const x = margin + (rpm / 6000) * span;
            const isMajor = (rpm % 1000 === 0);

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, isMajor ? 6 : 3);
            ctx.strokeStyle = isMajor ? "#4a5568" : "#a0aec0";
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Labels for major ticks
        const ticks = [
            { rpm: 0, text: "0 RPM", align: "left" },
            { rpm: 1000, text: "1000", align: "center" },
            { rpm: 2000, text: "2000", align: "center" },
            { rpm: 3000, text: "3000", align: "center" },
            { rpm: 4000, text: "4000", align: "center" },
            { rpm: 5000, text: "5000", align: "center" },
            { rpm: 6000, text: "6000 RPM", align: "right" }
        ];

        ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = "#2d3748";

        ticks.forEach(({ rpm, text, align }) => {
            const x = margin + (rpm / 6000) * span;
            ctx.textAlign = align;
            ctx.fillText(text, x, 20);
        });
    }

    // Click on ticks canvas to set slider value
    ticksCanvas.addEventListener("click", (e) => {
        const rect = ticksCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const margin = 8;
        const span = rect.width - 2 * margin;

        if (span > 0) {
            const ratio = (clickX - margin) / span;
            const rpm = Math.round(Math.max(0, Math.min(1, ratio)) * 6000);
            setTargetRpm(rpm, true);
        }
    });

    window.addEventListener("resize", drawSliderTicks);
    // Initial draw after layout
    setTimeout(drawSliderTicks, 50);

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
        statusInputs.version.value = `${(s.version / 100).toFixed(2)} (${s.version})`;
        statusInputs.rpm.value = `${s.rpm} RPM`;
        statusInputs.encoderValue.value = `${s.encoderValue}`;
        statusInputs.supplyVoltage.value = `${(s.supplyVoltage / 1000).toFixed(2)} V (${s.supplyVoltage} mV)`;
        statusInputs.bemfVoltage.value = `${(s.bemfVoltage / 1000).toFixed(2)} V (${s.bemfVoltage} mV)`;
        statusInputs.torque_mNm.value = `${(s.torque_mNm / 1000).toFixed(2)} Nm (${s.torque_mNm} mNm)`;
        statusInputs.statusWord.value = `0x${s.statusWord.toString(16).padStart(8, '0').toUpperCase()}`;

        statusInputs.iq.value = `${s.iq} mA`;
        statusInputs.id.value = `${s.id} mA`;
        statusInputs.vq.value = `${s.vq} mV`;
        statusInputs.vd.value = `${s.vd} mV`;

        // Magnitude of the dq voltage vector against the ceiling the firmware derives from
        // Max V - when this sits at the limit the current loop has run out of voltage.
        const vdq = Math.round(Math.hypot(s.vq, s.vd));
        const dqLimit = (serial.maxV * 591) >> 10;
        statusInputs.vdq.value = `${vdq} mV (limit ≈ ${dqLimit})`;
        statusInputs.vdq.classList.toggle("warn", vdq > dqLimit * 0.95);

        statusInputs.pcbTemp.value = `${(s.pcbTemp / 1000).toFixed(1)} °C (${s.pcbTemp} m°C)`;
        statusInputs.motorTemp.value = `${(s.motorTemp / 1000).toFixed(1)} °C (${s.motorTemp} m°C)`;
        statusInputs.faultWord.value = `0x${s.faultWord.toString(16).padStart(8, '0').toUpperCase()}`;

        statusAge.textContent = "live";
        statusAge.classList.remove("stale");
    }

    function resetStatusPanel(connected) {
        Object.values(statusInputs).forEach(el => {
            el.value = "-";
            el.classList.remove("warn");
        });
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

    // Periodic telemetry (status / vector status / PID reports) arrives many times a second;
    // logging each one buried everything else, so those only show when asked for.
    const PERIODIC_MSG_IDS = new Set([
        MotorProtocol.DIAG_MessageIdEnum.MSG_ID_STATUS,
        MotorProtocol.DIAG_MessageIdEnum.MSG_ID_V_AC_STATUS,
        MotorProtocol.DIAG_MessageIdEnum.MSG_ID_PID_REPORT
    ]);

    let lastBadStatusLog = 0;

    function handleParsedMessage(parsed) {
        rxStat.textContent = `RX: ${serial.rxCount} pkts (${serial.rxBytes} bytes)`;

        const isStatus = parsed.msgId === MotorProtocol.DIAG_MessageIdEnum.MSG_ID_STATUS;
        let details = "";
        if (parsed.status) {
            updateStatusPanel(parsed.status);
            details = ` (Status: rpm=${parsed.status.rpm}, tick=${parsed.status.tickCount}, Vsup=${(parsed.status.supplyVoltage / 1000).toFixed(1)}V)`;
        } else if (isStatus) {
            // A status packet that can't be decoded used to vanish silently, leaving the
            // panel blank - the usual cause is the firmware's status layout changing.
            const now = performance.now();
            if (now - lastBadStatusLog > 5000) {
                lastBadStatusLog = now;
                appendLog(`[WARN] MSG_ID_STATUS payload is ${parsed.payloadSize} bytes, expected >= 48 - status layout changed?\n`);
            }
        }

        if (chkLogRx.checked || !PERIODIC_MSG_IDS.has(parsed.msgId)) {
            appendLog(`[RX] ID=${parsed.msgIdName} Len=${parsed.payloadSize} Mode=${parsed.mode}${details}\n`);
        }
    }

    let hexDumpedBytes = 0;
    const HEX_DUMP_LIMIT = 600;

    function handleRxBytes(totalBytes, chunkLen, chunkBytes) {
        rxStat.textContent = `RX: ${serial.rxCount} pkts (${totalBytes} bytes)`;

        // Raw capture for diagnosing a link that delivers bytes but no decodable frames.
        if (chkHexDump.checked && chunkBytes && hexDumpedBytes < HEX_DUMP_LIMIT) {
            const part = Array.from(chunkBytes.slice(0, HEX_DUMP_LIMIT - hexDumpedBytes));
            hexDumpedBytes += part.length;
            appendLog(`[HEX] ${part.map(b => b.toString(16).padStart(2, "0")).join(" ")}\n`);
        }
    }

    chkHexDump.addEventListener("change", () => { hexDumpedBytes = 0; });

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
            `CRC err ${d.crcErrors} | dropped ${d.droppedChars} | no-end ${d.noEnd} | no-start ${d.noStart} | ` +
            `ids: ${d.ids.join(" ") || "-"}`;
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

    function appendLog(text) {
        // Only follow the tail when the user hasn't scrolled up to read something.
        const atBottom = logConsole.scrollHeight - logConsole.scrollTop - logConsole.clientHeight < 24;
        logConsole.textContent += text;
        if (logConsole.textContent.length > LOG_MAX_CHARS) {
            const trimmed = logConsole.textContent.slice(-LOG_MAX_CHARS / 2);
            logConsole.textContent = trimmed.slice(trimmed.indexOf("\n") + 1);
        }
        if (atBottom) {
            logConsole.scrollTop = logConsole.scrollHeight;
        }
    }

    btnClearLog.addEventListener("click", () => {
        logConsole.textContent = "";
    });

    appendLog(`WebMotorControl v${APP_VERSION} (${APP_CHANGELOG[0].date})\n`);
    if (isFirefox) {
        appendLog("[WARN] Firefox detected - Web Serial is not natively supported; use a Chromium-based browser.\n");
    }
});
