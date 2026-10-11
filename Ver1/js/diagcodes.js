/**
 * diagcodes.js - decoding of MSG_ID_DIAG_INFO (diagnostic events) into log lines.
 *
 * Port of MotorCtrl/DiagCodeParser.py: DIAG_CODE (enums/enum_diag_code.py), the enums that
 * the translation table refers to, and DIAG_CODE_TRANS. The tables below were generated from
 * those Python files - when the Python tables change, regenerate rather than editing by hand.
 *
 * Wire format of the payload (MSG_DiagReport, '<HIHBIIII', 25 bytes): diagCode, tick (ms),
 * tickMS (always 0 - the firmware only fills `tick`), seq, data1..data4.
 */

const DIAG_CODE = Object.freeze({
    DIAG_CODE_RESERVED_0000: 0x0000,
    DIAG_CODE_DIGITAL_INPUT_STATE: 0x0013,
    DIAG_CODE_ERROR: 0x0014,
    DIAG_CODE_POWER_UP: 0x0015,
    DIAG_CODE_LAST_RESET_TYPE: 0x0016,
    DIAG_CODE_COMMAND_NO_RECOGNISED: 0x0017,
    DIAG_CODE_OPERATIONAL_STATE: 0x0018,
    DIAG_CODE_GENERIC_DATA_OUT: 0x0019,
    DIAG_CODE_REQUEST_REJECTED: 0x0020,
    DIAG_CODE_EXCEPTION: 0x0021,
    DIAG_CODE_FAULT: 0x0022,
    DIAG_CODE_SEPARATOR: 0x0023,
    DIAG_CODE_CURRENT_LIMIT_REACHED: 0x0024,
    DIAG_CODE_COMMS_HIGH_WATER_MARK: 0x0030,
    DIAG_CODE_COMMS_BUFFER_FULL: 0x0031,
    DIAG_CODE_CONTROL_MODE: 0x0032,
    DIAG_CODE_CFG_LOAD_NOT_OK: 0x0033,
    DIAG_CODE_CFG_LOAD_OK: 0x0034,
    DIAG_CODE_CFG_SAVED: 0x0035,
    DIAG_CODE_CAL_ERROR: 0x0036,
    DIAG_CODE_CAL_SAVED: 0x0037,
    DIAG_CODE_CAL_LOADED: 0x0038,
    DIAG_CODE_CAL_NOT_CAL_ADC: 0x0039,
    DIAG_CODE_CAL_NOT_CAL_ENC_INDEX: 0x003A,
    DIAG_CODE_CAL_NOT_CAL_LINK: 0x003B,
    DIAG_CODE_CAL_NOT_ENC_DIR: 0x003C,
    DIAG_CODE_CFG_DEFAULT: 0x003D,
    DIAG_CODE_CFG_VERSION_MISMATCH: 0x003E,
    DIAG_CODE_AUTO_CAL_STATE_ID: 0x0100,
    DIAG_CODE_AUTO_CAL_PHASE_ANGLE: 0x0101,
    DIAG_CODE_AUTO_CAL_PP_COUNT: 0x0102,
    DIAG_CODE_AUTO_CAL_CW: 0x0103,
    DIAG_CODE_AUTO_CAL_CCW: 0x0104,
    DIAG_CODE_AUTO_CAL_ZERO_ANGLE: 0x0105,
    DIAG_CODE_AUTO_CAL_ENC_1: 0x0106,
    DIAG_CODE_AUTO_CAL_ENC_2: 0x0107,
    DIAG_CODE_AUTO_CAL_NO_MOVEMENT: 0x0108,
    DIAG_CODE_AUTO_CAL_SLOW_STATE_ID: 0x0109,
    DIAG_CODE_AUTO_CAL_CURRENT_STATE_ID: 0x010A,
    DIAG_CODE_AUTO_CAL_RL_STATE_ID: 0x010B,
    DIAG_CODE_AUTO_CAL_VI_STATE_ID: 0x010C,
    DIAG_CODE_AUTO_CALSLOW_1: 0x0120,
    DIAG_CODE_AUTO_CALSLOW_2: 0x0121,
    DIAG_CODE_AUTO_CALSLOW_3: 0x0122,
    DIAG_CODE_AUTO_CALSLOW_4: 0x0123,
    DIAG_CODE_AUTO_CALSLOW_6: 0x0124,
    DIAG_CODE_AUTO_CALSLOW_7: 0x0125,
    DIAG_CODE_AUTO_CALSLOW_8: 0x0126,
    DIAG_CODE_AUTO_CALSLOW_9: 0x0127,
    DIAG_CODE_AUTO_CALSLOW_0: 0x0128,
    DIAG_CODE_AUTO_CALSLOW_10: 0x0129,
    DIAG_CODE_AUTO_CALSLOW_11: 0x012A,
    DIAG_CODE_AUTO_INDEX_DETECTED: 0x0140,
    DIAG_CODE_AUTO_INDEX_FINAL: 0x0141,
    DIAG_CODE_AUTO_INDEX_DELTA: 0x0142,
    DIAG_CODE_AUTO_INDEX_ENC_NOW: 0x0143,
    DIAG_CODE_AUTO_INDEX_5: 0x0144,
    DIAG_CODE_AUTO_INDEX_6: 0x0145,
    DIAG_CODE_AUTO_INDEX_7: 0x0146,
    DIAG_CODE_AUTO_INDEX_8: 0x0147,
    DIAG_CODE_AUTO_INDEX_9: 0x0148,
    DIAG_CODE_AUTO_CAL_CURRENT_SENS: 0x0150,
    DIAG_CODE_AUTO_CAL_RL_RESULT: 0x0151,
    DIAG_CODE_AUTO_CAL_VI_STEP: 0x0152,
    DIAG_CODE_AUTO_CAL_VI_DONE: 0x0153,
    DIAG_CODE_AUTO_ALIGN_STATE_ID: 0x0160,
    DIAG_CODE_AUTO_ALIGN_RESULT: 0x0161,
    DIAG_CODE_AUTO_ALIGN_FAIL: 0x0162,
    DIAG_CODE_ENC_INDEX_ZERO: 0x0163,
    DIAG_CODE_AUTO_CAL_ANGLE_TABLE: 0x0170,
    DIAG_CODE_AUTO_CAL_ANGLE_RESULT: 0x0171,
    DIAG_CODE_AUTO_CAL_ANGLE_AVG: 0x0172,
    DIAG_CODE_AUTO_RUN_STATE: 0x0180,
    DIAG_SELFTEST_FLOAT_MOTV_RANGE: 0x0200,
    DIAG_SELFTEST_FLOAT_MOTV_U_LOW: 0x0201,
    DIAG_SELFTEST_FLOAT_MOTV_U_HIGH: 0x0202,
    DIAG_SELFTEST_FLOAT_MOTV_U_OK: 0x0203,
    DIAG_SELFTEST_FLOAT_MOTV_V_LOW: 0x0205,
    DIAG_SELFTEST_FLOAT_MOTV_V_HIGH: 0x0206,
    DIAG_SELFTEST_FLOAT_MOTV_V_OK: 0x0207,
    DIAG_SELFTEST_FLOAT_MOTV_W_LOW: 0x020A,
    DIAG_SELFTEST_FLOAT_MOTV_W_HIGH: 0x020B,
    DIAG_SELFTEST_FLOAT_MOTV_W_OK: 0x020C,
    DIAG_SELFTEST_MOTV_U_AT_GND_PASS: 0x0210,
    DIAG_SELFTEST_MOTV_U_AT_GND_FAIL: 0x0211,
    DIAG_SELFTEST_MOTV_V_AT_GND_PASS: 0x0212,
    DIAG_SELFTEST_MOTV_V_AT_GND_FAIL: 0x0213,
    DIAG_SELFTEST_MOTV_W_AT_GND_PASS: 0x0214,
    DIAG_SELFTEST_MOTV_W_AT_GND_FAIL: 0x0215,
    DIAG_SELFTEST_MOTOR_CONNECTED: 0x0217,
    DIAG_SELFTEST_MOTOR_NOT_CONNECTED: 0x0218,
    DIAG_SELFTEST_MOTV_U_AT_VBUS_PASS: 0x021A,
    DIAG_SELFTEST_MOTV_U_AT_VBUS_FAIL: 0x021B,
    DIAG_SELFTEST_MOTV_V_AT_VBUS_PASS: 0x021C,
    DIAG_SELFTEST_MOTV_V_AT_VBUS_FAIL: 0x021D,
    DIAG_SELFTEST_MOTV_W_AT_VBUS_PASS: 0x021E,
    DIAG_SELFTEST_MOTV_W_AT_VBUS_FAIL: 0x021F,
    DIAG_SELFTEST_START: 0x0220,
    DIAG_SELFTEST_PASS: 0x0221,
    DIAG_SELFTEST_FAILED: 0x0222,
    DIAG_SELFTEST_END: 0x0223,
    DIAG_SELFTEST_VBUS_OK: 0x0225,
    DIAG_SELFTEST_VBUS_TOO_LOW: 0x0226,
    DIAG_SELFTEST_VBUS_TOO_HIGH: 0x0227,
    DIAG_CODE_INVALID: 0xFFFF,
});

const DIAG_CODE_NAMES = Object.freeze(Object.fromEntries(Object.entries(DIAG_CODE).map(([k, v]) => [v, k])));

/* Enumerations referenced from the format strings as {n:ENUM_NAME}. */
const DIAG_ENUMS = Object.freeze({
    CONTROL_STATE: Object.freeze({
        CONTROL_IDLE: 0,
        CONTROL_PRE_MOVING: 1,
        CONTROL_FAULT: 2,
        CONTROL_MOVING: 3,
        CONTROL_MANUAL_DUTY: 4,
        CONTROL_RPM: 5,
        CONTROL_TORQUE: 6,
        CONTROL_AUTO_CAL: 7,
        CONTROL_CALIBRATION: 8,
        CONTROL_SELF_TEST: 9,
        CONTROL_AUTO_CAL_FAST: 10,
        CONTROL_AUTO_CAL_SLOW: 11,
        CONTROL_CAL_FIND_INDEX: 12,
        CONTROL_CAL_CURRENT_SENS: 13,
        CONTROL_CAL_RL: 14,
        CONTROL_ERR_CALIBRATION: 15,
        CONTROL_ERR_OVERCURRENT: 16,
        CONTROL_SOUND_BEEP1: 17,
        CONTROL_SOUND_PATTERN: 18,
        CONTROL_ALIGN: 19,
        CONTROL_CAL_VI_SWEEP: 20,
        CONTROL_STATE_NUM: 21,
        CONTROL_STATE_INVALID: 22,
    }),
    RESET_TYPE: Object.freeze({
        RESET_CAUSE_UNKNOWN: 0,
        RESET_CAUSE_LOW_POWER_RESET: 1,
        RESET_CAUSE_WINDOW_WATCHDOG_RESET: 2,
        RESET_CAUSE_INDEPENDENT_WATCHDOG_RESET: 3,
        RESET_CAUSE_SOFTWARE_RESET: 4,
        RESET_CAUSE_POWER_ON_POWER_DOWN_RESET: 5,
        RESET_CAUSE_EXTERNAL_RESET_PIN_RESET: 6,
        RESET_CAUSE_BROWNOUT_RESET: 7,
    }),
    AUTO_CAL_STATE: Object.freeze({
        AUTO_CAL_IDLE: 0,
        AUTO_CAL_PREPARE: 1,
        AUTO_CAL_PHASE1_INC_ANGLE: 2,
        AUTO_CAL_PHASE2_DEC_ANGLE: 3,
        AUTO_CAL_PHASE3_CALCS: 4,
        AUTO_CAL_PHASE4_ZERO: 5,
        AUTO_CAL_PHASE5_ZERO: 6,
        AUTO_CAL_FINALISE: 7,
        AUTO_CAL_ERROR: 8,
        AUTO_CAL_INDEX_FIND: 9,
        AUTO_CAL_INDEX_FIND_PREPARE: 10,
        AUTO_CAL_INDEX_FIND_ROTATE_5X: 11,
        AUTO_CAL_INDEX_FIND_END: 12,
    }),
    AUTO_CAL_STATE_SLOW: Object.freeze({
        AUTO_CAL_SLOW_IDLE: 0,
        AUTO_CAL_SLOW_START: 1,
        AUTO_CAL_SLOW_PROCESS_1: 2,
        AUTO_CAL_SLOW_PROCESS_2: 3,
        AUTO_CAL_SLOW_PROCESS_3: 4,
        AUTO_CAL_SLOW_PROCESS_4: 5,
        AUTO_CAL_SLOW_FINALISE: 6,
    }),
    AUTO_CAL_STATE_CURRENT: Object.freeze({
        AUTO_CAL_CURRENT_SENS_IDLE: 0,
        AUTO_CAL_CURRENT_SENS_START: 1,
        AUTO_CAL_CURRENT_SENS_1: 2,
        AUTO_CAL_CURRENT_SENS_2: 3,
        AUTO_CAL_CURRENT_SENS_3: 4,
        AUTO_CAL_CURRENT_SENS_4: 5,
        AUTO_CAL_CURRENT_SENS_5: 6,
        AUTO_CAL_CURRENT_SENS_END: 7,
    }),
    AUTO_CAL_STATE_RL: Object.freeze({
        AUTO_CAL_RL_IDLE: 0,
        AUTO_CAL_RL_START: 1,
        AUTO_CAL_RL_TEST_U: 2,
        AUTO_CAL_RL_TEST_V: 3,
        AUTO_CAL_RL_TEST_W: 4,
        AUTO_CAL_RL_END: 5,
    }),
    AUTO_CAL_STATE_VI: Object.freeze({
        AUTO_CAL_VI_IDLE: 0,
        AUTO_CAL_VI_START: 1,
        AUTO_CAL_VI_SWEEP: 2,
        AUTO_CAL_VI_END: 3,
    }),
    AUTO_ALIGN_STATE: Object.freeze({
        ALIGN_IDLE: 0,
        ALIGN_START: 1,
        ALIGN_APPROACH_LOW: 2,
        ALIGN_CENTRE_FROM_LOW: 3,
        ALIGN_APPROACH_HIGH: 4,
        ALIGN_CENTRE_FROM_HIGH: 5,
        ALIGN_EVALUATE: 6,
    }),
    ALIGN_FAIL_REASON: Object.freeze({
        ALIGN_FAIL_NO_MOVEMENT: 1,
        ALIGN_FAIL_HYSTERESIS: 2,
    }),
    ENC_INDEX_EVENT: Object.freeze({
        ENC_INDEX_UPGRADED: 1,
        ENC_INDEX_MISMATCH: 2,
        ENC_INDEX_ADOPTED: 3,
    }),
    PHASES: Object.freeze({
        NO_PHASE: 0,
        PHASE_U: 1,
        PHASE_V: 2,
        PHASE_W: 3,
    }),
});

/* Styles map to the .log-<style> classes in style.css (colours follow the Python app's STYLE_ANSI). */

const DIAG_CODE_TRANS = Object.freeze({
    [DIAG_CODE.DIAG_CODE_RESERVED_0000]: ["normal", "DIAG_CODE_RESERVED_0000"],
    [DIAG_CODE.DIAG_CODE_DIGITAL_INPUT_STATE]: ["normal", "DIAG_CODE_DIGITAL_INPUT_STATE"],
    [DIAG_CODE.DIAG_CODE_ERROR]: ["normal", "DIAG_CODE_ERROR"],
    [DIAG_CODE.DIAG_CODE_POWER_UP]: ["normal", "POWER_UP - {0:POS_REC_DATE}"],
    [DIAG_CODE.DIAG_CODE_LAST_RESET_TYPE]: ["normal", "Reset type: {0:RESET_TYPE}"],
    [DIAG_CODE.DIAG_CODE_GENERIC_DATA_OUT]: ["highlight", "GENERIC output: {0:d} {1:d} {2:d} {3:d}"],
    [DIAG_CODE.DIAG_CODE_REQUEST_REJECTED]: ["error", "Request rejected"],
    [DIAG_CODE.DIAG_CODE_EXCEPTION]: ["error", "EXCEPTION: {0:d}"],
    [DIAG_CODE.DIAG_CODE_FAULT]: ["error", "FAULT"],
    [DIAG_CODE.DIAG_CODE_SEPARATOR]: ["text_resp", "=============================================="],
    [DIAG_CODE.DIAG_CODE_CURRENT_LIMIT_REACHED]: ["warning", "Current limit: {0:VX1000}A, {1:VX1000}A {2:VX1000}A Max: {3:VX1000}A"],
    [DIAG_CODE.DIAG_CODE_CONTROL_MODE]: ["highlight", "Mode: {0:CONTROL_STATE}"],
    [DIAG_CODE.DIAG_CODE_CFG_LOAD_NOT_OK]: ["error", "CFG: does not exists!"],
    [DIAG_CODE.DIAG_CODE_CFG_LOAD_OK]: ["highlight", "CFG: loaded OK"],
    [DIAG_CODE.DIAG_CODE_CFG_SAVED]: ["highlight", "CFG: saved OK"],
    [DIAG_CODE.DIAG_CODE_CAL_ERROR]: ["error", "Calibration: required!"],
    [DIAG_CODE.DIAG_CODE_CAL_SAVED]: ["normal", "Calibration: saved!"],
    [DIAG_CODE.DIAG_CODE_CAL_LOADED]: ["normal", "Calibration: loaded!"],
    [DIAG_CODE.DIAG_CODE_CAL_NOT_CAL_ADC]: ["error", "Calibration: current sensing not zeroed!"],
    [DIAG_CODE.DIAG_CODE_CAL_NOT_CAL_ENC_INDEX]: ["error", "Calibration: encoder index not observed!"],
    [DIAG_CODE.DIAG_CODE_CAL_NOT_CAL_LINK]: ["error", "Calibration: phase link calibration not done!"],
    [DIAG_CODE.DIAG_CODE_CAL_NOT_ENC_DIR]: ["error", "Calibration: encoder direction not verified!"],
    [DIAG_CODE.DIAG_CODE_CFG_DEFAULT]: ["warning", "CFG: default configuration loaded!"],
    [DIAG_CODE.DIAG_CODE_CFG_VERSION_MISMATCH]: ["warning", "CFG: version mismatch!"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_STATE_ID]: ["op_state", "AUTO CAL: {0:AUTO_CAL_STATE}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_PHASE_ANGLE]: ["normal", "Phase: {0:PHASES} angle={1}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_PP_COUNT]: ["prc", "CAL: Pole pairs detected {0}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_CW]: ["prc", "CAL: Motor encoder direction: CW"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_CCW]: ["prc", "CAL: Motor encoder direction: CCW"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_ZERO_ANGLE]: ["prc", "CAL: Zero angle {0}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_ENC_1]: ["prc", "CAL: Enocder Val1: {0}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_ENC_2]: ["prc", "CAL: Encoder Val2: {0}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_NO_MOVEMENT]: ["error", "CAL: Encoder movement not detected"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_SLOW_STATE_ID]: ["op_state", "AUTO CAL: {0:AUTO_CAL_STATE_SLOW}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_CURRENT_STATE_ID]: ["op_state", "AUTO CAL: {0:AUTO_CAL_STATE_CURRENT}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_RL_STATE_ID]: ["op_state", "AUTO CAL: {0:AUTO_CAL_STATE_RL}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_VI_STATE_ID]: ["op_state", "AUTO CAL: {0:AUTO_CAL_STATE_VI}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_1]: ["prc", "DIAG_CODE_AUTO_CALSLOW_1"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_2]: ["prc", "DIAG_CODE_AUTO_CALSLOW_2"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_3]: ["prc", "DIAG_CODE_AUTO_CALSLOW_3"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_4]: ["prc", "DIAG_CODE_AUTO_CALSLOW_4"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_6]: ["prc", "DIAG_CODE_AUTO_CALSLOW_6"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_7]: ["prc", "DIAG_CODE_AUTO_CALSLOW_7"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_8]: ["prc", "DIAG_CODE_AUTO_CALSLOW_8"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_9]: ["prc", "DIAG_CODE_AUTO_CALSLOW_9"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_0]: ["prc", "DIAG_CODE_AUTO_CALSLOW_0"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_10]: ["prc", "DIAG_CODE_AUTO_CALSLOW_10"],
    [DIAG_CODE.DIAG_CODE_AUTO_CALSLOW_11]: ["prc", "DIAG_CODE_AUTO_CALSLOW_11"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_DETECTED]: ["prc", "INDEX: Detected {0}: at position: {1}"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_FINAL]: ["prc", "INDEX: Final index {0}: at position: {1}"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_DELTA]: ["prc", "INDEX: TIM->CNT: {1}, Pos: {2}, Delta: {0:d}"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_ENC_NOW]: ["prc", "INDEX: Final TIMER: {0}"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_5]: ["prc", "DIAG_CODE_AUTO_INDEX_5"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_6]: ["prc", "DIAG_CODE_AUTO_INDEX_6"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_7]: ["prc", "DIAG_CODE_AUTO_INDEX_7"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_8]: ["prc", "DIAG_CODE_AUTO_INDEX_8"],
    [DIAG_CODE.DIAG_CODE_AUTO_INDEX_9]: ["prc", "DIAG_CODE_AUTO_INDEX_9"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_CURRENT_SENS]: ["prc", "Sens: Phase {0:PHASES} I: {1:d} {2:d} {3:d}"],
    [DIAG_CODE.DIAG_CODE_AUTO_ALIGN_STATE_ID]: ["op_state", "ALIGN: {0:AUTO_ALIGN_STATE}"],
    [DIAG_CODE.DIAG_CODE_AUTO_ALIGN_RESULT]: ["prc", "ALIGN: Zero {0} (from below {1}, from above {2})"],
    [DIAG_CODE.DIAG_CODE_AUTO_ALIGN_FAIL]: ["error", "ALIGN: Failed - {0:ALIGN_FAIL_REASON}, value {1}"],
    [DIAG_CODE.DIAG_CODE_ENC_INDEX_ZERO]: ["prc", "INDEX: {0:ENC_INDEX_EVENT}, zero error {1:d} counts"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_RL_RESULT]: ["prc", "RL: Phase {0:PHASES} R={1:d}mOhm L={2:d}nH tau={3:d}us"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_VI_STEP]: ["prc", "VI: {0:d} mV -> I mean {1:d} mA (min {2:d}, max {3:d})"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_VI_DONE]: ["prc", "VI sweep done: reason {0:d} (1 = max V, 2 = current limit), {1:d} steps, last {2:d} mV"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_ANGLE_TABLE]: ["prc", "ANGLE TABLE [{0:d}..{0:d}+2] (deg*10+1000): {1:d} {2:d} {3:d}"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_ANGLE_RESULT]: ["prc", "ANGLE TABLE: valid={0:d}, largest correction {1:d} (0.1 deg) at entry {2:d}"],
    [DIAG_CODE.DIAG_CODE_AUTO_RUN_STATE]: ["op_state", "RUN ON START: state {0:d} (1 waiting, 2 running, 3 ended, 4 disabled, 5 starting: chirp + 1 s), reason {1:d} (0 none, 1 supply timeout, 2 not calibrated, 3 fault before start, 4 fault while running, 5 control error, 6 stopped for a host config write, 7 stopped by a host STOP), target {2:d} rpm (reverse {3:d})"],
    [DIAG_CODE.DIAG_CODE_AUTO_CAL_ANGLE_AVG]: ["prc", "ANGLE TABLE: {0:d} (1 = new, 2 = averaged, 3 = replaced), runs {1:d}, vs old table rms {2:d} max {3:d} (0.1 deg)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_RANGE]: ["prc_pass", "[1] VBUS={0:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_U_LOW]: ["error", "[1] MotV_U (float) too low! V={0:VX1000}V < {1:VX1000}V (low FET)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_U_HIGH]: ["error", "[1] MotV_U (float) too high! V={0:VX1000}V > {2:VX1000}V (high FET)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_U_OK]: ["prc_pass", "[1] MotV_U (float) in range. V={0:VX1000}V in range[{1:VX1000}V .. {2:VX1000}V]"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_V_LOW]: ["error", "[1] MotV_V (float) too low! V={0:VX1000}V < {1:VX1000}V (low FET)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_V_HIGH]: ["error", "[1] MotV_V (float) too high! V={0:VX1000}V > {2:VX1000}V (high FET)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_V_OK]: ["prc_pass", "[1] MotV_V (float) in range. V={0:VX1000}V in range[{1:VX1000}V .. {2:VX1000}V]"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_W_LOW]: ["error", "[1] MotV_W (float) too low! V={0:VX1000}V < {1:VX1000}V (low FET)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_W_HIGH]: ["error", "[1] MotV_W (float) too high! V={0:VX1000}V > {2:VX1000}V (high FET)"],
    [DIAG_CODE.DIAG_SELFTEST_FLOAT_MOTV_W_OK]: ["prc_pass", "[1] MotV_W (float) in range. V={0:VX1000}V in range[{1:VX1000}V .. {2:VX1000}V]"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_U_AT_GND_PASS]: ["prc_pass", "[2] MotV_U at GND. V={0:VX1000}V, maxV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_U_AT_GND_FAIL]: ["error", "[2] MotV_U too high. V={0:VX1000}V, maxV={1:VX1000}V (low FET)"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_V_AT_GND_PASS]: ["prc_pass", "[4] MotV_V at GND. V={0:VX1000}V, maxV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_V_AT_GND_FAIL]: ["error", "[4] MotV_V too high. V={0:VX1000}V, maxV={1:VX1000}V (low FET)"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_W_AT_GND_PASS]: ["prc_pass", "[6] MotV_W at GND. V={0:VX1000}V, maxV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_W_AT_GND_FAIL]: ["error", "[6] MotV_W too high. V={0:VX1000}V, maxV={1:VX1000}V (low FET)"],
    [DIAG_CODE.DIAG_SELFTEST_MOTOR_CONNECTED]: ["prc_pass", "[2] Motor connected. MotV_V={0:VX1000}V, MotV_W={0:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTOR_NOT_CONNECTED]: ["error", "[2] Motor not connected. MotV_V={0:VX1000}V, MotV_W={0:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_U_AT_VBUS_PASS]: ["prc_pass", "[3] MotV_U at VBUS. V={0:VX1000}V, minV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_U_AT_VBUS_FAIL]: ["error", "[3] MotV_U too low. V={0:VX1000}V, minV={1:VX1000}V (high FET)"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_V_AT_VBUS_PASS]: ["prc_pass", "[5] MotV_V at VBUS. V={0:VX1000}V, minV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_V_AT_VBUS_FAIL]: ["error", "[5] MotV_V too low. V={0:VX1000}V, minV={1:VX1000}V (high FET)"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_W_AT_VBUS_PASS]: ["prc_pass", "[7] MotV_W at VBUS. V={0:VX1000}V, minV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_MOTV_W_AT_VBUS_FAIL]: ["error", "[7] MotV_W too low. V={0:VX1000}V, minV={1:VX1000}V (high FET)"],
    [DIAG_CODE.DIAG_SELFTEST_START]: ["prc", "Self-test started"],
    [DIAG_CODE.DIAG_SELFTEST_PASS]: ["prc_pass", "Self-test PASSED"],
    [DIAG_CODE.DIAG_SELFTEST_FAILED]: ["error", "Self-test FAILED"],
    [DIAG_CODE.DIAG_SELFTEST_END]: ["prc", "Self-test ended"],
    [DIAG_CODE.DIAG_SELFTEST_VBUS_OK]: ["prc_pass", "PRC[0]: VBUS Voltage OK. V={0:VX1000}V in range[{1:VX1000}V .. {2:VX1000}V]"],
    [DIAG_CODE.DIAG_SELFTEST_VBUS_TOO_LOW]: ["error", "PRC[0]: VBUS Voltage too low. V={0:VX1000}V, minV={1:VX1000}V"],
    [DIAG_CODE.DIAG_SELFTEST_VBUS_TOO_HIGH]: ["error", "PRC[0]: VBUS Voltage too high. V={0:VX1000}V, maxV={2:VX1000}V"],
});

/* Codes the firmware can send that the Python table has no entry for. */
const DIAG_CODE_FALLBACK_TRANS = Object.freeze({
    [DIAG_CODE.DIAG_CODE_COMMAND_NO_RECOGNISED]: ["warning", "Command not recognised: {0}"],
    [DIAG_CODE.DIAG_CODE_OPERATIONAL_STATE]:     ["op_state", "Operational state: {0}"],
    [DIAG_CODE.DIAG_CODE_COMMS_HIGH_WATER_MARK]: ["normal",   "Comms buffer high water mark: {0}"],
    [DIAG_CODE.DIAG_CODE_COMMS_BUFFER_FULL]:     ["warning",  "Comms buffer full"],
});


function enumNameFor(type, value) {
    const table = DIAG_ENUMS[type];
    if (!table) return null;
    for (const [name, v] of Object.entries(table)) {
        if (v === value) return name;
    }
    return `${type}?${value}`;
}

/**
 * Expand {n}, {n:d}, {n:VX100}, {n:VX1000}, {n:<ENUM>} ... in a format string.
 * `data` holds the four raw uint32 values.
 */
function formatDiagTemplate(fmt, data) {
    return fmt.replace(/\{(\d+)(?::([A-Za-z0-9_]+))?\}/g, (match, idx, type) => {
        const raw = (data[Number(idx)] >>> 0);
        const signed = raw | 0;
        switch (type) {
            case undefined:    return String(raw);
            case "d":
            case "d32":
            case "s32":
            case "TASK_ID":    return String(signed);
            case "VX100":      return (signed / 100).toFixed(2);
            case "VX1000":     return (signed / 1000).toFixed(2);
            case "POS_REC_DATE": return "(no RTC)";
            case "ON_OFF":     return raw > 0 ? "[SET]" : "[RESET]";
            case "YESNO":      return raw > 0 ? "[YES]" : "[NO]";
            default: {
                const name = enumNameFor(type, raw);
                return name === null ? match : name;
            }
        }
    });
}

/**
 * Turn an unpacked MSG_ID_DIAG_INFO payload into { style, text, powerUp }.
 * `info` = { code, tick, seq, data: [d1, d2, d3, d4] } as returned by unpackDiagInfoPayload.
 */
function describeDiagInfo(info) {
    const codeName = DIAG_CODE_NAMES[info.code];
    const entry = DIAG_CODE_TRANS[info.code] || DIAG_CODE_FALLBACK_TRANS[info.code];

    if (!codeName) {
        return {
            style: "error",
            text: `DIAG_CODE unknown: 0x${info.code.toString(16).toUpperCase().padStart(4, "0")} data=[${info.data.join(", ")}]`,
            powerUp: false
        };
    }
    if (!entry) {
        return { style: "normal", text: `${codeName} data=[${info.data.join(", ")}]`, powerUp: false };
    }
    const [style, fmt] = entry;
    return {
        style,
        text: formatDiagTemplate(fmt, info.data),
        powerUp: info.code === DIAG_CODE.DIAG_CODE_POWER_UP
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DIAG_CODE, DIAG_CODE_NAMES, DIAG_ENUMS, DIAG_CODE_TRANS, formatDiagTemplate, describeDiagInfo };
} else {
    window.DiagCodes = { DIAG_CODE, DIAG_CODE_NAMES, DIAG_ENUMS, DIAG_CODE_TRANS, formatDiagTemplate, describeDiagInfo };
}
