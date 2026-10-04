/**
 * protocol.js - Binary protocol framing, encoder, and parser for MotorCtrl Web
 * Replicates demand_send.py, ProtocolParser.py, and comms.py in JavaScript.
 */

const DLE = 0x10;
const SOM = 0x01;
const EOM = 0x04;
const MAX_MSG_SIZE = 4096;

const MSG_MODE = Object.freeze({
    OUT: 0,
    GET: 1,
    SET: 2,
    REQ: 3,
    GET_ACK: 21,
    SET_ACK: 22,
    REQ_ACK: 23,
    NACK: 30
});

const DIAG_MessageIdEnum = Object.freeze({
    MSG_ID_STATUS: 0x20,
    MSG_ID_ERROR: 0x21,
    MSG_ID_DIAG_INFO: 0x22,
    MSG_ID_CONFIG: 0x23,
    MSG_ID_SYSTEM_VERSION: 0x24,
    MSG_ID_ASSERT: 0x27,
    MSG_ID_PID_REPORT: 0x28,
    MSG_ID_V_AC_STATUS: 0x29,
    MSG_ID_BEMF_ENTRY: 0x30,
    MSG_ID_GEN_LOG_ENTRY: 0x31,
    MSG_ID_PID_DATA: 0x32,
    MSG_ID_DATA_1: 0x33,
    MSG_ID_DATA_2: 0x34,
    MSG_ID_DATA_3: 0x35,
    MSG_ID_UNUSED_36: 0x36,
    MSG_ID_SLOW_SPEED_DATA: 0x37,
    MSG_ID_FOC_QD_CTRL_DATA: 0x38,
    MSG_ID_FOC_EXT_QD_CTRL_DATA: 0x39,
    MSG_ID_DIAG_SET_PID: 0x3A,
    MSG_ID_SET_TARGET: 0x3B,
    MSG_ID_ENC_BOARD_STATUS: 0x50,
    MSG_ID_DIAG_REQUEST: 0xAA
});

// Helper to get name of Message ID
function getMessageIdName(id) {
    for (const [k, v] of Object.entries(DIAG_MessageIdEnum)) {
        if (v === id) return k;
    }
    return `0x${id.toString(16).padStart(2, '0').toUpperCase()}`;
}

const DIAG_RequestIdEnum = Object.freeze({
    DIAG_REQ_GETTIMEUTC: 0x0011,
    DIAG_REQ_GETTIMESTR: 0x0012,
    DIAG_REQ_SETTIMEUTC: 0x0013,
    DIAG_REQ_ENABLE_FULL_DIAGNOSTICS: 0x0020,
    DIAG_REQ_DISABLE_FULL_DIAGNOSTICS: 0x0021,
    DIAG_REQ_SELFTEST: 0x0022,
    DIAG_REQ_CLEAR_FAULTS: 0x0023,
    DIAG_REQ_AUTO_CAL: 0x00A1,
    DIAG_REQ_AUTO_CAL_FAST: 0x00A3,
    DIAG_REQ_CAL_FIND_INDEX: 0x00A6,
    DIAG_REQ_AUTO_CAL_SLOW: 0x00A7,
    DIAG_REQ_AUTO_CAL_CURRENT_SENS: 0x00A8
});

const SRC_DEST = Object.freeze({
    SRC_DEST_NONE: 0,
    SRC_DEST_PC: 1,
    SRC_DEST_MC: 2,
    SRC_DEST_ESP: 3
});

/**
 * ProtocolParser matches Python ProtocolParser.py:
 * Handles DLE/SOM framing, byte unescaping (0x10 0x10 -> 0x10), XOR CRC check,
 * and text callback for non-packet debug text.
 */
class ProtocolParser {
    constructor({ msgCallback = null, textCallback = null, debug = false } = {}) {
        this.message = new Uint8Array(MAX_MSG_SIZE);
        this.droppedStreak = new Uint8Array(MAX_MSG_SIZE);
        this.droppedStreakIndex = 0;
        this.msgCallback = msgCallback;
        this.textCallback = textCallback;
        this.debug = debug;
        this.reset();
    }

    reset() {
        this.escaped = false;
        this.started = false;
        this.messageLen = 0;
        this.crc = 0;
        this.droppedChars = 0;
        this.crcErrors = 0;
        this.errNoStart = 0;
        this.errNoEnd = 0;
    }

    parseMessage(data) {
        const len = data.length;
        for (let i = 0; i < len; i++) {
            const c = data[i];
            let insert = false;
            let complete = false;

            if (!this.escaped) {
                this.escaped = (c === DLE);
                insert = !this.escaped;
            } else {
                if (c === SOM) {
                    if (this.started) {
                        this.errNoEnd++;
                        if (this.debug) {
                            console.warn("Drop: no end");
                        }
                    }
                    this.started = true;
                    this.crc = 0;
                    this.messageLen = 0;
                } else if (c === EOM) {
                    if (this.started) {
                        this.started = false;
                        if (this.crc === 0) {
                            complete = true;
                        } else {
                            if (this.debug) {
                                console.warn("Drop: CRC error, calculated CRC =", this.crc);
                            }
                            this.crcErrors++;
                            if (this.onError) {
                                const hexDump = Array.from(this.message.slice(0, Math.min(this.messageLen, 32)))
                                    .map(b => b.toString(16).padStart(2, '0')).join(' ');
                                this.onError(`CRC error (crc=0x${this.crc.toString(16)}): [${hexDump}]`);
                            }
                        }
                    } else {
                        this.errNoStart++;
                    }
                } else {
                    insert = true;
                }
                this.escaped = false;
            }

            if (this.started) {
                if (this.droppedStreakIndex > 0) {
                    if (this.textCallback) {
                        this.textCallback(this.droppedStreak.slice(0, this.droppedStreakIndex));
                    }
                    this.droppedStreakIndex = 0;
                }

                if (insert) {
                    if (this.messageLen < MAX_MSG_SIZE) {
                        this.message[this.messageLen++] = c;
                        this.crc = this.crc ^ c;
                    } else {
                        this.droppedChars += this.messageLen;
                        this.started = false;
                    }
                }
            } else {
                if (!complete && !this.escaped) {
                    this.droppedChars++;
                    if (this.droppedStreakIndex < MAX_MSG_SIZE) {
                        this.droppedStreak[this.droppedStreakIndex++] = c;
                    }
                }
            }

            if (complete) {
                if (this.msgCallback) {
                    // Extract the unescaped message buffer
                    this.msgCallback(this.message.slice(0, this.messageLen));
                }
            }
        }

        if (this.droppedStreakIndex > 0) {
            if (this.textCallback) {
                this.textCallback(this.droppedStreak.slice(0, this.droppedStreakIndex));
            }
            this.droppedStreakIndex = 0;
        }
    }
}

/**
 * Build raw unescaped message byte array:
 * [msg_id, payload_len_LSB, payload_len_MSB, src, dest, mode, ...payload]
 */
function buildMessage(msgId, payloadBytes = new Uint8Array(0), dest = SRC_DEST.SRC_DEST_MC, mode = MSG_MODE.REQ, src = SRC_DEST.SRC_DEST_PC) {
    const payloadLen = payloadBytes.length;
    const header = new Uint8Array(6);
    header[0] = msgId;
    header[1] = payloadLen & 0xFF;
    header[2] = (payloadLen >> 8) & 0xFF;
    header[3] = src;
    header[4] = dest;
    header[5] = mode;

    const fullMsg = new Uint8Array(header.length + payloadLen);
    fullMsg.set(header, 0);
    fullMsg.set(payloadBytes, header.length);
    return fullMsg;
}

/**
 * Encode message with DLE framing:
 * [DLE, SOM] + message.replace(0x10, 0x10 0x10) + crc (escaped if 0x10) + [DLE, EOM]
 */
function encodeMessage(message) {
    if (!message || message.length === 0) return new Uint8Array(0);

    let crc = 0;
    for (let i = 0; i < message.length; i++) {
        crc ^= message[i];
    }

    const out = [];
    out.push(DLE, SOM);

    for (let i = 0; i < message.length; i++) {
        const b = message[i];
        out.push(b);
        if (b === DLE) {
            out.push(DLE);
        }
    }

    out.push(crc);
    if (crc === DLE) {
        out.push(DLE);
    }

    out.push(DLE, EOM);
    return new Uint8Array(out);
}

/**
 * Build framed speed demand message:
 * Format: '<BBB iiiii B' (24 bytes payload)
 */
function buildSpeedDemandMessage(rpm, maxRpm = 6000, maxI = 10000, maxV = 10000, motionCtrl = 0, torqueType = 3, modulation = 1) {
    const payload = new Uint8Array(24);
    const view = new DataView(payload.buffer);

    view.setUint8(0, motionCtrl);
    view.setUint8(1, torqueType);
    view.setUint8(2, modulation);
    view.setInt32(3, Math.round(rpm), true);     // target RPM
    view.setInt32(7, Math.round(maxI), true);    // maxI
    view.setInt32(11, Math.round(maxV), true);   // maxV
    view.setInt32(15, Math.round(maxRpm), true); // maxRPM
    view.setInt32(19, 0, true);                  // 0
    view.setUint8(23, 0);                        // 0

    const rawMsg = buildMessage(
        DIAG_MessageIdEnum.MSG_ID_SET_TARGET,
        payload,
        SRC_DEST.SRC_DEST_MC,
        MSG_MODE.REQ,
        SRC_DEST.SRC_DEST_PC
    );

    return encodeMessage(rawMsg);
}

/**
 * Build framed diagnostic request:
 * Format: '<Hiiii' (18 bytes payload)
 */
function buildDiagRequest(req, d0 = 0, d1 = 0, d2 = 0, d3 = 0, dest = SRC_DEST.SRC_DEST_MC) {
    const payload = new Uint8Array(18);
    const view = new DataView(payload.buffer);

    view.setUint16(0, req, true);
    view.setInt32(2, d0, true);
    view.setInt32(6, d1, true);
    view.setInt32(10, d2, true);
    view.setInt32(14, d3, true);

    const rawMsg = buildMessage(
        DIAG_MessageIdEnum.MSG_ID_DIAG_REQUEST,
        payload,
        dest,
        MSG_MODE.REQ,
        SRC_DEST.SRC_DEST_PC
    );

    return encodeMessage(rawMsg);
}

/**
 * Build framed MSG_ID_STATUS request:
 * Requests the controller to enable/stream status messages.
 */
function buildStatusRequest(dest = SRC_DEST.SRC_DEST_MC) {
    const rawMsg = buildMessage(
        DIAG_MessageIdEnum.MSG_ID_STATUS,
        new Uint8Array(0),
        dest,
        MSG_MODE.REQ,
        SRC_DEST.SRC_DEST_PC
    );
    return encodeMessage(rawMsg);
}

/**
 * Unpack CDataStatus from MSG_ID_STATUS payload.
 * Format: '<IH iH IIi hh ii ii I' (48 bytes, or 52 bytes with faultWord)
 */
function unpackStatusPayload(payload) {
    if (!payload || payload.length < 48) {
        return null;
    }

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    const tickCount     = view.getUint32(0, true);
    const version       = view.getUint16(4, true);
    const rpm           = view.getInt32(6, true);
    const encoderValue  = view.getUint16(10, true);

    const supplyVoltage = view.getUint32(12, true);
    const bemfVoltage   = view.getUint32(16, true);
    const torque_mNm    = view.getInt32(20, true);

    const iq            = view.getInt16(24, true);
    const id            = view.getInt16(26, true);
    const vq            = view.getInt32(28, true);
    const vd            = view.getInt32(32, true);

    const pcbTemp       = view.getInt32(36, true);
    const motorTemp     = view.getInt32(40, true);
    const statusWord    = view.getUint32(44, true);
    const faultWord     = payload.length >= 52 ? view.getUint32(48, true) : 0;

    return {
        tickCount,
        version,
        rpm,
        encoderValue,
        supplyVoltage,
        bemfVoltage,
        torque_mNm,
        iq,
        id,
        vq,
        vd,
        pcbTemp,
        motorTemp,
        statusWord,
        faultWord
    };
}

/**
 * Unpack a message buffer returned by ProtocolParser.
 */
function unpackMessage(rawMsg) {
    if (!rawMsg || rawMsg.length < 6) {
        return null;
    }

    const msgId = rawMsg[0];
    const payloadSize = rawMsg[1] | (rawMsg[2] << 8);
    const src = rawMsg[3];
    const dest = rawMsg[4];
    const mode = rawMsg[5];
    const payload = rawMsg.slice(6, 6 + payloadSize);

    let status = null;
    if (msgId === DIAG_MessageIdEnum.MSG_ID_STATUS) {
        status = unpackStatusPayload(payload);
    }

    return {
        msgId,
        msgIdName: getMessageIdName(msgId),
        payloadSize,
        src,
        dest,
        mode,
        payload,
        status,
        crc: rawMsg.length > 6 + payloadSize ? rawMsg[rawMsg.length - 1] : null,
        raw: rawMsg
    };
}

// Universal export (Browser & Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DLE, SOM, EOM,
        MSG_MODE,
        DIAG_MessageIdEnum,
        DIAG_RequestIdEnum,
        SRC_DEST,
        getMessageIdName,
        ProtocolParser,
        buildMessage,
        encodeMessage,
        buildSpeedDemandMessage,
        buildDiagRequest,
        buildStatusRequest,
        unpackStatusPayload,
        unpackMessage
    };
} else {
    window.MotorProtocol = {
        DLE, SOM, EOM,
        MSG_MODE,
        DIAG_MessageIdEnum,
        DIAG_RequestIdEnum,
        SRC_DEST,
        getMessageIdName,
        ProtocolParser,
        buildMessage,
        encodeMessage,
        buildSpeedDemandMessage,
        buildDiagRequest,
        buildStatusRequest,
        unpackStatusPayload,
        unpackMessage
    };
}
