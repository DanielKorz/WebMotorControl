/**
 * serial.js - Web Serial API controller for MotorCtrl Web
 * Handles port connection, DTR/RTS signals, stream reading, parser feeding, and keep-alive transmission.
 */

class WebSerialController {
    constructor({ onMessage = null, onText = null, onConnectionChange = null, onTx = null, onRxBytes = null, onError = null } = {}) {
        this.onMessage = onMessage;
        this.onText = onText;
        this.onConnectionChange = onConnectionChange;
        this.onTx = onTx;
        this.onRxBytes = onRxBytes;
        this.onError = onError;

        this.port = null;
        this.reader = null;
        this.connected = false;

        this.targetRpm = 0;
        this.maxRpm = 6000;
        this.periodicSend = true;
        this.sendIntervalMs = 200; // 5 Hz

        this.txCount = 0;
        this.rxCount = 0;
        this.rxBytes = 0;
        this.timerId = null;

        this.dtrState = true;
        this.rtsState = true;

        // Initialize protocol parser
        this.parser = new MotorProtocol.ProtocolParser({
            msgCallback: (msgBytes) => this._handleParserMsg(msgBytes),
            textCallback: (textBytes) => this._handleParserText(textBytes),
            debug: true
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
            this.parser.reset();

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

        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) {
                // Ignore cancel errors on shutdown
            }
            this.reader = null;
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
            this.sendDemandNow();
        }
    }

    async sendDemandNow() {
        if (!this.isConnected()) return;
        const encoded = MotorProtocol.buildSpeedDemandMessage(this.targetRpm, this.maxRpm);
        const ok = await this.sendBytes(encoded);
        if (ok && this.onTx) {
            this.onTx(this.targetRpm, this.txCount);
        }
    }

    async SendDiagRequest(req, d0 = 0, d1 = 0, d2 = 0, d3 = 0) {
        if (!this.isConnected()) return false;
        const reqVal = typeof req === 'object' && req !== null ? req.value : parseInt(req, 10);
        const encoded = MotorProtocol.buildDiagRequest(reqVal, d0, d1, d2, d3);
        return await this.sendBytes(encoded);
    }

    async sendBytes(data) {
        if (!this.isConnected() || !this.port.writable) {
            return false;
        }

        try {
            const writer = this.port.writable.getWriter();
            await writer.write(data);
            writer.releaseLock();
            this.txCount++;
            return true;
        } catch (err) {
            console.error("Serial write error:", err);
            await this.disconnect();
            return false;
        }
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
            if (this.connected && this.periodicSend) {
                this.sendDemandNow();
            }
        }, this.sendIntervalMs);
    }

    _handleParserMsg(rawBytes) {
        this.rxCount++;
        const parsed = MotorProtocol.unpackMessage(rawBytes);
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
