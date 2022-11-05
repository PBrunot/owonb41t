(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.OwonBT = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*
* loglevel - https://github.com/pimterry/loglevel
*
* Copyright (c) 2013 Tim Perry
* Licensed under the MIT license.
*/
(function (root, definition) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = definition();
    } else {
        root.log = definition();
    }
}(this, function () {
    "use strict";

    // Slightly dubious tricks to cut down minimized file size
    var noop = function() {};
    var undefinedType = "undefined";
    var isIE = (typeof window !== undefinedType) && (typeof window.navigator !== undefinedType) && (
        /Trident\/|MSIE /.test(window.navigator.userAgent)
    );

    var logMethods = [
        "trace",
        "debug",
        "info",
        "warn",
        "error"
    ];

    // Cross-browser bind equivalent that works at least back to IE6
    function bindMethod(obj, methodName) {
        var method = obj[methodName];
        if (typeof method.bind === 'function') {
            return method.bind(obj);
        } else {
            try {
                return Function.prototype.bind.call(method, obj);
            } catch (e) {
                // Missing bind shim or IE8 + Modernizr, fallback to wrapping
                return function() {
                    return Function.prototype.apply.apply(method, [obj, arguments]);
                };
            }
        }
    }

    // Trace() doesn't print the message in IE, so for that case we need to wrap it
    function traceForIE() {
        if (console.log) {
            if (console.log.apply) {
                console.log.apply(console, arguments);
            } else {
                // In old IE, native console methods themselves don't have apply().
                Function.prototype.apply.apply(console.log, [console, arguments]);
            }
        }
        if (console.trace) console.trace();
    }

    // Build the best logging method possible for this env
    // Wherever possible we want to bind, not wrap, to preserve stack traces
    function realMethod(methodName) {
        if (methodName === 'debug') {
            methodName = 'log';
        }

        if (typeof console === undefinedType) {
            return false; // No method possible, for now - fixed later by enableLoggingWhenConsoleArrives
        } else if (methodName === 'trace' && isIE) {
            return traceForIE;
        } else if (console[methodName] !== undefined) {
            return bindMethod(console, methodName);
        } else if (console.log !== undefined) {
            return bindMethod(console, 'log');
        } else {
            return noop;
        }
    }

    // These private functions always need `this` to be set properly

    function replaceLoggingMethods(level, loggerName) {
        /*jshint validthis:true */
        for (var i = 0; i < logMethods.length; i++) {
            var methodName = logMethods[i];
            this[methodName] = (i < level) ?
                noop :
                this.methodFactory(methodName, level, loggerName);
        }

        // Define log.log as an alias for log.debug
        this.log = this.debug;
    }

    // In old IE versions, the console isn't present until you first open it.
    // We build realMethod() replacements here that regenerate logging methods
    function enableLoggingWhenConsoleArrives(methodName, level, loggerName) {
        return function () {
            if (typeof console !== undefinedType) {
                replaceLoggingMethods.call(this, level, loggerName);
                this[methodName].apply(this, arguments);
            }
        };
    }

    // By default, we use closely bound real methods wherever possible, and
    // otherwise we wait for a console to appear, and then try again.
    function defaultMethodFactory(methodName, level, loggerName) {
        /*jshint validthis:true */
        return realMethod(methodName) ||
               enableLoggingWhenConsoleArrives.apply(this, arguments);
    }

    function Logger(name, defaultLevel, factory) {
      var self = this;
      var currentLevel;
      defaultLevel = defaultLevel == null ? "WARN" : defaultLevel;

      var storageKey = "loglevel";
      if (typeof name === "string") {
        storageKey += ":" + name;
      } else if (typeof name === "symbol") {
        storageKey = undefined;
      }

      function persistLevelIfPossible(levelNum) {
          var levelName = (logMethods[levelNum] || 'silent').toUpperCase();

          if (typeof window === undefinedType || !storageKey) return;

          // Use localStorage if available
          try {
              window.localStorage[storageKey] = levelName;
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=" + levelName + ";";
          } catch (ignore) {}
      }

      function getPersistedLevel() {
          var storedLevel;

          if (typeof window === undefinedType || !storageKey) return;

          try {
              storedLevel = window.localStorage[storageKey];
          } catch (ignore) {}

          // Fallback to cookies if local storage gives us nothing
          if (typeof storedLevel === undefinedType) {
              try {
                  var cookie = window.document.cookie;
                  var location = cookie.indexOf(
                      encodeURIComponent(storageKey) + "=");
                  if (location !== -1) {
                      storedLevel = /^([^;]+)/.exec(cookie.slice(location))[1];
                  }
              } catch (ignore) {}
          }

          // If the stored level is not valid, treat it as if nothing was stored.
          if (self.levels[storedLevel] === undefined) {
              storedLevel = undefined;
          }

          return storedLevel;
      }

      function clearPersistedLevel() {
          if (typeof window === undefinedType || !storageKey) return;

          // Use localStorage if available
          try {
              window.localStorage.removeItem(storageKey);
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
          } catch (ignore) {}
      }

      /*
       *
       * Public logger API - see https://github.com/pimterry/loglevel for details
       *
       */

      self.name = name;

      self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
          "ERROR": 4, "SILENT": 5};

      self.methodFactory = factory || defaultMethodFactory;

      self.getLevel = function () {
          return currentLevel;
      };

      self.setLevel = function (level, persist) {
          if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
              level = self.levels[level.toUpperCase()];
          }
          if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
              currentLevel = level;
              if (persist !== false) {  // defaults to true
                  persistLevelIfPossible(level);
              }
              replaceLoggingMethods.call(self, level, name);
              if (typeof console === undefinedType && level < self.levels.SILENT) {
                  return "No console available for logging";
              }
          } else {
              throw "log.setLevel() called with invalid level: " + level;
          }
      };

      self.setDefaultLevel = function (level) {
          defaultLevel = level;
          if (!getPersistedLevel()) {
              self.setLevel(level, false);
          }
      };

      self.resetLevel = function () {
          self.setLevel(defaultLevel, false);
          clearPersistedLevel();
      };

      self.enableAll = function(persist) {
          self.setLevel(self.levels.TRACE, persist);
      };

      self.disableAll = function(persist) {
          self.setLevel(self.levels.SILENT, persist);
      };

      // Initialize with the right level
      var initialLevel = getPersistedLevel();
      if (initialLevel == null) {
          initialLevel = defaultLevel;
      }
      self.setLevel(initialLevel, false);
    }

    /*
     *
     * Top-level API
     *
     */

    var defaultLogger = new Logger();

    var _loggersByName = {};
    defaultLogger.getLogger = function getLogger(name) {
        if ((typeof name !== "symbol" && typeof name !== "string") || name === "") {
          throw new TypeError("You must supply a name when creating a logger.");
        }

        var logger = _loggersByName[name];
        if (!logger) {
          logger = _loggersByName[name] = new Logger(
            name, defaultLogger.getLevel(), defaultLogger.methodFactory);
        }
        return logger;
    };

    // Grab the current global log variable in case of overwrite
    var _log = (typeof window !== undefinedType) ? window.log : undefined;
    defaultLogger.noConflict = function() {
        if (typeof window !== undefinedType &&
               window.log === defaultLogger) {
            window.log = _log;
        }

        return defaultLogger;
    };

    defaultLogger.getLoggers = function getLoggers() {
        return _loggersByName;
    };

    // ES6 default export, for compatibility
    defaultLogger['default'] = defaultLogger;

    return defaultLogger;
}));

},{}],2:[function(require,module,exports){
'use strict';

const log = require("loglevel");
const BT = require("./webbluetooth");
const utils = require("./utils");
const State = BT.State;
const btState = BT.btState;

async function Start() {
    log.info("Start called...");

    if (!btState.started) {
        btState.state = State.NOT_CONNECTED;
        BT.stateMachine(); // Start it
    }
    else if (btState.state == State.ERROR) {
        btState.state = State.NOT_CONNECTED; // Try to restart
    }
    await utils.waitFor(() => btState.state == State.IDLE || btState.state == State.STOPPED);
    log.info("Pairing completed, state :", btState.state);
    return (btState.state != State.STOPPED);
}

async function Stop() {
    log.info("Stop request received");

    btState.stopRequest = true;
    await utils.sleep(100);

    while(btState.started || (btState.state != State.STOPPED && btState.state != State.NOT_CONNECTED))
    {
        btState.stopRequest = true;    
        await utils.sleep(100);
    }
    btState.command = null;
    btState.stopRequest = false;
    log.warn("Stopped on request.");
    return true;
}

function SetLogLevel(level) {
    log.setLevel(level, false);
}

exports.Start = Start;
exports.Stop = Stop;
exports.SetLogLevel = SetLogLevel;
exports.btState = BT.btState;
exports.State = BT.State;

},{"./utils":3,"./webbluetooth":4,"loglevel":1}],3:[function(require,module,exports){
'use strict';

let sleep = ms => new Promise(r => setTimeout(r, ms));
let waitFor = async function waitFor(f) {
    while (!f()) await sleep(100 + Math.random() * 25);
    return f();
};

let waitForTimeout = async function waitFor(f, timeoutSec) {
    var totalTimeMs = 0;
    while (!f() && totalTimeMs < timeoutSec * 1000) {
        var delayMs = 100 + Math.random() * 25;
        totalTimeMs += delayMs;
        await sleep(delayMs);
    }
    return f();
};

/**
 * Helper function to convert a value into an enum value
 * 
 * @param {type} enumtype
 * @param {number} enumvalue
 */
 function Parse(enumtype, enumvalue) {
    for (var enumName in enumtype) {
        if (enumtype[enumName] == enumvalue) {
            /*jshint -W061 */
            return eval([enumtype + "." + enumName]);
        }
    }
    return null;
}

/**
 * Helper function to dump arraybuffer as hex string
 * @param {ArrayBuffer} buffer
 */
 function buf2hex(buffer) { // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join(' ');
}

function hex2buf (input) {
    if (typeof input !== 'string') {
        throw new TypeError('Expected input to be a string')
    }
    var hexstr = input.replace(/\s+/g, '');
    if ((hexstr.length % 2) !== 0) {
        throw new RangeError('Expected string to be an even number of characters')
    }

    const view = new Uint8Array(hexstr.length / 2)

    for (let i = 0; i < hexstr.length; i += 2) {
        view[i / 2] = parseInt(hexstr.substring(i, i + 2), 16)
    }

    return view.buffer
}

module.exports = { sleep, waitFor, waitForTimeout, Parse, buf2hex, hex2buf };
},{}],4:[function(require,module,exports){
'use strict';

/**
 *  Bluetooth handling module, including main state machine loop.
 *  This module interacts with browser for bluetooth comunications and pairing, and with SenecaMSC object.
 */

const log = require('loglevel');
const utils = require('./utils');

var simulation = false;

/*
 * Bluetooth constants
 */
const BlueToothOWON = {
    ServiceUuid: '0000fff0-0000-1000-8000-00805f9b34fb', // bluetooth service for Owon B41T+
    NotificationsUuid: '0000fff4-0000-1000-8000-00805f9b34fb',
};

/*
 * Internal state machine descriptions
 */
const State = {
    NOT_CONNECTED: 'Not connected',
    CONNECTING: 'Bluetooth device pairing...',
    DEVICE_PAIRED: 'Device paired',
    SUBSCRIBING: 'Bluetooth interfaces connecting...',
    IDLE: 'Idle',
    BUSY: 'Busy',
    ERROR: 'Error',
    STOPPING: 'Closing BT interfaces...',
    STOPPED: 'Stopped',
    METER_INIT: 'Meter connected',
    METER_INITIALIZING: 'Reading meter state...'
};

class APIState {
    constructor() {
        this.state = State.NOT_CONNECTED;
        this.prev_state = State.NOT_CONNECTED;
        this.state_cpt = 0;

        this.started = false; // State machine status
        this.stopRequest = false; // To request disconnect
        

        // last notification
        this.response = null;
        this.responseTimeStamp = new Date();
        this.parsedResponse = null;
        this.formattedResponse = '';

        // bluetooth properties
        this.charRead = null;
        this.btService = null;
        this.btDevice = null;

        // general statistics for debugging
        this.stats = {
            "requests": 0,
            "responses": 0,
            "modbus_errors": 0,
            "GATT disconnects": 0,
            "exceptions": 0,
            "subcribes": 0,
            "commands": 0,
            "responseTime": 0.0,
            "lastResponseTime": 0.0,
            "last_connect": new Date(2020, 1, 1).toISOString()
        };

        this.options = {
            "forceDeviceSelection" : true
        }
    }
}

let btState = new APIState();

/**
 * Main loop of the meter handler.
 * */
async function stateMachine() {
    var nextAction;
    var DELAY_MS = (simulation ? 20 : 600); // Update the status every X ms.
    var TIMEOUT_MS = (simulation ? 1000 : 30000); // Give up some operations after X ms.
    btState.started = true;

    log.debug("Current state:" + btState.state);

    // Consecutive state counted. Can be used to timeout.
    if (btState.state == btState.prev_state) {
        btState.state_cpt++;
    } else {
        btState.state_cpt = 0;
    }

    // Stop request from API
    if (btState.stopRequest) {
        btState.state = State.STOPPING;
    }

    log.debug("\State:" + btState.state);
    switch (btState.state) {
        case State.NOT_CONNECTED: // initial state on Start()
            if (simulation) {
                nextAction = fakePairDevice;
            } else {
                nextAction = btPairDevice;
            }
            break;
        case State.CONNECTING: // waiting for connection to complete
            nextAction = undefined;
            break;
        case State.DEVICE_PAIRED: // connection complete, acquire meter state
            if (simulation) {
                nextAction = fakeSubscribe;
            } else {
                nextAction = btSubscribe;
            }
            break;
        case State.SUBSCRIBING: // waiting for Bluetooth interfaces
            nextAction = undefined;
            if (btState.state_cpt > (TIMEOUT_MS / DELAY_MS)) {
                // Timeout, try to resubscribe
                log.warn("Timeout in SUBSCRIBING");
                btState.state = State.DEVICE_PAIRED;
                btState.state_cpt = 0;
            }
            break;
        case State.METER_INIT: // ready to communicate, acquire meter status
            nextAction = meterInit;
            break;
        case State.METER_INITIALIZING: // reading the meter status
            if (btState.state_cpt > (TIMEOUT_MS / DELAY_MS)) {
                log.warn("Timeout in METER_INITIALIZING");
                // Timeout, try to resubscribe
                if (simulation) {
                    nextAction = fakeSubscribe;
                } else {
                    nextAction = btSubscribe;
                }
                btState.state_cpt = 0;
            }
            nextAction = undefined;
            break;
        case State.IDLE: // ready to process commands from API
            if (btState.command != null)
                nextAction = processCommand;
            else {
                nextAction = refresh;
            }
            break;
        case State.ERROR: // anytime an error happens
            nextAction = disconnect;
            break;
        case State.BUSY: // while a command in going on
            if (btState.state_cpt > (TIMEOUT_MS / DELAY_MS)) {
                log.warn("Timeout in BUSY");
                // Timeout, try to resubscribe
                if (simulation) {
                    nextAction = fakeSubscribe;
                } else {
                    nextAction = btSubscribe;
                }
                btState.state_cpt = 0;
            }
            nextAction = undefined;
            break;
        case State.STOPPING:
            nextAction = disconnect;
            break;
        case State.STOPPED: // after a disconnector or Stop() request, stops the state machine.
            nextAction = undefined;
            break;
        default:
            break;
    }

    btState.prev_state = btState.state;

    if (nextAction != undefined) {
        log.debug("\tExecuting:" + nextAction.name);
        try {
            await nextAction();
        }
        catch (e) {
            log.error("Exception in state machine", e);
        }
    }
    if (btState.state != State.STOPPED) {
        utils.sleep(DELAY_MS).then(() => stateMachine()); // Recheck status in DELAY_MS ms
    }
    else {
        log.debug("\tTerminating State machine");
        btState.started = false;
    }
}

/**
 * Called from state machine to execute a single command from btState.command property
 * */
async function processCommand() {
    try {
        command.error = false;
        command.pending = false;
        btState.command = null;

        btState.state = State.IDLE;
        log.debug("\t\tCompleted command executed");
    }
    catch (err) {
        log.error("** error while executing command: " + err);
        btState.state = State.METER_INIT;
        btState.stats["exceptions"]++;
        if (err instanceof modbus.ModbusError)
            btState.stats["modbus_errors"]++;
        return;
    }
}


/**
 * Acquire the current mode and serial number of the device.
 * */
async function meterInit() {
    btState.state = State.IDLE;
}

/*
 * Close the bluetooth interface (unpair)
 * */
async function disconnect() {
    btState.command = null;
    try {
        if (btState.btDevice != null) {
            if (btState.btDevice?.gatt?.connected) {
                log.warn("* Calling disconnect on btdevice");
                // Avoid the event firing which may lead to auto-reconnect
                btState.btDevice.removeEventListener('gattserverdisconnected', onDisconnected);
                btState.btDevice.gatt.disconnect();
            }
        }
        btState.btService = null;
    }
    catch { }
    btState.state = State.STOPPED;
}

/**
 * Event called by browser BT api when the device disconnect
 * */
async function onDisconnected() {
    log.warn("* GATT Server disconnected event, will try to reconnect *");
    btState.btService = null;
    btState.stats["GATT disconnects"]++;
    btState.state = State.DEVICE_PAIRED; // Try to auto-reconnect the interfaces without pairing
}

/**
 * Joins the arguments into a single buffer
 * @returns {Buffer} concatenated buffer
 */
function arrayBufferConcat() {
    var length = 0;
    var buffer = null;

    for (var i in arguments) {
        buffer = arguments[i];
        length += buffer.byteLength;
    }

    var joined = new Uint8Array(length);
    var offset = 0;

    for (i in arguments) {
        buffer = arguments[i];
        joined.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    }

    return joined.buffer;
}

/**
 * Event called by bluetooth characteristics when receiving data
 * @param {any} event
 */
function handleNotifications(event) {
    let value = event.target.value;
    if (value != null) {
        log.debug('<< ' + utils.buf2hex(value.buffer));
        if (btState.response != null) {
            btState.response = arrayBufferConcat(btState.response, value.buffer);
        } else {
            btState.response = value.buffer.slice();
        }
        btState.responseTimeStamp = new Date();
    }
}

/* OWON */

const DCV = 0x0;
const ACV = 0x1;
const DCA = 0x2;
const ACA = 0x3;
const Ohm = 0x4;
const Cap = 0x5;
const Hz = 0x6;
const Duty = 0x7;
const TempC = 0x8;
const TempF = 0x9;
const Diode = 0xA;
const Continuity = 0xB;
const hFE = 0xC;

function formatParsedResponse(fun, measurement, scale, overload) {
    var measure = "?";
    var units = "";

    switch (fun) {
        case DCV:
            measure = "Vdc=";
            units = "V";
            break;
        case ACV:
            measure = "Vac=";
            units = "V";
            break;
        case DCA:
            measure = "Idc=";
            units = "A";
            break;
        case ACA:
            units = "Iac=";
            units = "A";
            break;
        case Ohm:
            measure = "R=";
            units = "Ohms";
            break;
        case Cap:
            measure = "C=";
            units = "F";
            break;
        case Hz:
            measure = "Frequency=";
            units = "Hz";
            break;
        case Duty:
            measure = "Duty=";
            units = "%";
            break;
        case TempC:
            measure = "Temperature=";
            units = "°C";
            break;
        case TempF:
            measure = "Temperature=";
            units = "F";
            break;
        case Diode:
            measure = "Diode=";
            units = "V";
            break;
        case Continuity:
            measure = "Continuity=";
            units = "Ohms";
            break;
        case hFE:
            measure = "hFE=";
            units = "";
            break;
        default:
            measure = "?=";
            units = "?";
            break;
    }

    switch (scale) {
        case 0:
        case 1:
            scale = "n";
            break;
        case 2:
            scale = "micro";
            break;
        case 3:
            scale = "m";
            break;
        case 4:
            scale = "";
            break;
        case 5:
            scale = "kilo";
            break;
        case 6:
            scale = "mega";
            break;
    }
    if (overload) {
        return measure + " **OVERLOAD** " + scale + units;
    }
    else {
        return measure + measurement + " " + scale + units;
    }
}

function parseResponse(buffer, timestamp) {
    let value = new DataView(buffer);
    var measurement = NaN;

    // See README.md on https://github.com/DeanCording/owonb35
    var func = (value.getUint16(0, true) >> 6) & 0x0f;
    var decimal = value.getUint8(0) & 0x07;
    var scale = (value.getUint8(0) >> 3) & 0x07;
    var uint16val = value.getUint8(4) + 256 * value.getUint8(5);
    if (uint16val < 0x7fff) {
        measurement = uint16val / Math.pow(10.0, decimal);
    } else {
        measurement = -1.0 * (uint16val & 0x7fff) / Math.pow(10.0, decimal);
    }
    var overload = (decimal == 0x07);

    var normalization = 1.0;
    switch (scale) {
        case 0:
        case 1:
            normalization = 0.000000001;
            break;
        case 2:
            normalization = 0.000001;
            break;
        case 3:
            normalization = 0.001;
            break;
        case 4:
            normalization = 1.0;
            break;
        case 5:
            normalization = 1000.0;
            break;
        case 6:
            normalization = 1000000.0;
            break;
    }
    var functionDesc = '';
    switch (func) {
        case DCV:
            functionDesc = "Voltage (DC) - V";
            break;
        case ACV:
            functionDesc = "Voltage (AC) - V";
            break;
        case DCA:
            functionDesc = "Current (DC) - A"
            break;
        case ACA:
            functionDesc = "Current (AC) - A"
            break;
        case Ohm:
            functionDesc = "Resistance - Ohms"
            break;
        case Cap:
            functionDesc = "Capacitance - F"
            break;
        case Hz:
            functionDesc = "Frequency - Hz"
            break;
        case Duty:
            functionDesc = "Duty cycle - %"
            break;
        case TempC:
            functionDesc = "Temperature - °C"
            break;
        case TempF:
            functionDesc = "Temperature - °F";
            break;
        case Diode:
            functionDesc = "Diode - V";
            break;
        case Continuity:
            functionDesc = "Continuity - Ohms";
            break;
        case hFE:
            functionDesc = "hFE";
            break;
        default:
            functionDesc = "?";
            break;
    }

    btState.parsedResponse = { 
                         "Function": func, 
                         "Function description": functionDesc,
                         "Measurement": measurement, 
                         "Scale": scale,
                         "Overload": overload, 
                         "Timestamp": timestamp, 
                         "Value" : measurement*normalization };
    btState.formattedResponse = formatParsedResponse(func, measurement, scale, overload);
}


/**
 * This function will succeed only if called as a consequence of a user-gesture
 * E.g. button click. This is due to BlueTooth API security model.
 * */
async function btPairDevice() {
    btState.state = State.CONNECTING;
    var forceSelection = true;
    log.debug("btPairDevice(" + forceSelection + ")");
    try {
        if (typeof (navigator.bluetooth?.getAvailability) == 'function') {
            const availability = await navigator.bluetooth.getAvailability();
            if (!availability) {
                log.error("Bluetooth not available in browser.");
                throw new Error("Browser does not provide bluetooth");
            }
        }
        var device = null;

        // If not, request from user
        if (device == null) {
            device = await navigator.bluetooth
                .requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [BlueToothOWON.ServiceUuid]
                });
        }
        btState.btDevice = device;
        btState.state = State.DEVICE_PAIRED;
        log.info("Bluetooth device " + device.name + " connected.");
        await utils.sleep(500);
    }
    catch (err) {
        log.warn("** error while connecting: " + err.message);
        btState.btService = null;
        if (btState.charRead != null) {
            try {
                btState.charRead.stopNotifications();
            } catch (error) { }
        }
        btState.charRead = null;
        btState.state = State.ERROR;
        btState.stats["exceptions"]++;
    }
}

async function fakePairDevice() {
    btState.state = State.CONNECTING;
    var forceSelection = true;
    log.debug("fakePairDevice(" + forceSelection + ")");
    try {
        var device = { name: "FakeBTDevice", gatt: { connected: true } };
        btState.btDevice = device;
        btState.state = State.DEVICE_PAIRED;
        log.info("Bluetooth device " + device.name + " connected.");
        await utils.sleep(50);
    }
    catch (err) {
        log.warn("** error while connecting: " + err.message);
        btState.btService = null;
        btState.charRead = null;
        btState.state = State.ERROR;
        btState.stats["exceptions"]++;
    }
}

/**
 * Once the device is available, initialize the service and the 2 characteristics needed.
 * */
async function btSubscribe() {
    try {
        btState.state = State.SUBSCRIBING;
        btState.stats["subcribes"]++;
        let device = btState.btDevice;
        let server = null;

        if (!device?.gatt?.connected) {
            log.debug(`Connecting to GATT Server on ${device.name}...`);
            device.addEventListener('gattserverdisconnected', onDisconnected);
            try {
                if (btState.btService?.connected) {
                    btState.btService.disconnect();
                    btState.btService = null;
                    await utils.sleep(100);
                }
            } catch (err) { }

            server = await device.gatt.connect();
            log.debug('> Found GATT server');
        }
        else {
            log.debug('GATT already connected');
            server = device.gatt;
        }

        btState.btService = await server.getPrimaryService(BlueToothOWON.ServiceUuid);
        if (btState.btService == null)
            throw new Error("GATT Service request failed");
        log.debug('> Found Owon service');
        btState.charRead = await btState.btService.getCharacteristic(BlueToothOWON.NotificationsUuid);
        log.debug('> Found notifications characteristic');
        btState.response = null;
        btState.charRead.addEventListener('characteristicvaluechanged', handleNotifications);
        btState.charRead.startNotifications();
        log.info('> Bluetooth interfaces ready.');
        btState.stats["last_connect"] = new Date().toISOString();
        await utils.sleep(50);
        btState.state = State.METER_INIT;
    }
    catch (err) {
        log.warn("** error while subscribing: " + err.message);
        if (btState.charRead != null) {
            try {
                if (btState.btDevice?.gatt?.connected) {
                    btState.charRead.stopNotifications();
                }
                btState.btDevice?.gatt.disconnect();
            } catch (error) { }
        }
        btState.charRead = null;
        btState.state = State.DEVICE_PAIRED;
        btState.stats["exceptions"]++;
    }
}

async function fakeSubscribe() {
    try {
        btState.state = State.SUBSCRIBING;
        btState.stats["subcribes"]++;
        let device = btState.btDevice;
        let server = null;

        if (!device?.gatt?.connected) {
            log.debug(`Connecting to GATT Server on ${device.name}...`);
            device['gatt']['connected'] = true;
            log.debug('> Found GATT server');
        }
        else {
            log.debug('GATT already connected');
            server = device.gatt;
        }

        btState.btService = {};
        log.debug('> Found Serial service');
        btState.charRead = {};
        log.debug('> Found read characteristic');
        btState.response = null;
        log.info('> Bluetooth interfaces ready.');
        btState.stats["last_connect"] = new Date().toISOString();
        await utils.sleep(10);
        btState.state = State.METER_INIT;
    }
    catch (err) {
        log.warn("** error while subscribing: " + err.message);
        btState.charRead = null;
        btState.state = State.DEVICE_PAIRED;
        btState.stats["exceptions"]++;
    }
}


/**
 * When idle, this function is called
 * */
async function refresh() {
    btState.state = State.BUSY;
    try
    {
        if (btState != null && btState.response != null)
        {
            parseResponse(btState.response, btState.responseTimeStamp);
            btState.response = null;
        }
        log.debug("\t\tFinished refreshing current state");
    }
    catch (err) {
        log.warn("** error while refreshing: " + err.message);
    }
    btState.state = State.IDLE;
}

function SetSimulation(value) {
    simulation = value;
}

module.exports = { stateMachine, SetSimulation, btState, State };
},{"./utils":3,"loglevel":1}]},{},[2])(2)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbG9nbGV2ZWwvbGliL2xvZ2xldmVsLmpzIiwib3dvbi5qcyIsInV0aWxzLmpzIiwid2ViYmx1ZXRvb3RoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKlxuKiBsb2dsZXZlbCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9waW10ZXJyeS9sb2dsZXZlbFxuKlxuKiBDb3B5cmlnaHQgKGMpIDIwMTMgVGltIFBlcnJ5XG4qIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiovXG4oZnVuY3Rpb24gKHJvb3QsIGRlZmluaXRpb24pIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShkZWZpbml0aW9uKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gZGVmaW5pdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJvb3QubG9nID0gZGVmaW5pdGlvbigpO1xuICAgIH1cbn0odGhpcywgZnVuY3Rpb24gKCkge1xuICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgLy8gU2xpZ2h0bHkgZHViaW91cyB0cmlja3MgdG8gY3V0IGRvd24gbWluaW1pemVkIGZpbGUgc2l6ZVxuICAgIHZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcbiAgICB2YXIgdW5kZWZpbmVkVHlwZSA9IFwidW5kZWZpbmVkXCI7XG4gICAgdmFyIGlzSUUgPSAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSkgJiYgKHR5cGVvZiB3aW5kb3cubmF2aWdhdG9yICE9PSB1bmRlZmluZWRUeXBlKSAmJiAoXG4gICAgICAgIC9UcmlkZW50XFwvfE1TSUUgLy50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KVxuICAgICk7XG5cbiAgICB2YXIgbG9nTWV0aG9kcyA9IFtcbiAgICAgICAgXCJ0cmFjZVwiLFxuICAgICAgICBcImRlYnVnXCIsXG4gICAgICAgIFwiaW5mb1wiLFxuICAgICAgICBcIndhcm5cIixcbiAgICAgICAgXCJlcnJvclwiXG4gICAgXTtcblxuICAgIC8vIENyb3NzLWJyb3dzZXIgYmluZCBlcXVpdmFsZW50IHRoYXQgd29ya3MgYXQgbGVhc3QgYmFjayB0byBJRTZcbiAgICBmdW5jdGlvbiBiaW5kTWV0aG9kKG9iaiwgbWV0aG9kTmFtZSkge1xuICAgICAgICB2YXIgbWV0aG9kID0gb2JqW21ldGhvZE5hbWVdO1xuICAgICAgICBpZiAodHlwZW9mIG1ldGhvZC5iaW5kID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICByZXR1cm4gbWV0aG9kLmJpbmQob2JqKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kLmNhbGwobWV0aG9kLCBvYmopO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIE1pc3NpbmcgYmluZCBzaGltIG9yIElFOCArIE1vZGVybml6ciwgZmFsbGJhY2sgdG8gd3JhcHBpbmdcbiAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYXBwbHkobWV0aG9kLCBbb2JqLCBhcmd1bWVudHNdKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVHJhY2UoKSBkb2Vzbid0IHByaW50IHRoZSBtZXNzYWdlIGluIElFLCBzbyBmb3IgdGhhdCBjYXNlIHdlIG5lZWQgdG8gd3JhcCBpdFxuICAgIGZ1bmN0aW9uIHRyYWNlRm9ySUUoKSB7XG4gICAgICAgIGlmIChjb25zb2xlLmxvZykge1xuICAgICAgICAgICAgaWYgKGNvbnNvbGUubG9nLmFwcGx5KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkoY29uc29sZSwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gb2xkIElFLCBuYXRpdmUgY29uc29sZSBtZXRob2RzIHRoZW1zZWx2ZXMgZG9uJ3QgaGF2ZSBhcHBseSgpLlxuICAgICAgICAgICAgICAgIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5hcHBseShjb25zb2xlLmxvZywgW2NvbnNvbGUsIGFyZ3VtZW50c10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjb25zb2xlLnRyYWNlKSBjb25zb2xlLnRyYWNlKCk7XG4gICAgfVxuXG4gICAgLy8gQnVpbGQgdGhlIGJlc3QgbG9nZ2luZyBtZXRob2QgcG9zc2libGUgZm9yIHRoaXMgZW52XG4gICAgLy8gV2hlcmV2ZXIgcG9zc2libGUgd2Ugd2FudCB0byBiaW5kLCBub3Qgd3JhcCwgdG8gcHJlc2VydmUgc3RhY2sgdHJhY2VzXG4gICAgZnVuY3Rpb24gcmVhbE1ldGhvZChtZXRob2ROYW1lKSB7XG4gICAgICAgIGlmIChtZXRob2ROYW1lID09PSAnZGVidWcnKSB7XG4gICAgICAgICAgICBtZXRob2ROYW1lID0gJ2xvZyc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgPT09IHVuZGVmaW5lZFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gTm8gbWV0aG9kIHBvc3NpYmxlLCBmb3Igbm93IC0gZml4ZWQgbGF0ZXIgYnkgZW5hYmxlTG9nZ2luZ1doZW5Db25zb2xlQXJyaXZlc1xuICAgICAgICB9IGVsc2UgaWYgKG1ldGhvZE5hbWUgPT09ICd0cmFjZScgJiYgaXNJRSkge1xuICAgICAgICAgICAgcmV0dXJuIHRyYWNlRm9ySUU7XG4gICAgICAgIH0gZWxzZSBpZiAoY29uc29sZVttZXRob2ROYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gYmluZE1ldGhvZChjb25zb2xlLCBtZXRob2ROYW1lKTtcbiAgICAgICAgfSBlbHNlIGlmIChjb25zb2xlLmxvZyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gYmluZE1ldGhvZChjb25zb2xlLCAnbG9nJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbm9vcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRoZXNlIHByaXZhdGUgZnVuY3Rpb25zIGFsd2F5cyBuZWVkIGB0aGlzYCB0byBiZSBzZXQgcHJvcGVybHlcblxuICAgIGZ1bmN0aW9uIHJlcGxhY2VMb2dnaW5nTWV0aG9kcyhsZXZlbCwgbG9nZ2VyTmFtZSkge1xuICAgICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxvZ01ldGhvZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBtZXRob2ROYW1lID0gbG9nTWV0aG9kc1tpXTtcbiAgICAgICAgICAgIHRoaXNbbWV0aG9kTmFtZV0gPSAoaSA8IGxldmVsKSA/XG4gICAgICAgICAgICAgICAgbm9vcCA6XG4gICAgICAgICAgICAgICAgdGhpcy5tZXRob2RGYWN0b3J5KG1ldGhvZE5hbWUsIGxldmVsLCBsb2dnZXJOYW1lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERlZmluZSBsb2cubG9nIGFzIGFuIGFsaWFzIGZvciBsb2cuZGVidWdcbiAgICAgICAgdGhpcy5sb2cgPSB0aGlzLmRlYnVnO1xuICAgIH1cblxuICAgIC8vIEluIG9sZCBJRSB2ZXJzaW9ucywgdGhlIGNvbnNvbGUgaXNuJ3QgcHJlc2VudCB1bnRpbCB5b3UgZmlyc3Qgb3BlbiBpdC5cbiAgICAvLyBXZSBidWlsZCByZWFsTWV0aG9kKCkgcmVwbGFjZW1lbnRzIGhlcmUgdGhhdCByZWdlbmVyYXRlIGxvZ2dpbmcgbWV0aG9kc1xuICAgIGZ1bmN0aW9uIGVuYWJsZUxvZ2dpbmdXaGVuQ29uc29sZUFycml2ZXMobWV0aG9kTmFtZSwgbGV2ZWwsIGxvZ2dlck5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gdW5kZWZpbmVkVHlwZSkge1xuICAgICAgICAgICAgICAgIHJlcGxhY2VMb2dnaW5nTWV0aG9kcy5jYWxsKHRoaXMsIGxldmVsLCBsb2dnZXJOYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzW21ldGhvZE5hbWVdLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQnkgZGVmYXVsdCwgd2UgdXNlIGNsb3NlbHkgYm91bmQgcmVhbCBtZXRob2RzIHdoZXJldmVyIHBvc3NpYmxlLCBhbmRcbiAgICAvLyBvdGhlcndpc2Ugd2Ugd2FpdCBmb3IgYSBjb25zb2xlIHRvIGFwcGVhciwgYW5kIHRoZW4gdHJ5IGFnYWluLlxuICAgIGZ1bmN0aW9uIGRlZmF1bHRNZXRob2RGYWN0b3J5KG1ldGhvZE5hbWUsIGxldmVsLCBsb2dnZXJOYW1lKSB7XG4gICAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICAgIHJldHVybiByZWFsTWV0aG9kKG1ldGhvZE5hbWUpIHx8XG4gICAgICAgICAgICAgICBlbmFibGVMb2dnaW5nV2hlbkNvbnNvbGVBcnJpdmVzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gTG9nZ2VyKG5hbWUsIGRlZmF1bHRMZXZlbCwgZmFjdG9yeSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIGN1cnJlbnRMZXZlbDtcbiAgICAgIGRlZmF1bHRMZXZlbCA9IGRlZmF1bHRMZXZlbCA9PSBudWxsID8gXCJXQVJOXCIgOiBkZWZhdWx0TGV2ZWw7XG5cbiAgICAgIHZhciBzdG9yYWdlS2V5ID0gXCJsb2dsZXZlbFwiO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHN0b3JhZ2VLZXkgKz0gXCI6XCIgKyBuYW1lO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikge1xuICAgICAgICBzdG9yYWdlS2V5ID0gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBwZXJzaXN0TGV2ZWxJZlBvc3NpYmxlKGxldmVsTnVtKSB7XG4gICAgICAgICAgdmFyIGxldmVsTmFtZSA9IChsb2dNZXRob2RzW2xldmVsTnVtXSB8fCAnc2lsZW50JykudG9VcHBlckNhc2UoKTtcblxuICAgICAgICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSB1bmRlZmluZWRUeXBlIHx8ICFzdG9yYWdlS2V5KSByZXR1cm47XG5cbiAgICAgICAgICAvLyBVc2UgbG9jYWxTdG9yYWdlIGlmIGF2YWlsYWJsZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Vbc3RvcmFnZUtleV0gPSBsZXZlbE5hbWU7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG5cbiAgICAgICAgICAvLyBVc2Ugc2Vzc2lvbiBjb29raWUgYXMgZmFsbGJhY2tcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICB3aW5kb3cuZG9jdW1lbnQuY29va2llID1cbiAgICAgICAgICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RvcmFnZUtleSkgKyBcIj1cIiArIGxldmVsTmFtZSArIFwiO1wiO1xuICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZ2V0UGVyc2lzdGVkTGV2ZWwoKSB7XG4gICAgICAgICAgdmFyIHN0b3JlZExldmVsO1xuXG4gICAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IHVuZGVmaW5lZFR5cGUgfHwgIXN0b3JhZ2VLZXkpIHJldHVybjtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHN0b3JlZExldmVsID0gd2luZG93LmxvY2FsU3RvcmFnZVtzdG9yYWdlS2V5XTtcbiAgICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG5cbiAgICAgICAgICAvLyBGYWxsYmFjayB0byBjb29raWVzIGlmIGxvY2FsIHN0b3JhZ2UgZ2l2ZXMgdXMgbm90aGluZ1xuICAgICAgICAgIGlmICh0eXBlb2Ygc3RvcmVkTGV2ZWwgPT09IHVuZGVmaW5lZFR5cGUpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIHZhciBjb29raWUgPSB3aW5kb3cuZG9jdW1lbnQuY29va2llO1xuICAgICAgICAgICAgICAgICAgdmFyIGxvY2F0aW9uID0gY29va2llLmluZGV4T2YoXG4gICAgICAgICAgICAgICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0b3JhZ2VLZXkpICsgXCI9XCIpO1xuICAgICAgICAgICAgICAgICAgaWYgKGxvY2F0aW9uICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gL14oW147XSspLy5leGVjKGNvb2tpZS5zbGljZShsb2NhdGlvbikpWzFdO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gSWYgdGhlIHN0b3JlZCBsZXZlbCBpcyBub3QgdmFsaWQsIHRyZWF0IGl0IGFzIGlmIG5vdGhpbmcgd2FzIHN0b3JlZC5cbiAgICAgICAgICBpZiAoc2VsZi5sZXZlbHNbc3RvcmVkTGV2ZWxdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgc3RvcmVkTGV2ZWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHN0b3JlZExldmVsO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBjbGVhclBlcnNpc3RlZExldmVsKCkge1xuICAgICAgICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSB1bmRlZmluZWRUeXBlIHx8ICFzdG9yYWdlS2V5KSByZXR1cm47XG5cbiAgICAgICAgICAvLyBVc2UgbG9jYWxTdG9yYWdlIGlmIGF2YWlsYWJsZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShzdG9yYWdlS2V5KTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cblxuICAgICAgICAgIC8vIFVzZSBzZXNzaW9uIGNvb2tpZSBhcyBmYWxsYmFja1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5kb2N1bWVudC5jb29raWUgPVxuICAgICAgICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdG9yYWdlS2V5KSArIFwiPTsgZXhwaXJlcz1UaHUsIDAxIEphbiAxOTcwIDAwOjAwOjAwIFVUQ1wiO1xuICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cbiAgICAgIH1cblxuICAgICAgLypcbiAgICAgICAqXG4gICAgICAgKiBQdWJsaWMgbG9nZ2VyIEFQSSAtIHNlZSBodHRwczovL2dpdGh1Yi5jb20vcGltdGVycnkvbG9nbGV2ZWwgZm9yIGRldGFpbHNcbiAgICAgICAqXG4gICAgICAgKi9cblxuICAgICAgc2VsZi5uYW1lID0gbmFtZTtcblxuICAgICAgc2VsZi5sZXZlbHMgPSB7IFwiVFJBQ0VcIjogMCwgXCJERUJVR1wiOiAxLCBcIklORk9cIjogMiwgXCJXQVJOXCI6IDMsXG4gICAgICAgICAgXCJFUlJPUlwiOiA0LCBcIlNJTEVOVFwiOiA1fTtcblxuICAgICAgc2VsZi5tZXRob2RGYWN0b3J5ID0gZmFjdG9yeSB8fCBkZWZhdWx0TWV0aG9kRmFjdG9yeTtcblxuICAgICAgc2VsZi5nZXRMZXZlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gY3VycmVudExldmVsO1xuICAgICAgfTtcblxuICAgICAgc2VsZi5zZXRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCwgcGVyc2lzdCkge1xuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWwgPT09IFwic3RyaW5nXCIgJiYgc2VsZi5sZXZlbHNbbGV2ZWwudG9VcHBlckNhc2UoKV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBsZXZlbCA9IHNlbGYubGV2ZWxzW2xldmVsLnRvVXBwZXJDYXNlKCldO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsID09PSBcIm51bWJlclwiICYmIGxldmVsID49IDAgJiYgbGV2ZWwgPD0gc2VsZi5sZXZlbHMuU0lMRU5UKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRMZXZlbCA9IGxldmVsO1xuICAgICAgICAgICAgICBpZiAocGVyc2lzdCAhPT0gZmFsc2UpIHsgIC8vIGRlZmF1bHRzIHRvIHRydWVcbiAgICAgICAgICAgICAgICAgIHBlcnNpc3RMZXZlbElmUG9zc2libGUobGV2ZWwpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlcGxhY2VMb2dnaW5nTWV0aG9kcy5jYWxsKHNlbGYsIGxldmVsLCBuYW1lKTtcbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlID09PSB1bmRlZmluZWRUeXBlICYmIGxldmVsIDwgc2VsZi5sZXZlbHMuU0lMRU5UKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCJObyBjb25zb2xlIGF2YWlsYWJsZSBmb3IgbG9nZ2luZ1wiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgXCJsb2cuc2V0TGV2ZWwoKSBjYWxsZWQgd2l0aCBpbnZhbGlkIGxldmVsOiBcIiArIGxldmVsO1xuICAgICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHNlbGYuc2V0RGVmYXVsdExldmVsID0gZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgICAgICAgZGVmYXVsdExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgaWYgKCFnZXRQZXJzaXN0ZWRMZXZlbCgpKSB7XG4gICAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwobGV2ZWwsIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICBzZWxmLnJlc2V0TGV2ZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgc2VsZi5zZXRMZXZlbChkZWZhdWx0TGV2ZWwsIGZhbHNlKTtcbiAgICAgICAgICBjbGVhclBlcnNpc3RlZExldmVsKCk7XG4gICAgICB9O1xuXG4gICAgICBzZWxmLmVuYWJsZUFsbCA9IGZ1bmN0aW9uKHBlcnNpc3QpIHtcbiAgICAgICAgICBzZWxmLnNldExldmVsKHNlbGYubGV2ZWxzLlRSQUNFLCBwZXJzaXN0KTtcbiAgICAgIH07XG5cbiAgICAgIHNlbGYuZGlzYWJsZUFsbCA9IGZ1bmN0aW9uKHBlcnNpc3QpIHtcbiAgICAgICAgICBzZWxmLnNldExldmVsKHNlbGYubGV2ZWxzLlNJTEVOVCwgcGVyc2lzdCk7XG4gICAgICB9O1xuXG4gICAgICAvLyBJbml0aWFsaXplIHdpdGggdGhlIHJpZ2h0IGxldmVsXG4gICAgICB2YXIgaW5pdGlhbExldmVsID0gZ2V0UGVyc2lzdGVkTGV2ZWwoKTtcbiAgICAgIGlmIChpbml0aWFsTGV2ZWwgPT0gbnVsbCkge1xuICAgICAgICAgIGluaXRpYWxMZXZlbCA9IGRlZmF1bHRMZXZlbDtcbiAgICAgIH1cbiAgICAgIHNlbGYuc2V0TGV2ZWwoaW5pdGlhbExldmVsLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKlxuICAgICAqIFRvcC1sZXZlbCBBUElcbiAgICAgKlxuICAgICAqL1xuXG4gICAgdmFyIGRlZmF1bHRMb2dnZXIgPSBuZXcgTG9nZ2VyKCk7XG5cbiAgICB2YXIgX2xvZ2dlcnNCeU5hbWUgPSB7fTtcbiAgICBkZWZhdWx0TG9nZ2VyLmdldExvZ2dlciA9IGZ1bmN0aW9uIGdldExvZ2dlcihuYW1lKSB7XG4gICAgICAgIGlmICgodHlwZW9mIG5hbWUgIT09IFwic3ltYm9sXCIgJiYgdHlwZW9mIG5hbWUgIT09IFwic3RyaW5nXCIpIHx8IG5hbWUgPT09IFwiXCIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiWW91IG11c3Qgc3VwcGx5IGEgbmFtZSB3aGVuIGNyZWF0aW5nIGEgbG9nZ2VyLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsb2dnZXIgPSBfbG9nZ2Vyc0J5TmFtZVtuYW1lXTtcbiAgICAgICAgaWYgKCFsb2dnZXIpIHtcbiAgICAgICAgICBsb2dnZXIgPSBfbG9nZ2Vyc0J5TmFtZVtuYW1lXSA9IG5ldyBMb2dnZXIoXG4gICAgICAgICAgICBuYW1lLCBkZWZhdWx0TG9nZ2VyLmdldExldmVsKCksIGRlZmF1bHRMb2dnZXIubWV0aG9kRmFjdG9yeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGxvZ2dlcjtcbiAgICB9O1xuXG4gICAgLy8gR3JhYiB0aGUgY3VycmVudCBnbG9iYWwgbG9nIHZhcmlhYmxlIGluIGNhc2Ugb2Ygb3ZlcndyaXRlXG4gICAgdmFyIF9sb2cgPSAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSkgPyB3aW5kb3cubG9nIDogdW5kZWZpbmVkO1xuICAgIGRlZmF1bHRMb2dnZXIubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSAmJlxuICAgICAgICAgICAgICAgd2luZG93LmxvZyA9PT0gZGVmYXVsdExvZ2dlcikge1xuICAgICAgICAgICAgd2luZG93LmxvZyA9IF9sb2c7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVmYXVsdExvZ2dlcjtcbiAgICB9O1xuXG4gICAgZGVmYXVsdExvZ2dlci5nZXRMb2dnZXJzID0gZnVuY3Rpb24gZ2V0TG9nZ2VycygpIHtcbiAgICAgICAgcmV0dXJuIF9sb2dnZXJzQnlOYW1lO1xuICAgIH07XG5cbiAgICAvLyBFUzYgZGVmYXVsdCBleHBvcnQsIGZvciBjb21wYXRpYmlsaXR5XG4gICAgZGVmYXVsdExvZ2dlclsnZGVmYXVsdCddID0gZGVmYXVsdExvZ2dlcjtcblxuICAgIHJldHVybiBkZWZhdWx0TG9nZ2VyO1xufSkpO1xuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuY29uc3QgbG9nID0gcmVxdWlyZShcImxvZ2xldmVsXCIpO1xyXG5jb25zdCBCVCA9IHJlcXVpcmUoXCIuL3dlYmJsdWV0b290aFwiKTtcclxuY29uc3QgdXRpbHMgPSByZXF1aXJlKFwiLi91dGlsc1wiKTtcclxuY29uc3QgU3RhdGUgPSBCVC5TdGF0ZTtcclxuY29uc3QgYnRTdGF0ZSA9IEJULmJ0U3RhdGU7XHJcblxyXG5hc3luYyBmdW5jdGlvbiBTdGFydCgpIHtcclxuICAgIGxvZy5pbmZvKFwiU3RhcnQgY2FsbGVkLi4uXCIpO1xyXG5cclxuICAgIGlmICghYnRTdGF0ZS5zdGFydGVkKSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLk5PVF9DT05ORUNURUQ7XHJcbiAgICAgICAgQlQuc3RhdGVNYWNoaW5lKCk7IC8vIFN0YXJ0IGl0XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChidFN0YXRlLnN0YXRlID09IFN0YXRlLkVSUk9SKSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLk5PVF9DT05ORUNURUQ7IC8vIFRyeSB0byByZXN0YXJ0XHJcbiAgICB9XHJcbiAgICBhd2FpdCB1dGlscy53YWl0Rm9yKCgpID0+IGJ0U3RhdGUuc3RhdGUgPT0gU3RhdGUuSURMRSB8fCBidFN0YXRlLnN0YXRlID09IFN0YXRlLlNUT1BQRUQpO1xyXG4gICAgbG9nLmluZm8oXCJQYWlyaW5nIGNvbXBsZXRlZCwgc3RhdGUgOlwiLCBidFN0YXRlLnN0YXRlKTtcclxuICAgIHJldHVybiAoYnRTdGF0ZS5zdGF0ZSAhPSBTdGF0ZS5TVE9QUEVEKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gU3RvcCgpIHtcclxuICAgIGxvZy5pbmZvKFwiU3RvcCByZXF1ZXN0IHJlY2VpdmVkXCIpO1xyXG5cclxuICAgIGJ0U3RhdGUuc3RvcFJlcXVlc3QgPSB0cnVlO1xyXG4gICAgYXdhaXQgdXRpbHMuc2xlZXAoMTAwKTtcclxuXHJcbiAgICB3aGlsZShidFN0YXRlLnN0YXJ0ZWQgfHwgKGJ0U3RhdGUuc3RhdGUgIT0gU3RhdGUuU1RPUFBFRCAmJiBidFN0YXRlLnN0YXRlICE9IFN0YXRlLk5PVF9DT05ORUNURUQpKVxyXG4gICAge1xyXG4gICAgICAgIGJ0U3RhdGUuc3RvcFJlcXVlc3QgPSB0cnVlOyAgICBcclxuICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCgxMDApO1xyXG4gICAgfVxyXG4gICAgYnRTdGF0ZS5jb21tYW5kID0gbnVsbDtcclxuICAgIGJ0U3RhdGUuc3RvcFJlcXVlc3QgPSBmYWxzZTtcclxuICAgIGxvZy53YXJuKFwiU3RvcHBlZCBvbiByZXF1ZXN0LlwiKTtcclxuICAgIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5mdW5jdGlvbiBTZXRMb2dMZXZlbChsZXZlbCkge1xyXG4gICAgbG9nLnNldExldmVsKGxldmVsLCBmYWxzZSk7XHJcbn1cclxuXHJcbmV4cG9ydHMuU3RhcnQgPSBTdGFydDtcclxuZXhwb3J0cy5TdG9wID0gU3RvcDtcclxuZXhwb3J0cy5TZXRMb2dMZXZlbCA9IFNldExvZ0xldmVsO1xyXG5leHBvcnRzLmJ0U3RhdGUgPSBCVC5idFN0YXRlO1xyXG5leHBvcnRzLlN0YXRlID0gQlQuU3RhdGU7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmxldCBzbGVlcCA9IG1zID0+IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCBtcykpO1xyXG5sZXQgd2FpdEZvciA9IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3IoZikge1xyXG4gICAgd2hpbGUgKCFmKCkpIGF3YWl0IHNsZWVwKDEwMCArIE1hdGgucmFuZG9tKCkgKiAyNSk7XHJcbiAgICByZXR1cm4gZigpO1xyXG59O1xyXG5cclxubGV0IHdhaXRGb3JUaW1lb3V0ID0gYXN5bmMgZnVuY3Rpb24gd2FpdEZvcihmLCB0aW1lb3V0U2VjKSB7XHJcbiAgICB2YXIgdG90YWxUaW1lTXMgPSAwO1xyXG4gICAgd2hpbGUgKCFmKCkgJiYgdG90YWxUaW1lTXMgPCB0aW1lb3V0U2VjICogMTAwMCkge1xyXG4gICAgICAgIHZhciBkZWxheU1zID0gMTAwICsgTWF0aC5yYW5kb20oKSAqIDI1O1xyXG4gICAgICAgIHRvdGFsVGltZU1zICs9IGRlbGF5TXM7XHJcbiAgICAgICAgYXdhaXQgc2xlZXAoZGVsYXlNcyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZigpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBjb252ZXJ0IGEgdmFsdWUgaW50byBhbiBlbnVtIHZhbHVlXHJcbiAqIFxyXG4gKiBAcGFyYW0ge3R5cGV9IGVudW10eXBlXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBlbnVtdmFsdWVcclxuICovXHJcbiBmdW5jdGlvbiBQYXJzZShlbnVtdHlwZSwgZW51bXZhbHVlKSB7XHJcbiAgICBmb3IgKHZhciBlbnVtTmFtZSBpbiBlbnVtdHlwZSkge1xyXG4gICAgICAgIGlmIChlbnVtdHlwZVtlbnVtTmFtZV0gPT0gZW51bXZhbHVlKSB7XHJcbiAgICAgICAgICAgIC8qanNoaW50IC1XMDYxICovXHJcbiAgICAgICAgICAgIHJldHVybiBldmFsKFtlbnVtdHlwZSArIFwiLlwiICsgZW51bU5hbWVdKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbnVsbDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBkdW1wIGFycmF5YnVmZmVyIGFzIGhleCBzdHJpbmdcclxuICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gYnVmZmVyXHJcbiAqL1xyXG4gZnVuY3Rpb24gYnVmMmhleChidWZmZXIpIHsgLy8gYnVmZmVyIGlzIGFuIEFycmF5QnVmZmVyXHJcbiAgICByZXR1cm4gWy4uLm5ldyBVaW50OEFycmF5KGJ1ZmZlcildXHJcbiAgICAgICAgLm1hcCh4ID0+IHgudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsICcwJykpXHJcbiAgICAgICAgLmpvaW4oJyAnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaGV4MmJ1ZiAoaW5wdXQpIHtcclxuICAgIGlmICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgaW5wdXQgdG8gYmUgYSBzdHJpbmcnKVxyXG4gICAgfVxyXG4gICAgdmFyIGhleHN0ciA9IGlucHV0LnJlcGxhY2UoL1xccysvZywgJycpO1xyXG4gICAgaWYgKChoZXhzdHIubGVuZ3RoICUgMikgIT09IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignRXhwZWN0ZWQgc3RyaW5nIHRvIGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGNoYXJhY3RlcnMnKVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHZpZXcgPSBuZXcgVWludDhBcnJheShoZXhzdHIubGVuZ3RoIC8gMilcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGhleHN0ci5sZW5ndGg7IGkgKz0gMikge1xyXG4gICAgICAgIHZpZXdbaSAvIDJdID0gcGFyc2VJbnQoaGV4c3RyLnN1YnN0cmluZyhpLCBpICsgMiksIDE2KVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB2aWV3LmJ1ZmZlclxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHsgc2xlZXAsIHdhaXRGb3IsIHdhaXRGb3JUaW1lb3V0LCBQYXJzZSwgYnVmMmhleCwgaGV4MmJ1ZiB9OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbi8qKlxyXG4gKiAgQmx1ZXRvb3RoIGhhbmRsaW5nIG1vZHVsZSwgaW5jbHVkaW5nIG1haW4gc3RhdGUgbWFjaGluZSBsb29wLlxyXG4gKiAgVGhpcyBtb2R1bGUgaW50ZXJhY3RzIHdpdGggYnJvd3NlciBmb3IgYmx1ZXRvb3RoIGNvbXVuaWNhdGlvbnMgYW5kIHBhaXJpbmcsIGFuZCB3aXRoIFNlbmVjYU1TQyBvYmplY3QuXHJcbiAqL1xyXG5cclxuY29uc3QgbG9nID0gcmVxdWlyZSgnbG9nbGV2ZWwnKTtcclxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XHJcblxyXG52YXIgc2ltdWxhdGlvbiA9IGZhbHNlO1xyXG5cclxuLypcclxuICogQmx1ZXRvb3RoIGNvbnN0YW50c1xyXG4gKi9cclxuY29uc3QgQmx1ZVRvb3RoT1dPTiA9IHtcclxuICAgIFNlcnZpY2VVdWlkOiAnMDAwMGZmZjAtMDAwMC0xMDAwLTgwMDAtMDA4MDVmOWIzNGZiJywgLy8gYmx1ZXRvb3RoIHNlcnZpY2UgZm9yIE93b24gQjQxVCtcclxuICAgIE5vdGlmaWNhdGlvbnNVdWlkOiAnMDAwMGZmZjQtMDAwMC0xMDAwLTgwMDAtMDA4MDVmOWIzNGZiJyxcclxufTtcclxuXHJcbi8qXHJcbiAqIEludGVybmFsIHN0YXRlIG1hY2hpbmUgZGVzY3JpcHRpb25zXHJcbiAqL1xyXG5jb25zdCBTdGF0ZSA9IHtcclxuICAgIE5PVF9DT05ORUNURUQ6ICdOb3QgY29ubmVjdGVkJyxcclxuICAgIENPTk5FQ1RJTkc6ICdCbHVldG9vdGggZGV2aWNlIHBhaXJpbmcuLi4nLFxyXG4gICAgREVWSUNFX1BBSVJFRDogJ0RldmljZSBwYWlyZWQnLFxyXG4gICAgU1VCU0NSSUJJTkc6ICdCbHVldG9vdGggaW50ZXJmYWNlcyBjb25uZWN0aW5nLi4uJyxcclxuICAgIElETEU6ICdJZGxlJyxcclxuICAgIEJVU1k6ICdCdXN5JyxcclxuICAgIEVSUk9SOiAnRXJyb3InLFxyXG4gICAgU1RPUFBJTkc6ICdDbG9zaW5nIEJUIGludGVyZmFjZXMuLi4nLFxyXG4gICAgU1RPUFBFRDogJ1N0b3BwZWQnLFxyXG4gICAgTUVURVJfSU5JVDogJ01ldGVyIGNvbm5lY3RlZCcsXHJcbiAgICBNRVRFUl9JTklUSUFMSVpJTkc6ICdSZWFkaW5nIG1ldGVyIHN0YXRlLi4uJ1xyXG59O1xyXG5cclxuY2xhc3MgQVBJU3RhdGUge1xyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLk5PVF9DT05ORUNURUQ7XHJcbiAgICAgICAgdGhpcy5wcmV2X3N0YXRlID0gU3RhdGUuTk9UX0NPTk5FQ1RFRDtcclxuICAgICAgICB0aGlzLnN0YXRlX2NwdCA9IDA7XHJcblxyXG4gICAgICAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlOyAvLyBTdGF0ZSBtYWNoaW5lIHN0YXR1c1xyXG4gICAgICAgIHRoaXMuc3RvcFJlcXVlc3QgPSBmYWxzZTsgLy8gVG8gcmVxdWVzdCBkaXNjb25uZWN0XHJcbiAgICAgICAgXHJcblxyXG4gICAgICAgIC8vIGxhc3Qgbm90aWZpY2F0aW9uXHJcbiAgICAgICAgdGhpcy5yZXNwb25zZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5yZXNwb25zZVRpbWVTdGFtcCA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgdGhpcy5wYXJzZWRSZXNwb25zZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5mb3JtYXR0ZWRSZXNwb25zZSA9ICcnO1xyXG5cclxuICAgICAgICAvLyBibHVldG9vdGggcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2hhclJlYWQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuYnRTZXJ2aWNlID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJ0RGV2aWNlID0gbnVsbDtcclxuXHJcbiAgICAgICAgLy8gZ2VuZXJhbCBzdGF0aXN0aWNzIGZvciBkZWJ1Z2dpbmdcclxuICAgICAgICB0aGlzLnN0YXRzID0ge1xyXG4gICAgICAgICAgICBcInJlcXVlc3RzXCI6IDAsXHJcbiAgICAgICAgICAgIFwicmVzcG9uc2VzXCI6IDAsXHJcbiAgICAgICAgICAgIFwibW9kYnVzX2Vycm9yc1wiOiAwLFxyXG4gICAgICAgICAgICBcIkdBVFQgZGlzY29ubmVjdHNcIjogMCxcclxuICAgICAgICAgICAgXCJleGNlcHRpb25zXCI6IDAsXHJcbiAgICAgICAgICAgIFwic3ViY3JpYmVzXCI6IDAsXHJcbiAgICAgICAgICAgIFwiY29tbWFuZHNcIjogMCxcclxuICAgICAgICAgICAgXCJyZXNwb25zZVRpbWVcIjogMC4wLFxyXG4gICAgICAgICAgICBcImxhc3RSZXNwb25zZVRpbWVcIjogMC4wLFxyXG4gICAgICAgICAgICBcImxhc3RfY29ubmVjdFwiOiBuZXcgRGF0ZSgyMDIwLCAxLCAxKS50b0lTT1N0cmluZygpXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0ge1xyXG4gICAgICAgICAgICBcImZvcmNlRGV2aWNlU2VsZWN0aW9uXCIgOiB0cnVlXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5sZXQgYnRTdGF0ZSA9IG5ldyBBUElTdGF0ZSgpO1xyXG5cclxuLyoqXHJcbiAqIE1haW4gbG9vcCBvZiB0aGUgbWV0ZXIgaGFuZGxlci5cclxuICogKi9cclxuYXN5bmMgZnVuY3Rpb24gc3RhdGVNYWNoaW5lKCkge1xyXG4gICAgdmFyIG5leHRBY3Rpb247XHJcbiAgICB2YXIgREVMQVlfTVMgPSAoc2ltdWxhdGlvbiA/IDIwIDogNjAwKTsgLy8gVXBkYXRlIHRoZSBzdGF0dXMgZXZlcnkgWCBtcy5cclxuICAgIHZhciBUSU1FT1VUX01TID0gKHNpbXVsYXRpb24gPyAxMDAwIDogMzAwMDApOyAvLyBHaXZlIHVwIHNvbWUgb3BlcmF0aW9ucyBhZnRlciBYIG1zLlxyXG4gICAgYnRTdGF0ZS5zdGFydGVkID0gdHJ1ZTtcclxuXHJcbiAgICBsb2cuZGVidWcoXCJDdXJyZW50IHN0YXRlOlwiICsgYnRTdGF0ZS5zdGF0ZSk7XHJcblxyXG4gICAgLy8gQ29uc2VjdXRpdmUgc3RhdGUgY291bnRlZC4gQ2FuIGJlIHVzZWQgdG8gdGltZW91dC5cclxuICAgIGlmIChidFN0YXRlLnN0YXRlID09IGJ0U3RhdGUucHJldl9zdGF0ZSkge1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGVfY3B0Kys7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGVfY3B0ID0gMDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTdG9wIHJlcXVlc3QgZnJvbSBBUElcclxuICAgIGlmIChidFN0YXRlLnN0b3BSZXF1ZXN0KSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLlNUT1BQSU5HO1xyXG4gICAgfVxyXG5cclxuICAgIGxvZy5kZWJ1ZyhcIlxcU3RhdGU6XCIgKyBidFN0YXRlLnN0YXRlKTtcclxuICAgIHN3aXRjaCAoYnRTdGF0ZS5zdGF0ZSkge1xyXG4gICAgICAgIGNhc2UgU3RhdGUuTk9UX0NPTk5FQ1RFRDogLy8gaW5pdGlhbCBzdGF0ZSBvbiBTdGFydCgpXHJcbiAgICAgICAgICAgIGlmIChzaW11bGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gZmFrZVBhaXJEZXZpY2U7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gYnRQYWlyRGV2aWNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuQ09OTkVDVElORzogLy8gd2FpdGluZyBmb3IgY29ubmVjdGlvbiB0byBjb21wbGV0ZVxyXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFN0YXRlLkRFVklDRV9QQUlSRUQ6IC8vIGNvbm5lY3Rpb24gY29tcGxldGUsIGFjcXVpcmUgbWV0ZXIgc3RhdGVcclxuICAgICAgICAgICAgaWYgKHNpbXVsYXRpb24pIHtcclxuICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlU3Vic2NyaWJlO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGJ0U3Vic2NyaWJlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuU1VCU0NSSUJJTkc6IC8vIHdhaXRpbmcgZm9yIEJsdWV0b290aCBpbnRlcmZhY2VzXHJcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGlmIChidFN0YXRlLnN0YXRlX2NwdCA+IChUSU1FT1VUX01TIC8gREVMQVlfTVMpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUaW1lb3V0LCB0cnkgdG8gcmVzdWJzY3JpYmVcclxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiVGltZW91dCBpbiBTVUJTQ1JJQklOR1wiKTtcclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEO1xyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQgPSAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuTUVURVJfSU5JVDogLy8gcmVhZHkgdG8gY29tbXVuaWNhdGUsIGFjcXVpcmUgbWV0ZXIgc3RhdHVzXHJcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSBtZXRlckluaXQ7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuTUVURVJfSU5JVElBTElaSU5HOiAvLyByZWFkaW5nIHRoZSBtZXRlciBzdGF0dXNcclxuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuc3RhdGVfY3B0ID4gKFRJTUVPVVRfTVMgLyBERUxBWV9NUykpIHtcclxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiVGltZW91dCBpbiBNRVRFUl9JTklUSUFMSVpJTkdcIik7XHJcbiAgICAgICAgICAgICAgICAvLyBUaW1lb3V0LCB0cnkgdG8gcmVzdWJzY3JpYmVcclxuICAgICAgICAgICAgICAgIGlmIChzaW11bGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGZha2VTdWJzY3JpYmU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBidFN1YnNjcmliZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuc3RhdGVfY3B0ID0gMDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFN0YXRlLklETEU6IC8vIHJlYWR5IHRvIHByb2Nlc3MgY29tbWFuZHMgZnJvbSBBUElcclxuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuY29tbWFuZCAhPSBudWxsKVxyXG4gICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IHByb2Nlc3NDb21tYW5kO1xyXG4gICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSByZWZyZXNoO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuRVJST1I6IC8vIGFueXRpbWUgYW4gZXJyb3IgaGFwcGVuc1xyXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gZGlzY29ubmVjdDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5CVVNZOiAvLyB3aGlsZSBhIGNvbW1hbmQgaW4gZ29pbmcgb25cclxuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuc3RhdGVfY3B0ID4gKFRJTUVPVVRfTVMgLyBERUxBWV9NUykpIHtcclxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiVGltZW91dCBpbiBCVVNZXCIpO1xyXG4gICAgICAgICAgICAgICAgLy8gVGltZW91dCwgdHJ5IHRvIHJlc3Vic2NyaWJlXHJcbiAgICAgICAgICAgICAgICBpZiAoc2ltdWxhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlU3Vic2NyaWJlO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gYnRTdWJzY3JpYmU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBidFN0YXRlLnN0YXRlX2NwdCA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5TVE9QUElORzpcclxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGRpc2Nvbm5lY3Q7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuU1RPUFBFRDogLy8gYWZ0ZXIgYSBkaXNjb25uZWN0b3Igb3IgU3RvcCgpIHJlcXVlc3QsIHN0b3BzIHRoZSBzdGF0ZSBtYWNoaW5lLlxyXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuXHJcbiAgICBidFN0YXRlLnByZXZfc3RhdGUgPSBidFN0YXRlLnN0YXRlO1xyXG5cclxuICAgIGlmIChuZXh0QWN0aW9uICE9IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGxvZy5kZWJ1ZyhcIlxcdEV4ZWN1dGluZzpcIiArIG5leHRBY3Rpb24ubmFtZSk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgbmV4dEFjdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJFeGNlcHRpb24gaW4gc3RhdGUgbWFjaGluZVwiLCBlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAoYnRTdGF0ZS5zdGF0ZSAhPSBTdGF0ZS5TVE9QUEVEKSB7XHJcbiAgICAgICAgdXRpbHMuc2xlZXAoREVMQVlfTVMpLnRoZW4oKCkgPT4gc3RhdGVNYWNoaW5lKCkpOyAvLyBSZWNoZWNrIHN0YXR1cyBpbiBERUxBWV9NUyBtc1xyXG4gICAgfVxyXG4gICAgZWxzZSB7XHJcbiAgICAgICAgbG9nLmRlYnVnKFwiXFx0VGVybWluYXRpbmcgU3RhdGUgbWFjaGluZVwiKTtcclxuICAgICAgICBidFN0YXRlLnN0YXJ0ZWQgPSBmYWxzZTtcclxuICAgIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENhbGxlZCBmcm9tIHN0YXRlIG1hY2hpbmUgdG8gZXhlY3V0ZSBhIHNpbmdsZSBjb21tYW5kIGZyb20gYnRTdGF0ZS5jb21tYW5kIHByb3BlcnR5XHJcbiAqICovXHJcbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NDb21tYW5kKCkge1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb21tYW5kLmVycm9yID0gZmFsc2U7XHJcbiAgICAgICAgY29tbWFuZC5wZW5kaW5nID0gZmFsc2U7XHJcbiAgICAgICAgYnRTdGF0ZS5jb21tYW5kID0gbnVsbDtcclxuXHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLklETEU7XHJcbiAgICAgICAgbG9nLmRlYnVnKFwiXFx0XFx0Q29tcGxldGVkIGNvbW1hbmQgZXhlY3V0ZWRcIik7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgbG9nLmVycm9yKFwiKiogZXJyb3Igd2hpbGUgZXhlY3V0aW5nIGNvbW1hbmQ6IFwiICsgZXJyKTtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuTUVURVJfSU5JVDtcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wiZXhjZXB0aW9uc1wiXSsrO1xyXG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBtb2RidXMuTW9kYnVzRXJyb3IpXHJcbiAgICAgICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJtb2RidXNfZXJyb3JzXCJdKys7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEFjcXVpcmUgdGhlIGN1cnJlbnQgbW9kZSBhbmQgc2VyaWFsIG51bWJlciBvZiB0aGUgZGV2aWNlLlxyXG4gKiAqL1xyXG5hc3luYyBmdW5jdGlvbiBtZXRlckluaXQoKSB7XHJcbiAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuSURMRTtcclxufVxyXG5cclxuLypcclxuICogQ2xvc2UgdGhlIGJsdWV0b290aCBpbnRlcmZhY2UgKHVucGFpcilcclxuICogKi9cclxuYXN5bmMgZnVuY3Rpb24gZGlzY29ubmVjdCgpIHtcclxuICAgIGJ0U3RhdGUuY29tbWFuZCA9IG51bGw7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGlmIChidFN0YXRlLmJ0RGV2aWNlICE9IG51bGwpIHtcclxuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuYnREZXZpY2U/LmdhdHQ/LmNvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCIqIENhbGxpbmcgZGlzY29ubmVjdCBvbiBidGRldmljZVwiKTtcclxuICAgICAgICAgICAgICAgIC8vIEF2b2lkIHRoZSBldmVudCBmaXJpbmcgd2hpY2ggbWF5IGxlYWQgdG8gYXV0by1yZWNvbm5lY3RcclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuYnREZXZpY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignZ2F0dHNlcnZlcmRpc2Nvbm5lY3RlZCcsIG9uRGlzY29ubmVjdGVkKTtcclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuYnREZXZpY2UuZ2F0dC5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggeyB9XHJcbiAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuU1RPUFBFRDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEV2ZW50IGNhbGxlZCBieSBicm93c2VyIEJUIGFwaSB3aGVuIHRoZSBkZXZpY2UgZGlzY29ubmVjdFxyXG4gKiAqL1xyXG5hc3luYyBmdW5jdGlvbiBvbkRpc2Nvbm5lY3RlZCgpIHtcclxuICAgIGxvZy53YXJuKFwiKiBHQVRUIFNlcnZlciBkaXNjb25uZWN0ZWQgZXZlbnQsIHdpbGwgdHJ5IHRvIHJlY29ubmVjdCAqXCIpO1xyXG4gICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xyXG4gICAgYnRTdGF0ZS5zdGF0c1tcIkdBVFQgZGlzY29ubmVjdHNcIl0rKztcclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEOyAvLyBUcnkgdG8gYXV0by1yZWNvbm5lY3QgdGhlIGludGVyZmFjZXMgd2l0aG91dCBwYWlyaW5nXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBKb2lucyB0aGUgYXJndW1lbnRzIGludG8gYSBzaW5nbGUgYnVmZmVyXHJcbiAqIEByZXR1cm5zIHtCdWZmZXJ9IGNvbmNhdGVuYXRlZCBidWZmZXJcclxuICovXHJcbmZ1bmN0aW9uIGFycmF5QnVmZmVyQ29uY2F0KCkge1xyXG4gICAgdmFyIGxlbmd0aCA9IDA7XHJcbiAgICB2YXIgYnVmZmVyID0gbnVsbDtcclxuXHJcbiAgICBmb3IgKHZhciBpIGluIGFyZ3VtZW50cykge1xyXG4gICAgICAgIGJ1ZmZlciA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICBsZW5ndGggKz0gYnVmZmVyLmJ5dGVMZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGpvaW5lZCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XHJcbiAgICB2YXIgb2Zmc2V0ID0gMDtcclxuXHJcbiAgICBmb3IgKGkgaW4gYXJndW1lbnRzKSB7XHJcbiAgICAgICAgYnVmZmVyID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgIGpvaW5lZC5zZXQobmV3IFVpbnQ4QXJyYXkoYnVmZmVyKSwgb2Zmc2V0KTtcclxuICAgICAgICBvZmZzZXQgKz0gYnVmZmVyLmJ5dGVMZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGpvaW5lZC5idWZmZXI7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFdmVudCBjYWxsZWQgYnkgYmx1ZXRvb3RoIGNoYXJhY3RlcmlzdGljcyB3aGVuIHJlY2VpdmluZyBkYXRhXHJcbiAqIEBwYXJhbSB7YW55fSBldmVudFxyXG4gKi9cclxuZnVuY3Rpb24gaGFuZGxlTm90aWZpY2F0aW9ucyhldmVudCkge1xyXG4gICAgbGV0IHZhbHVlID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xyXG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHtcclxuICAgICAgICBsb2cuZGVidWcoJzw8ICcgKyB1dGlscy5idWYyaGV4KHZhbHVlLmJ1ZmZlcikpO1xyXG4gICAgICAgIGlmIChidFN0YXRlLnJlc3BvbnNlICE9IG51bGwpIHtcclxuICAgICAgICAgICAgYnRTdGF0ZS5yZXNwb25zZSA9IGFycmF5QnVmZmVyQ29uY2F0KGJ0U3RhdGUucmVzcG9uc2UsIHZhbHVlLmJ1ZmZlcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYnRTdGF0ZS5yZXNwb25zZSA9IHZhbHVlLmJ1ZmZlci5zbGljZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBidFN0YXRlLnJlc3BvbnNlVGltZVN0YW1wID0gbmV3IERhdGUoKTtcclxuICAgIH1cclxufVxyXG5cclxuLyogT1dPTiAqL1xyXG5cclxuY29uc3QgRENWID0gMHgwO1xyXG5jb25zdCBBQ1YgPSAweDE7XHJcbmNvbnN0IERDQSA9IDB4MjtcclxuY29uc3QgQUNBID0gMHgzO1xyXG5jb25zdCBPaG0gPSAweDQ7XHJcbmNvbnN0IENhcCA9IDB4NTtcclxuY29uc3QgSHogPSAweDY7XHJcbmNvbnN0IER1dHkgPSAweDc7XHJcbmNvbnN0IFRlbXBDID0gMHg4O1xyXG5jb25zdCBUZW1wRiA9IDB4OTtcclxuY29uc3QgRGlvZGUgPSAweEE7XHJcbmNvbnN0IENvbnRpbnVpdHkgPSAweEI7XHJcbmNvbnN0IGhGRSA9IDB4QztcclxuXHJcbmZ1bmN0aW9uIGZvcm1hdFBhcnNlZFJlc3BvbnNlKGZ1biwgbWVhc3VyZW1lbnQsIHNjYWxlLCBvdmVybG9hZCkge1xyXG4gICAgdmFyIG1lYXN1cmUgPSBcIj9cIjtcclxuICAgIHZhciB1bml0cyA9IFwiXCI7XHJcblxyXG4gICAgc3dpdGNoIChmdW4pIHtcclxuICAgICAgICBjYXNlIERDVjpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiVmRjPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiVlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIEFDVjpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiVmFjPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiVlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIERDQTpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiSWRjPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiQVwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIEFDQTpcclxuICAgICAgICAgICAgdW5pdHMgPSBcIklhYz1cIjtcclxuICAgICAgICAgICAgdW5pdHMgPSBcIkFcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBPaG06XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIlI9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJPaG1zXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ2FwOlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJDPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiRlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIEh6OlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJGcmVxdWVuY3k9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJIelwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIER1dHk6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkR1dHk9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCIlXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgVGVtcEM6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIlRlbXBlcmF0dXJlPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiwrBDXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgVGVtcEY6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIlRlbXBlcmF0dXJlPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiRlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIERpb2RlOlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJEaW9kZT1cIjtcclxuICAgICAgICAgICAgdW5pdHMgPSBcIlZcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBDb250aW51aXR5OlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJDb250aW51aXR5PVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiT2htc1wiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIGhGRTpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiaEZFPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIj89XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCI/XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAoc2NhbGUpIHtcclxuICAgICAgICBjYXNlIDA6XHJcbiAgICAgICAgY2FzZSAxOlxyXG4gICAgICAgICAgICBzY2FsZSA9IFwiblwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDI6XHJcbiAgICAgICAgICAgIHNjYWxlID0gXCJtaWNyb1wiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDM6XHJcbiAgICAgICAgICAgIHNjYWxlID0gXCJtXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNDpcclxuICAgICAgICAgICAgc2NhbGUgPSBcIlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDU6XHJcbiAgICAgICAgICAgIHNjYWxlID0gXCJraWxvXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNjpcclxuICAgICAgICAgICAgc2NhbGUgPSBcIm1lZ2FcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgICBpZiAob3ZlcmxvYWQpIHtcclxuICAgICAgICByZXR1cm4gbWVhc3VyZSArIFwiICoqT1ZFUkxPQUQqKiBcIiArIHNjYWxlICsgdW5pdHM7XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICByZXR1cm4gbWVhc3VyZSArIG1lYXN1cmVtZW50ICsgXCIgXCIgKyBzY2FsZSArIHVuaXRzO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZVJlc3BvbnNlKGJ1ZmZlciwgdGltZXN0YW1wKSB7XHJcbiAgICBsZXQgdmFsdWUgPSBuZXcgRGF0YVZpZXcoYnVmZmVyKTtcclxuICAgIHZhciBtZWFzdXJlbWVudCA9IE5hTjtcclxuXHJcbiAgICAvLyBTZWUgUkVBRE1FLm1kIG9uIGh0dHBzOi8vZ2l0aHViLmNvbS9EZWFuQ29yZGluZy9vd29uYjM1XHJcbiAgICB2YXIgZnVuYyA9ICh2YWx1ZS5nZXRVaW50MTYoMCwgdHJ1ZSkgPj4gNikgJiAweDBmO1xyXG4gICAgdmFyIGRlY2ltYWwgPSB2YWx1ZS5nZXRVaW50OCgwKSAmIDB4MDc7XHJcbiAgICB2YXIgc2NhbGUgPSAodmFsdWUuZ2V0VWludDgoMCkgPj4gMykgJiAweDA3O1xyXG4gICAgdmFyIHVpbnQxNnZhbCA9IHZhbHVlLmdldFVpbnQ4KDQpICsgMjU2ICogdmFsdWUuZ2V0VWludDgoNSk7XHJcbiAgICBpZiAodWludDE2dmFsIDwgMHg3ZmZmKSB7XHJcbiAgICAgICAgbWVhc3VyZW1lbnQgPSB1aW50MTZ2YWwgLyBNYXRoLnBvdygxMC4wLCBkZWNpbWFsKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbWVhc3VyZW1lbnQgPSAtMS4wICogKHVpbnQxNnZhbCAmIDB4N2ZmZikgLyBNYXRoLnBvdygxMC4wLCBkZWNpbWFsKTtcclxuICAgIH1cclxuICAgIHZhciBvdmVybG9hZCA9IChkZWNpbWFsID09IDB4MDcpO1xyXG5cclxuICAgIHZhciBub3JtYWxpemF0aW9uID0gMS4wO1xyXG4gICAgc3dpdGNoIChzY2FsZSkge1xyXG4gICAgICAgIGNhc2UgMDpcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgIG5vcm1hbGl6YXRpb24gPSAwLjAwMDAwMDAwMTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMC4wMDAwMDE7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgbm9ybWFsaXphdGlvbiA9IDAuMDAxO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDQ6XHJcbiAgICAgICAgICAgIG5vcm1hbGl6YXRpb24gPSAxLjA7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNTpcclxuICAgICAgICAgICAgbm9ybWFsaXphdGlvbiA9IDEwMDAuMDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSA2OlxyXG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMTAwMDAwMC4wO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuICAgIHZhciBmdW5jdGlvbkRlc2MgPSAnJztcclxuICAgIHN3aXRjaCAoZnVuYykge1xyXG4gICAgICAgIGNhc2UgRENWOlxyXG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlZvbHRhZ2UgKERDKSAtIFZcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBBQ1Y6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiVm9sdGFnZSAoQUMpIC0gVlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIERDQTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJDdXJyZW50IChEQykgLSBBXCJcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBBQ0E6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiQ3VycmVudCAoQUMpIC0gQVwiXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgT2htOlxyXG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlJlc2lzdGFuY2UgLSBPaG1zXCJcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBDYXA6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiQ2FwYWNpdGFuY2UgLSBGXCJcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBIejpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJGcmVxdWVuY3kgLSBIelwiXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRHV0eTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJEdXR5IGN5Y2xlIC0gJVwiXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgVGVtcEM6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiVGVtcGVyYXR1cmUgLSDCsENcIlxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFRlbXBGOlxyXG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlRlbXBlcmF0dXJlIC0gwrBGXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRGlvZGU6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiRGlvZGUgLSBWXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ29udGludWl0eTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJDb250aW51aXR5IC0gT2htc1wiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIGhGRTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJoRkVcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCI/XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIGJ0U3RhdGUucGFyc2VkUmVzcG9uc2UgPSB7IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgXCJGdW5jdGlvblwiOiBmdW5jLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgIFwiRnVuY3Rpb24gZGVzY3JpcHRpb25cIjogZnVuY3Rpb25EZXNjLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgXCJNZWFzdXJlbWVudFwiOiBtZWFzdXJlbWVudCwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBcIlNjYWxlXCI6IHNjYWxlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgXCJPdmVybG9hZFwiOiBvdmVybG9hZCwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBcIlRpbWVzdGFtcFwiOiB0aW1lc3RhbXAsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgXCJWYWx1ZVwiIDogbWVhc3VyZW1lbnQqbm9ybWFsaXphdGlvbiB9O1xyXG4gICAgYnRTdGF0ZS5mb3JtYXR0ZWRSZXNwb25zZSA9IGZvcm1hdFBhcnNlZFJlc3BvbnNlKGZ1bmMsIG1lYXN1cmVtZW50LCBzY2FsZSwgb3ZlcmxvYWQpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBzdWNjZWVkIG9ubHkgaWYgY2FsbGVkIGFzIGEgY29uc2VxdWVuY2Ugb2YgYSB1c2VyLWdlc3R1cmVcclxuICogRS5nLiBidXR0b24gY2xpY2suIFRoaXMgaXMgZHVlIHRvIEJsdWVUb290aCBBUEkgc2VjdXJpdHkgbW9kZWwuXHJcbiAqICovXHJcbmFzeW5jIGZ1bmN0aW9uIGJ0UGFpckRldmljZSgpIHtcclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5DT05ORUNUSU5HO1xyXG4gICAgdmFyIGZvcmNlU2VsZWN0aW9uID0gdHJ1ZTtcclxuICAgIGxvZy5kZWJ1ZyhcImJ0UGFpckRldmljZShcIiArIGZvcmNlU2VsZWN0aW9uICsgXCIpXCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBpZiAodHlwZW9mIChuYXZpZ2F0b3IuYmx1ZXRvb3RoPy5nZXRBdmFpbGFiaWxpdHkpID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmlsaXR5ID0gYXdhaXQgbmF2aWdhdG9yLmJsdWV0b290aC5nZXRBdmFpbGFiaWxpdHkoKTtcclxuICAgICAgICAgICAgaWYgKCFhdmFpbGFiaWxpdHkpIHtcclxuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcIkJsdWV0b290aCBub3QgYXZhaWxhYmxlIGluIGJyb3dzZXIuXCIpO1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQnJvd3NlciBkb2VzIG5vdCBwcm92aWRlIGJsdWV0b290aFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgZGV2aWNlID0gbnVsbDtcclxuXHJcbiAgICAgICAgLy8gSWYgbm90LCByZXF1ZXN0IGZyb20gdXNlclxyXG4gICAgICAgIGlmIChkZXZpY2UgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBkZXZpY2UgPSBhd2FpdCBuYXZpZ2F0b3IuYmx1ZXRvb3RoXHJcbiAgICAgICAgICAgICAgICAucmVxdWVzdERldmljZSh7XHJcbiAgICAgICAgICAgICAgICAgICAgYWNjZXB0QWxsRGV2aWNlczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25hbFNlcnZpY2VzOiBbQmx1ZVRvb3RoT1dPTi5TZXJ2aWNlVXVpZF1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBidFN0YXRlLmJ0RGV2aWNlID0gZGV2aWNlO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEO1xyXG4gICAgICAgIGxvZy5pbmZvKFwiQmx1ZXRvb3RoIGRldmljZSBcIiArIGRldmljZS5uYW1lICsgXCIgY29ubmVjdGVkLlwiKTtcclxuICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCg1MDApO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgY29ubmVjdGluZzogXCIgKyBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xyXG4gICAgICAgIGlmIChidFN0YXRlLmNoYXJSZWFkICE9IG51bGwpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuY2hhclJlYWQuc3RvcE5vdGlmaWNhdGlvbnMoKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHsgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gbnVsbDtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuRVJST1I7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0c1tcImV4Y2VwdGlvbnNcIl0rKztcclxuICAgIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmFrZVBhaXJEZXZpY2UoKSB7XHJcbiAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuQ09OTkVDVElORztcclxuICAgIHZhciBmb3JjZVNlbGVjdGlvbiA9IHRydWU7XHJcbiAgICBsb2cuZGVidWcoXCJmYWtlUGFpckRldmljZShcIiArIGZvcmNlU2VsZWN0aW9uICsgXCIpXCIpO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB2YXIgZGV2aWNlID0geyBuYW1lOiBcIkZha2VCVERldmljZVwiLCBnYXR0OiB7IGNvbm5lY3RlZDogdHJ1ZSB9IH07XHJcbiAgICAgICAgYnRTdGF0ZS5idERldmljZSA9IGRldmljZTtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuREVWSUNFX1BBSVJFRDtcclxuICAgICAgICBsb2cuaW5mbyhcIkJsdWV0b290aCBkZXZpY2UgXCIgKyBkZXZpY2UubmFtZSArIFwiIGNvbm5lY3RlZC5cIik7XHJcbiAgICAgICAgYXdhaXQgdXRpbHMuc2xlZXAoNTApO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgY29ubmVjdGluZzogXCIgKyBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xyXG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQgPSBudWxsO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wiZXhjZXB0aW9uc1wiXSsrO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogT25jZSB0aGUgZGV2aWNlIGlzIGF2YWlsYWJsZSwgaW5pdGlhbGl6ZSB0aGUgc2VydmljZSBhbmQgdGhlIDIgY2hhcmFjdGVyaXN0aWNzIG5lZWRlZC5cclxuICogKi9cclxuYXN5bmMgZnVuY3Rpb24gYnRTdWJzY3JpYmUoKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5TVUJTQ1JJQklORztcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wic3ViY3JpYmVzXCJdKys7XHJcbiAgICAgICAgbGV0IGRldmljZSA9IGJ0U3RhdGUuYnREZXZpY2U7XHJcbiAgICAgICAgbGV0IHNlcnZlciA9IG51bGw7XHJcblxyXG4gICAgICAgIGlmICghZGV2aWNlPy5nYXR0Py5jb25uZWN0ZWQpIHtcclxuICAgICAgICAgICAgbG9nLmRlYnVnKGBDb25uZWN0aW5nIHRvIEdBVFQgU2VydmVyIG9uICR7ZGV2aWNlLm5hbWV9Li4uYCk7XHJcbiAgICAgICAgICAgIGRldmljZS5hZGRFdmVudExpc3RlbmVyKCdnYXR0c2VydmVyZGlzY29ubmVjdGVkJywgb25EaXNjb25uZWN0ZWQpO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGJ0U3RhdGUuYnRTZXJ2aWNlPy5jb25uZWN0ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBidFN0YXRlLmJ0U2VydmljZS5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHV0aWxzLnNsZWVwKDEwMCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikgeyB9XHJcblxyXG4gICAgICAgICAgICBzZXJ2ZXIgPSBhd2FpdCBkZXZpY2UuZ2F0dC5jb25uZWN0KCk7XHJcbiAgICAgICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBHQVRUIHNlcnZlcicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgbG9nLmRlYnVnKCdHQVRUIGFscmVhZHkgY29ubmVjdGVkJyk7XHJcbiAgICAgICAgICAgIHNlcnZlciA9IGRldmljZS5nYXR0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBhd2FpdCBzZXJ2ZXIuZ2V0UHJpbWFyeVNlcnZpY2UoQmx1ZVRvb3RoT1dPTi5TZXJ2aWNlVXVpZCk7XHJcbiAgICAgICAgaWYgKGJ0U3RhdGUuYnRTZXJ2aWNlID09IG51bGwpXHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkdBVFQgU2VydmljZSByZXF1ZXN0IGZhaWxlZFwiKTtcclxuICAgICAgICBsb2cuZGVidWcoJz4gRm91bmQgT3dvbiBzZXJ2aWNlJyk7XHJcbiAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZCA9IGF3YWl0IGJ0U3RhdGUuYnRTZXJ2aWNlLmdldENoYXJhY3RlcmlzdGljKEJsdWVUb290aE9XT04uTm90aWZpY2F0aW9uc1V1aWQpO1xyXG4gICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBub3RpZmljYXRpb25zIGNoYXJhY3RlcmlzdGljJyk7XHJcbiAgICAgICAgYnRTdGF0ZS5yZXNwb25zZSA9IG51bGw7XHJcbiAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZC5hZGRFdmVudExpc3RlbmVyKCdjaGFyYWN0ZXJpc3RpY3ZhbHVlY2hhbmdlZCcsIGhhbmRsZU5vdGlmaWNhdGlvbnMpO1xyXG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQuc3RhcnROb3RpZmljYXRpb25zKCk7XHJcbiAgICAgICAgbG9nLmluZm8oJz4gQmx1ZXRvb3RoIGludGVyZmFjZXMgcmVhZHkuJyk7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0c1tcImxhc3RfY29ubmVjdFwiXSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcclxuICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCg1MCk7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLk1FVEVSX0lOSVQ7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgbG9nLndhcm4oXCIqKiBlcnJvciB3aGlsZSBzdWJzY3JpYmluZzogXCIgKyBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgaWYgKGJ0U3RhdGUuY2hhclJlYWQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGJ0U3RhdGUuYnREZXZpY2U/LmdhdHQ/LmNvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJ0U3RhdGUuY2hhclJlYWQuc3RvcE5vdGlmaWNhdGlvbnMoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuYnREZXZpY2U/LmdhdHQuZGlzY29ubmVjdCgpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQgPSBudWxsO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XHJcbiAgICB9XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZha2VTdWJzY3JpYmUoKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5TVUJTQ1JJQklORztcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wic3ViY3JpYmVzXCJdKys7XHJcbiAgICAgICAgbGV0IGRldmljZSA9IGJ0U3RhdGUuYnREZXZpY2U7XHJcbiAgICAgICAgbGV0IHNlcnZlciA9IG51bGw7XHJcblxyXG4gICAgICAgIGlmICghZGV2aWNlPy5nYXR0Py5jb25uZWN0ZWQpIHtcclxuICAgICAgICAgICAgbG9nLmRlYnVnKGBDb25uZWN0aW5nIHRvIEdBVFQgU2VydmVyIG9uICR7ZGV2aWNlLm5hbWV9Li4uYCk7XHJcbiAgICAgICAgICAgIGRldmljZVsnZ2F0dCddWydjb25uZWN0ZWQnXSA9IHRydWU7XHJcbiAgICAgICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBHQVRUIHNlcnZlcicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgbG9nLmRlYnVnKCdHQVRUIGFscmVhZHkgY29ubmVjdGVkJyk7XHJcbiAgICAgICAgICAgIHNlcnZlciA9IGRldmljZS5nYXR0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSB7fTtcclxuICAgICAgICBsb2cuZGVidWcoJz4gRm91bmQgU2VyaWFsIHNlcnZpY2UnKTtcclxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0ge307XHJcbiAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIHJlYWQgY2hhcmFjdGVyaXN0aWMnKTtcclxuICAgICAgICBidFN0YXRlLnJlc3BvbnNlID0gbnVsbDtcclxuICAgICAgICBsb2cuaW5mbygnPiBCbHVldG9vdGggaW50ZXJmYWNlcyByZWFkeS4nKTtcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wibGFzdF9jb25uZWN0XCJdID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xyXG4gICAgICAgIGF3YWl0IHV0aWxzLnNsZWVwKDEwKTtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuTUVURVJfSU5JVDtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICBsb2cud2FybihcIioqIGVycm9yIHdoaWxlIHN1YnNjcmliaW5nOiBcIiArIGVyci5tZXNzYWdlKTtcclxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gbnVsbDtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuREVWSUNFX1BBSVJFRDtcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wiZXhjZXB0aW9uc1wiXSsrO1xyXG4gICAgfVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFdoZW4gaWRsZSwgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWRcclxuICogKi9cclxuYXN5bmMgZnVuY3Rpb24gcmVmcmVzaCgpIHtcclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5CVVNZO1xyXG4gICAgdHJ5XHJcbiAgICB7XHJcbiAgICAgICAgaWYgKGJ0U3RhdGUgIT0gbnVsbCAmJiBidFN0YXRlLnJlc3BvbnNlICE9IG51bGwpXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICBwYXJzZVJlc3BvbnNlKGJ0U3RhdGUucmVzcG9uc2UsIGJ0U3RhdGUucmVzcG9uc2VUaW1lU3RhbXApO1xyXG4gICAgICAgICAgICBidFN0YXRlLnJlc3BvbnNlID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgbG9nLmRlYnVnKFwiXFx0XFx0RmluaXNoZWQgcmVmcmVzaGluZyBjdXJyZW50IHN0YXRlXCIpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgcmVmcmVzaGluZzogXCIgKyBlcnIubWVzc2FnZSk7XHJcbiAgICB9XHJcbiAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuSURMRTtcclxufVxyXG5cclxuZnVuY3Rpb24gU2V0U2ltdWxhdGlvbih2YWx1ZSkge1xyXG4gICAgc2ltdWxhdGlvbiA9IHZhbHVlO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHsgc3RhdGVNYWNoaW5lLCBTZXRTaW11bGF0aW9uLCBidFN0YXRlLCBTdGF0ZSB9OyJdfQ==
