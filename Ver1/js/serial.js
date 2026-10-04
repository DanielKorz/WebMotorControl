/**
 * serial.js - Web Serial API controller for MotorCtrl Web
 * Handles port connection, DTR/RTS signals, stream reading, parser feeding, and keep-alive transmission.
 */

class WebSerialController {
    constructor({ onMessage = null, onText = null, onConnectionChange = null, onTx = null, onRxBytes = null, onError = null, onStatusStale = null } = {}) {
        this.onMessage = onMessage;
        this.onText = onText;
        this.onConnectionChange = onConnectionChange;
        this.onTx = onTx;
        this.onRxBytes = onRxBytes;
        this.onError = onError;
        this.onStatusStale = onStatusStale;

        this.port = null;
        this.reader = null;
        this.connected = false;

        this.targetRpm = 0;
        this.maxRpm = 6000;
        this.maxV = MotorProtocol.DEFAULT_MAX_V_MV;
        this.maxI = MotorProtocol.DEFAULT_MAX_I_MA;
        this.periodicSend = true;
        this.sendIntervalMs = 200; // 5 Hz

        // Slider drags fire an input event per step; cap what actually goes on the wire
        // (the Python app likewise batches to one message per UI tick).
        this.demandMinIntervalMs = 50;
        this._lastDemandSent = 0;
        this._demandTimer = null;

        // Writes must never overlap: WritableStream.getWriter() throws while another
        // writer is held, and that used to bubble up as a disconnect.
        this._writeChain = Promise.resolve();

        // Status watchdog. The firmware streams MSG_ID_STATUS every ~500 ms once diagnostic
        // output is enabled; if it goes quiet, re-send the request and tell the UI.
        this.statusTimeoutMs = 2000;
        this.lastStatusTime = 0;
        this.statusStale = false;
        this._lastStatusRequest = 0;

        this.txCount = 0;
        this.rxCount = 0;
        this.rxBytes = 0;
        this.msgCounts = {};      // received frame count per message id
        this.lastStatusSeen = 0;
        this.timerId = null;

        this.dtrState = true;
        this.rtsState = true;

        // Initialize protocol parser
        this.parser = new MotorProtocol.ProtocolParser({
            msgCallback: (msgBytes) => this._handleParserMsg(msgBytes),
            textCallback: (textBytes) => this._handleParserText(textBytes),
            debug: false
        });

        // Pass parser errors to controller callback
        this.parser.onError = (err) => {
            if (this.onError) this.onError(err);
        };
    }

    isSupported() {
        return Boolean(navigator && 'serial' in navigator);
    }

    async connect(options = {}) {
        if (!this.isSupported()) {
            throw new Error("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
        }

        if (this.connected) {
            await this.disconnect();
        }

        let baudRate = 230400;
        let dataBits = 8;
        let stopBits = 1;
        let parity = "none";
        let flowControl = "none";

        if (typeof options === "object" && options !== null) {
            if (options.baudRate !== undefined) baudRate = parseInt(options.baudRate, 10) || baudRate;
            if (options.dataBits !== undefined) dataBits = parseInt(options.dataBits, 10) || dataBits;
            if (options.stopBits !== undefined) stopBits = parseInt(options.stopBits, 10) || stopBits;
            if (options.parity !== undefined) parity = options.parity;
            if (options.flowControl !== undefined) flowControl = options.flowControl;
            if (options.dtr !== undefined) this.dtrState = Boolean(options.dtr);
            if (options.rts !== undefined) this.rtsState = Boolean(options.rts);
        } else if (typeof options === "number" || typeof options === "string") {
            baudRate = parseInt(options, 10) || baudRate;
        }

        try {
            // 1. Prompt user for serial port selection
            this.port = await navigator.serial.requestPort();

            // 2. Open port with standard configuration (omitting non-standard bufferSize for maximum driver compatibility)
            const openOptions = {
                baudRate,
                dataBits,
                stopBits,
                parity,
                flowControl
            };
            await this.port.open(openOptions);

            // 3. Assert DTR and RTS signals if requested
            try {
                await this.port.setSignals({
                    dataTerminalReady: this.dtrState,
                    requestToSend: this.rtsState
                });
            } catch (sigErr) {
                console.warn("Could not set DTR/RTS signals on port:", sigErr);
                if (this.onError) {
                    this.onError(`[PORT] Warning: setSignals (DTR/RTS) not supported by driver: ${sigErr.message || sigErr}`);
                }
            }

            this.connected = true;
            this.rxBytes = 0;
            this.rxCount = 0;
            this.msgCounts = {};
            this.lastStatusSeen = 0;
            this.parser.reset();
            this.lastStatusTime = performance.now();
            this.statusStale = false;
            this._writeChain = Promise.resolve();

            // 4. Start background stream reader loop
            this._startReaderLoop().catch(err => {
                console.error("Fatal reader loop error:", err);
                if (this.onError) {
                    this.onError(`[RX Fatal] Reader loop terminated: ${err.message || err}`);
                }
            });

            // 5. Send initial status request to trigger MCU telemetry in case it starts in silent mode
            try {
                await this.sendBytes(MotorProtocol.buildStatusRequest());
            } catch (initErr) {
                console.warn("Initial status request error:", initErr);
            }

            // 6. Start periodic keep-alive sender
            this._startPeriodicSender();

            const info = this.port.getInfo ? this.port.getInfo() : {};
            let portDesc = "Serial Port";
            let isUsb = false;
            if (info.usbVendorId) {
                isUsb = true;
                const vidHex = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
                const pidHex = (info.usbProductId || 0).toString(16).toUpperCase().padStart(4, '0');
                const chipName = (info.usbVendorId === 0x1A86) ? " (WCH CH340)" : (info.usbVendorId === 0x0483) ? " (STM32)" : "";
                portDesc = `USB VID:0x${vidHex} PID:0x${pidHex}${chipName}`;
            }

            if (this.onConnectionChange) {
                this.onConnectionChange(true, `Connected to ${portDesc} @ ${baudRate} baud (${dataBits}${parity[0].toUpperCase()}${stopBits}, Flow: ${flowControl}, DTR: ${this.dtrState}, RTS: ${this.rtsState})`);
            }

            if (!isUsb && this.onError) {
                this.onError(`[PORT WARN] Selected port is not a USB device (e.g. motherboard COM1). If your controller is on COM3 (CH340), please disconnect and choose 'USB-SERIAL CH340' in the browser dialog!`);
            }

            return true;
        } catch (err) {
            await this.disconnect();
            if (this.onConnectionChange) {
                this.onConnectionChange(false, `Connection error: ${err.message || err}`);
            }
            throw err;
        }
    }

    async setSignals({ dataTerminalReady, requestToSend }) {
        if (!this.isConnected()) return;
        try {
            const signals = {};
            if (dataTerminalReady !== undefined) signals.dataTerminalReady = Boolean(dataTerminalReady);
            if (requestToSend !== undefined) signals.requestToSend = Boolean(requestToSend);
            await this.port.setSignals(signals);
            if (signals.dataTerminalReady !== undefined) this.dtrState = signals.dataTerminalReady;
            if (signals.requestToSend !== undefined) this.rtsState = signals.requestToSend;
        } catch (err) {
            console.warn("setSignals error:", err);
        }
    }

    async disconnect() {
        this.connected = false;

        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }

        if (this._demandTimer) {
            clearTimeout(this._demandTimer);
            this._demandTimer = null;
        }

        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) {
                // Ignore cancel errors on shutdown
            }
            this.reader = null;
        }

        // Let any in-flight write release its lock first - close() fails on a locked stream.
        try {
            await this._writeChain;
        } catch (e) {
            // already reported by the write itself
        }

        if (this.port) {
            try {
                await this.port.close();
            } catch (e) {
                // Ignore close errors
            }
            this.port = null;
        }

        if (this.onConnectionChange) {
            this.onConnectionChange(false, "Disconnected");
        }
    }

    isConnected() {
        return this.connected && this.port !== null;
    }

    setTargetRpm(rpm, sendImmediately = true) {
        this.targetRpm = Math.max(0, Math.min(6000, Math.round(rpm)));
        if (sendImmediately && this.isConnected()) {
            this._scheduleDemand();
        }
    }

    /**
     * Leading + trailing throttle: the first change goes out at once, then at most one
     * message per demandMinIntervalMs, and the final value always gets sent. A stop
     * (0 rpm) skips the wait.
     */
    _scheduleDemand() {
        const wait = this._lastDemandSent + this.demandMinIntervalMs - performance.now();
        if (wait <= 0 || this.targetRpm === 0) {
            if (this._demandTimer) {
                clearTimeout(this._demandTimer);
                this._demandTimer = null;
            }
            this.sendDemandNow();
        } else if (!this._demandTimer) {
            this._demandTimer = setTimeout(() => {
                this._demandTimer = null;
                this.sendDemandNow();
            }, wait);
        }
    }

    async sendDemandNow() {
        if (!this.isConnected()) return;
        this._lastDemandSent = performance.now();
        const rpm = this.targetRpm;
        const encoded = MotorProtocol.buildSpeedDemandMessage(rpm, this.maxRpm, this.maxI, this.maxV);
        const ok = await this.sendBytes(encoded);
        if (ok && this.onTx) {
            this.onTx(rpm, this.txCount);
        }
    }

    async SendDiagRequest(req, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
        if (!this.isConnected()) return false;
        const reqVal = typeof req === 'object' && req !== null ? req.value : parseInt(req, 10);
        const encoded = MotorProtocol.buildDiagRequest(reqVal, d0, d1, d2, d3);
        return await this.sendBytes(encoded);
    }

    /**
     * Queue a write. Writes are chained so only one writer is ever held on the stream;
     * resolves true once the bytes were handed to the port.
     */
    sendBytes(data) {
        const run = async () => {
            if (!this.isConnected() || !this.port.writable) {
                return false;
            }

            let writer = null;
            try {
                writer = this.port.writable.getWriter();
                await writer.write(data);
                this.txCount++;
                return true;
            } catch (err) {
                console.error("Serial write error:", err);
                if (this.onError) {
                    this.onError(`[TX ERROR] ${err.name || 'WriteError'}: ${err.message || err}`);
                }
                // Only a lost device is fatal; any other failure just drops this one message.
                if (err && (err.name === "NetworkError" || err.name === "InvalidStateError")) {
                    this.disconnect();
                }
                return false;
            } finally {
                if (writer) {
                    try {
                        writer.releaseLock();
                    } catch (e) { }
                }
            }
        };

        const result = this._writeChain.then(run, run);
        this._writeChain = result.catch(() => false);
        return result;
    }

    async requestStatus() {
        if (!this.isConnected()) return false;
        return await this.sendBytes(MotorProtocol.buildStatusRequest());
    }

    async _startReaderLoop() {
        while (this.connected && this.port && this.port.readable) {
            let reader = null;
            try {
                reader = this.port.readable.getReader();
                this.reader = reader;
                while (this.connected) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value && value.length > 0) {
                        this.rxBytes += value.length;
                        if (this.onRxBytes) {
                            this.onRxBytes(this.rxBytes, value.length, value);
                        }
                        this.parser.parseMessage(value);
                    }
                }
            } catch (err) {
                if (this.connected) {
                    console.warn("Serial read stream error:", err);
                    if (this.onError) {
                        this.onError(`[RX ERROR] ${err.name || 'StreamError'}: ${err.message || err}`);
                    }
                }
            } finally {
                if (reader) {
                    try {
                        reader.releaseLock();
                    } catch (e) { }
                }
                this.reader = null;
            }

            // If still connected and port is open, wait briefly before restarting reader
            if (this.connected && this.port && this.port.readable) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }

    _startPeriodicSender() {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(() => {
            if (!this.connected) return;
            if (this.periodicSend) {
                this.sendDemandNow();
            }
            this._checkStatusWatchdog();
        }, this.sendIntervalMs);
    }

    _checkStatusWatchdog() {
        const now = performance.now();
        const age = now - this.lastStatusTime;
        if (age <= this.statusTimeoutMs) return;

        this.statusStale = true;
        if (this.onStatusStale) this.onStatusStale(true, age);

        // The status stream only runs once the MCU has seen a MSG_ID_STATUS request.
        if (now - this._lastStatusRequest > this.statusTimeoutMs) {
            this._lastStatusRequest = now;
            this.requestStatus();
        }
    }

    /** Snapshot of receive-side health, for the on-screen RX diagnostics line. */
    getRxDiagnostics() {
        const p = this.parser;
        return {
            rxBytes: this.rxBytes,
            frames: this.rxCount,
            statusFrames: this.msgCounts[MotorProtocol.DIAG_MessageIdEnum.MSG_ID_STATUS] || 0,
            crcErrors: p.crcErrors,
            droppedChars: p.droppedChars,
            noEnd: p.errNoEnd,
            noStart: p.errNoStart,
            ids: Object.entries(this.msgCounts).map(([id, n]) => `${MotorProtocol.getMessageIdName(Number(id))}x${n}`),
            statusAgeMs: this.lastStatusSeen ? performance.now() - this.lastStatusSeen : null
        };
    }

    _handleParserMsg(rawBytes) {
        this.rxCount++;
        const parsed = MotorProtocol.unpackMessage(rawBytes);
        if (parsed) {
            this.msgCounts[parsed.msgId] = (this.msgCounts[parsed.msgId] || 0) + 1;
            if (parsed.msgId === MotorProtocol.DIAG_MessageIdEnum.MSG_ID_STATUS) {
                this.lastStatusSeen = performance.now();
            }
        }
        if (parsed && parsed.msgId === MotorProtocol.DIAG_MessageIdEnum.MSG_ID_STATUS) {
            this.lastStatusTime = performance.now();
            if (this.statusStale) {
                this.statusStale = false;
                if (this.onStatusStale) this.onStatusStale(false, 0);
            }
        }
        if (parsed && this.onMessage) {
            this.onMessage(parsed);
        }
    }

    _handleParserText(textBytes) {
        if (this.onText) {
            this.onText(textBytes);
        }
    }
}

// Universal export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebSerialController };
} else {
    window.WebSerialController = WebSerialController;
}
