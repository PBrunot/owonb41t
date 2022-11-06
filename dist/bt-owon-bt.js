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
exports.SetPacketLog = BT.SetPacketLog;
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
var logging = false;

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
            "forceDeviceSelection": true
        }
    }
}

let btState = new APIState();

/**
 * Main loop of the meter handler.
 * */
async function stateMachine() {
    var nextAction;
    var DELAY_MS = (simulation ? 20 : 450); // Update the status every X ms.
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

var lastTimeStamp = 0;
/**
 * Event called by bluetooth characteristics when receiving data
 * @param {any} event
 */
function handleNotifications(event) {
    var delay = 0;
    let value = event.target.value;
    if (value != null) {
        log.debug('<< ' + utils.buf2hex(value.buffer));
        if (btState.response != null) {
            btState.response = arrayBufferConcat(btState.response, value.buffer);
        } else {
            btState.response = value.buffer.slice();
        }
        // Keep the event original timestamp !!
        btState.responseTimeStamp = new Date(event.timeStamp);
        if (lastTimeStamp > 0) {
            delay = event.timeStamp - lastTimeStamp; // ms between notifications
        } else {
            delay = 0;
        }
        lastTimeStamp = event.timeStamp;

        parseResponse(btState.response, btState.responseTimeStamp);

        // Log the packets
        if (logging) {
            var packet = { 'notification': utils.buf2hex(btState.response), 'parsed': btState.parsedResponse };
            var packets = window.localStorage.getItem("OwonBTTrace");
            if (packets == null) {
                packets = []; // initialize array
            }
            else {
                packets = JSON.parse(packets); // Restore the json persisted object
            }
            packets.push(packet); // Add the new object
            window.localStorage.setItem("OwonBTTrace", JSON.stringify(packets));
        }
        
        if (delay > 0) {
            btState.stats["lastResponseTime"] = delay;
            btState.stats["responseTime"] = (btState.stats["responseTime"] * (btState.stats["responses"]-1.0) + delay) / btState.stats["responses"];
        }
        btState.stats["responses"]++;

        btState.response = null;
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
            scale = "";
            break;
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
            normalization = 1.0;
            break;
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
        "Value": measurement * normalization,
        "DateTime": new Date(),
        "Decimal": decimal
    };
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
    // Do something
    btState.state = State.IDLE;
}

function SetSimulation(value) {
    simulation = value;
}

/**
 * Enables or disable writing the notifications into a local storage file
 * @param {boolean} value 
 */
function SetPacketLog(value) {
    logging = value;
}
module.exports = { stateMachine, SetSimulation, btState, State, SetPacketLog };
},{"./utils":3,"loglevel":1}]},{},[2])(2)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbG9nbGV2ZWwvbGliL2xvZ2xldmVsLmpzIiwib3dvbi5qcyIsInV0aWxzLmpzIiwid2ViYmx1ZXRvb3RoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qXG4qIGxvZ2xldmVsIC0gaHR0cHM6Ly9naXRodWIuY29tL3BpbXRlcnJ5L2xvZ2xldmVsXG4qXG4qIENvcHlyaWdodCAoYykgMjAxMyBUaW0gUGVycnlcbiogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuKi9cbihmdW5jdGlvbiAocm9vdCwgZGVmaW5pdGlvbikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGRlZmluaXRpb24pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcm9vdC5sb2cgPSBkZWZpbml0aW9uKCk7XG4gICAgfVxufSh0aGlzLCBmdW5jdGlvbiAoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvLyBTbGlnaHRseSBkdWJpb3VzIHRyaWNrcyB0byBjdXQgZG93biBtaW5pbWl6ZWQgZmlsZSBzaXplXG4gICAgdmFyIG5vb3AgPSBmdW5jdGlvbigpIHt9O1xuICAgIHZhciB1bmRlZmluZWRUeXBlID0gXCJ1bmRlZmluZWRcIjtcbiAgICB2YXIgaXNJRSA9ICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlKSAmJiAodHlwZW9mIHdpbmRvdy5uYXZpZ2F0b3IgIT09IHVuZGVmaW5lZFR5cGUpICYmIChcbiAgICAgICAgL1RyaWRlbnRcXC98TVNJRSAvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpXG4gICAgKTtcblxuICAgIHZhciBsb2dNZXRob2RzID0gW1xuICAgICAgICBcInRyYWNlXCIsXG4gICAgICAgIFwiZGVidWdcIixcbiAgICAgICAgXCJpbmZvXCIsXG4gICAgICAgIFwid2FyblwiLFxuICAgICAgICBcImVycm9yXCJcbiAgICBdO1xuXG4gICAgLy8gQ3Jvc3MtYnJvd3NlciBiaW5kIGVxdWl2YWxlbnQgdGhhdCB3b3JrcyBhdCBsZWFzdCBiYWNrIHRvIElFNlxuICAgIGZ1bmN0aW9uIGJpbmRNZXRob2Qob2JqLCBtZXRob2ROYW1lKSB7XG4gICAgICAgIHZhciBtZXRob2QgPSBvYmpbbWV0aG9kTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgbWV0aG9kLmJpbmQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXRob2QuYmluZChvYmopO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuY2FsbChtZXRob2QsIG9iaik7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gTWlzc2luZyBiaW5kIHNoaW0gb3IgSUU4ICsgTW9kZXJuaXpyLCBmYWxsYmFjayB0byB3cmFwcGluZ1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5hcHBseShtZXRob2QsIFtvYmosIGFyZ3VtZW50c10pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUcmFjZSgpIGRvZXNuJ3QgcHJpbnQgdGhlIG1lc3NhZ2UgaW4gSUUsIHNvIGZvciB0aGF0IGNhc2Ugd2UgbmVlZCB0byB3cmFwIGl0XG4gICAgZnVuY3Rpb24gdHJhY2VGb3JJRSgpIHtcbiAgICAgICAgaWYgKGNvbnNvbGUubG9nKSB7XG4gICAgICAgICAgICBpZiAoY29uc29sZS5sb2cuYXBwbHkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBJbiBvbGQgSUUsIG5hdGl2ZSBjb25zb2xlIG1ldGhvZHMgdGhlbXNlbHZlcyBkb24ndCBoYXZlIGFwcGx5KCkuXG4gICAgICAgICAgICAgICAgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmFwcGx5KGNvbnNvbGUubG9nLCBbY29uc29sZSwgYXJndW1lbnRzXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnNvbGUudHJhY2UpIGNvbnNvbGUudHJhY2UoKTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCB0aGUgYmVzdCBsb2dnaW5nIG1ldGhvZCBwb3NzaWJsZSBmb3IgdGhpcyBlbnZcbiAgICAvLyBXaGVyZXZlciBwb3NzaWJsZSB3ZSB3YW50IHRvIGJpbmQsIG5vdCB3cmFwLCB0byBwcmVzZXJ2ZSBzdGFjayB0cmFjZXNcbiAgICBmdW5jdGlvbiByZWFsTWV0aG9kKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgaWYgKG1ldGhvZE5hbWUgPT09ICdkZWJ1ZycpIHtcbiAgICAgICAgICAgIG1ldGhvZE5hbWUgPSAnbG9nJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZSA9PT0gdW5kZWZpbmVkVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBObyBtZXRob2QgcG9zc2libGUsIGZvciBub3cgLSBmaXhlZCBsYXRlciBieSBlbmFibGVMb2dnaW5nV2hlbkNvbnNvbGVBcnJpdmVzXG4gICAgICAgIH0gZWxzZSBpZiAobWV0aG9kTmFtZSA9PT0gJ3RyYWNlJyAmJiBpc0lFKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJhY2VGb3JJRTtcbiAgICAgICAgfSBlbHNlIGlmIChjb25zb2xlW21ldGhvZE5hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBiaW5kTWV0aG9kKGNvbnNvbGUsIG1ldGhvZE5hbWUpO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbnNvbGUubG9nICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBiaW5kTWV0aG9kKGNvbnNvbGUsICdsb2cnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBub29wO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVGhlc2UgcHJpdmF0ZSBmdW5jdGlvbnMgYWx3YXlzIG5lZWQgYHRoaXNgIHRvIGJlIHNldCBwcm9wZXJseVxuXG4gICAgZnVuY3Rpb24gcmVwbGFjZUxvZ2dpbmdNZXRob2RzKGxldmVsLCBsb2dnZXJOYW1lKSB7XG4gICAgICAgIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9nTWV0aG9kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIG1ldGhvZE5hbWUgPSBsb2dNZXRob2RzW2ldO1xuICAgICAgICAgICAgdGhpc1ttZXRob2ROYW1lXSA9IChpIDwgbGV2ZWwpID9cbiAgICAgICAgICAgICAgICBub29wIDpcbiAgICAgICAgICAgICAgICB0aGlzLm1ldGhvZEZhY3RvcnkobWV0aG9kTmFtZSwgbGV2ZWwsIGxvZ2dlck5hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGVmaW5lIGxvZy5sb2cgYXMgYW4gYWxpYXMgZm9yIGxvZy5kZWJ1Z1xuICAgICAgICB0aGlzLmxvZyA9IHRoaXMuZGVidWc7XG4gICAgfVxuXG4gICAgLy8gSW4gb2xkIElFIHZlcnNpb25zLCB0aGUgY29uc29sZSBpc24ndCBwcmVzZW50IHVudGlsIHlvdSBmaXJzdCBvcGVuIGl0LlxuICAgIC8vIFdlIGJ1aWxkIHJlYWxNZXRob2QoKSByZXBsYWNlbWVudHMgaGVyZSB0aGF0IHJlZ2VuZXJhdGUgbG9nZ2luZyBtZXRob2RzXG4gICAgZnVuY3Rpb24gZW5hYmxlTG9nZ2luZ1doZW5Db25zb2xlQXJyaXZlcyhtZXRob2ROYW1lLCBsZXZlbCwgbG9nZ2VyTmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSB1bmRlZmluZWRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmVwbGFjZUxvZ2dpbmdNZXRob2RzLmNhbGwodGhpcywgbGV2ZWwsIGxvZ2dlck5hbWUpO1xuICAgICAgICAgICAgICAgIHRoaXNbbWV0aG9kTmFtZV0uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBCeSBkZWZhdWx0LCB3ZSB1c2UgY2xvc2VseSBib3VuZCByZWFsIG1ldGhvZHMgd2hlcmV2ZXIgcG9zc2libGUsIGFuZFxuICAgIC8vIG90aGVyd2lzZSB3ZSB3YWl0IGZvciBhIGNvbnNvbGUgdG8gYXBwZWFyLCBhbmQgdGhlbiB0cnkgYWdhaW4uXG4gICAgZnVuY3Rpb24gZGVmYXVsdE1ldGhvZEZhY3RvcnkobWV0aG9kTmFtZSwgbGV2ZWwsIGxvZ2dlck5hbWUpIHtcbiAgICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgICAgcmV0dXJuIHJlYWxNZXRob2QobWV0aG9kTmFtZSkgfHxcbiAgICAgICAgICAgICAgIGVuYWJsZUxvZ2dpbmdXaGVuQ29uc29sZUFycml2ZXMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBMb2dnZXIobmFtZSwgZGVmYXVsdExldmVsLCBmYWN0b3J5KSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgY3VycmVudExldmVsO1xuICAgICAgZGVmYXVsdExldmVsID0gZGVmYXVsdExldmVsID09IG51bGwgPyBcIldBUk5cIiA6IGRlZmF1bHRMZXZlbDtcblxuICAgICAgdmFyIHN0b3JhZ2VLZXkgPSBcImxvZ2xldmVsXCI7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgc3RvcmFnZUtleSArPSBcIjpcIiArIG5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuYW1lID09PSBcInN5bWJvbFwiKSB7XG4gICAgICAgIHN0b3JhZ2VLZXkgPSB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHBlcnNpc3RMZXZlbElmUG9zc2libGUobGV2ZWxOdW0pIHtcbiAgICAgICAgICB2YXIgbGV2ZWxOYW1lID0gKGxvZ01ldGhvZHNbbGV2ZWxOdW1dIHx8ICdzaWxlbnQnKS50b1VwcGVyQ2FzZSgpO1xuXG4gICAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IHVuZGVmaW5lZFR5cGUgfHwgIXN0b3JhZ2VLZXkpIHJldHVybjtcblxuICAgICAgICAgIC8vIFVzZSBsb2NhbFN0b3JhZ2UgaWYgYXZhaWxhYmxlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZVtzdG9yYWdlS2V5XSA9IGxldmVsTmFtZTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cblxuICAgICAgICAgIC8vIFVzZSBzZXNzaW9uIGNvb2tpZSBhcyBmYWxsYmFja1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5kb2N1bWVudC5jb29raWUgPVxuICAgICAgICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChzdG9yYWdlS2V5KSArIFwiPVwiICsgbGV2ZWxOYW1lICsgXCI7XCI7XG4gICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBnZXRQZXJzaXN0ZWRMZXZlbCgpIHtcbiAgICAgICAgICB2YXIgc3RvcmVkTGV2ZWw7XG5cbiAgICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gdW5kZWZpbmVkVHlwZSB8fCAhc3RvcmFnZUtleSkgcmV0dXJuO1xuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgc3RvcmVkTGV2ZWwgPSB3aW5kb3cubG9jYWxTdG9yYWdlW3N0b3JhZ2VLZXldO1xuICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cblxuICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGNvb2tpZXMgaWYgbG9jYWwgc3RvcmFnZSBnaXZlcyB1cyBub3RoaW5nXG4gICAgICAgICAgaWYgKHR5cGVvZiBzdG9yZWRMZXZlbCA9PT0gdW5kZWZpbmVkVHlwZSkge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgdmFyIGNvb2tpZSA9IHdpbmRvdy5kb2N1bWVudC5jb29raWU7XG4gICAgICAgICAgICAgICAgICB2YXIgbG9jYXRpb24gPSBjb29raWUuaW5kZXhPZihcbiAgICAgICAgICAgICAgICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RvcmFnZUtleSkgKyBcIj1cIik7XG4gICAgICAgICAgICAgICAgICBpZiAobG9jYXRpb24gIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3RvcmVkTGV2ZWwgPSAvXihbXjtdKykvLmV4ZWMoY29va2llLnNsaWNlKGxvY2F0aW9uKSlbMV07XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBJZiB0aGUgc3RvcmVkIGxldmVsIGlzIG5vdCB2YWxpZCwgdHJlYXQgaXQgYXMgaWYgbm90aGluZyB3YXMgc3RvcmVkLlxuICAgICAgICAgIGlmIChzZWxmLmxldmVsc1tzdG9yZWRMZXZlbF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBzdG9yZWRMZXZlbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gc3RvcmVkTGV2ZWw7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGNsZWFyUGVyc2lzdGVkTGV2ZWwoKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IHVuZGVmaW5lZFR5cGUgfHwgIXN0b3JhZ2VLZXkpIHJldHVybjtcblxuICAgICAgICAgIC8vIFVzZSBsb2NhbFN0b3JhZ2UgaWYgYXZhaWxhYmxlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHN0b3JhZ2VLZXkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuXG4gICAgICAgICAgLy8gVXNlIHNlc3Npb24gY29va2llIGFzIGZhbGxiYWNrXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd2luZG93LmRvY3VtZW50LmNvb2tpZSA9XG4gICAgICAgICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0b3JhZ2VLZXkpICsgXCI9OyBleHBpcmVzPVRodSwgMDEgSmFuIDE5NzAgMDA6MDA6MDAgVVRDXCI7XG4gICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuICAgICAgfVxuXG4gICAgICAvKlxuICAgICAgICpcbiAgICAgICAqIFB1YmxpYyBsb2dnZXIgQVBJIC0gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9waW10ZXJyeS9sb2dsZXZlbCBmb3IgZGV0YWlsc1xuICAgICAgICpcbiAgICAgICAqL1xuXG4gICAgICBzZWxmLm5hbWUgPSBuYW1lO1xuXG4gICAgICBzZWxmLmxldmVscyA9IHsgXCJUUkFDRVwiOiAwLCBcIkRFQlVHXCI6IDEsIFwiSU5GT1wiOiAyLCBcIldBUk5cIjogMyxcbiAgICAgICAgICBcIkVSUk9SXCI6IDQsIFwiU0lMRU5UXCI6IDV9O1xuXG4gICAgICBzZWxmLm1ldGhvZEZhY3RvcnkgPSBmYWN0b3J5IHx8IGRlZmF1bHRNZXRob2RGYWN0b3J5O1xuXG4gICAgICBzZWxmLmdldExldmVsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBjdXJyZW50TGV2ZWw7XG4gICAgICB9O1xuXG4gICAgICBzZWxmLnNldExldmVsID0gZnVuY3Rpb24gKGxldmVsLCBwZXJzaXN0KSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBsZXZlbCA9PT0gXCJzdHJpbmdcIiAmJiBzZWxmLmxldmVsc1tsZXZlbC50b1VwcGVyQ2FzZSgpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIGxldmVsID0gc2VsZi5sZXZlbHNbbGV2ZWwudG9VcHBlckNhc2UoKV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWwgPT09IFwibnVtYmVyXCIgJiYgbGV2ZWwgPj0gMCAmJiBsZXZlbCA8PSBzZWxmLmxldmVscy5TSUxFTlQpIHtcbiAgICAgICAgICAgICAgY3VycmVudExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgICAgIGlmIChwZXJzaXN0ICE9PSBmYWxzZSkgeyAgLy8gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgICAgICAgICAgICAgICAgcGVyc2lzdExldmVsSWZQb3NzaWJsZShsZXZlbCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVwbGFjZUxvZ2dpbmdNZXRob2RzLmNhbGwoc2VsZiwgbGV2ZWwsIG5hbWUpO1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgPT09IHVuZGVmaW5lZFR5cGUgJiYgbGV2ZWwgPCBzZWxmLmxldmVscy5TSUxFTlQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIk5vIGNvbnNvbGUgYXZhaWxhYmxlIGZvciBsb2dnaW5nXCI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aHJvdyBcImxvZy5zZXRMZXZlbCgpIGNhbGxlZCB3aXRoIGludmFsaWQgbGV2ZWw6IFwiICsgbGV2ZWw7XG4gICAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgc2VsZi5zZXREZWZhdWx0TGV2ZWwgPSBmdW5jdGlvbiAobGV2ZWwpIHtcbiAgICAgICAgICBkZWZhdWx0TGV2ZWwgPSBsZXZlbDtcbiAgICAgICAgICBpZiAoIWdldFBlcnNpc3RlZExldmVsKCkpIHtcbiAgICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChsZXZlbCwgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHNlbGYucmVzZXRMZXZlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBzZWxmLnNldExldmVsKGRlZmF1bHRMZXZlbCwgZmFsc2UpO1xuICAgICAgICAgIGNsZWFyUGVyc2lzdGVkTGV2ZWwoKTtcbiAgICAgIH07XG5cbiAgICAgIHNlbGYuZW5hYmxlQWxsID0gZnVuY3Rpb24ocGVyc2lzdCkge1xuICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHMuVFJBQ0UsIHBlcnNpc3QpO1xuICAgICAgfTtcblxuICAgICAgc2VsZi5kaXNhYmxlQWxsID0gZnVuY3Rpb24ocGVyc2lzdCkge1xuICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHMuU0lMRU5ULCBwZXJzaXN0KTtcbiAgICAgIH07XG5cbiAgICAgIC8vIEluaXRpYWxpemUgd2l0aCB0aGUgcmlnaHQgbGV2ZWxcbiAgICAgIHZhciBpbml0aWFsTGV2ZWwgPSBnZXRQZXJzaXN0ZWRMZXZlbCgpO1xuICAgICAgaWYgKGluaXRpYWxMZXZlbCA9PSBudWxsKSB7XG4gICAgICAgICAgaW5pdGlhbExldmVsID0gZGVmYXVsdExldmVsO1xuICAgICAgfVxuICAgICAgc2VsZi5zZXRMZXZlbChpbml0aWFsTGV2ZWwsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqXG4gICAgICogVG9wLWxldmVsIEFQSVxuICAgICAqXG4gICAgICovXG5cbiAgICB2YXIgZGVmYXVsdExvZ2dlciA9IG5ldyBMb2dnZXIoKTtcblxuICAgIHZhciBfbG9nZ2Vyc0J5TmFtZSA9IHt9O1xuICAgIGRlZmF1bHRMb2dnZXIuZ2V0TG9nZ2VyID0gZnVuY3Rpb24gZ2V0TG9nZ2VyKG5hbWUpIHtcbiAgICAgICAgaWYgKCh0eXBlb2YgbmFtZSAhPT0gXCJzeW1ib2xcIiAmJiB0eXBlb2YgbmFtZSAhPT0gXCJzdHJpbmdcIikgfHwgbmFtZSA9PT0gXCJcIikge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJZb3UgbXVzdCBzdXBwbHkgYSBuYW1lIHdoZW4gY3JlYXRpbmcgYSBsb2dnZXIuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGxvZ2dlciA9IF9sb2dnZXJzQnlOYW1lW25hbWVdO1xuICAgICAgICBpZiAoIWxvZ2dlcikge1xuICAgICAgICAgIGxvZ2dlciA9IF9sb2dnZXJzQnlOYW1lW25hbWVdID0gbmV3IExvZ2dlcihcbiAgICAgICAgICAgIG5hbWUsIGRlZmF1bHRMb2dnZXIuZ2V0TGV2ZWwoKSwgZGVmYXVsdExvZ2dlci5tZXRob2RGYWN0b3J5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbG9nZ2VyO1xuICAgIH07XG5cbiAgICAvLyBHcmFiIHRoZSBjdXJyZW50IGdsb2JhbCBsb2cgdmFyaWFibGUgaW4gY2FzZSBvZiBvdmVyd3JpdGVcbiAgICB2YXIgX2xvZyA9ICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlKSA/IHdpbmRvdy5sb2cgOiB1bmRlZmluZWQ7XG4gICAgZGVmYXVsdExvZ2dlci5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlICYmXG4gICAgICAgICAgICAgICB3aW5kb3cubG9nID09PSBkZWZhdWx0TG9nZ2VyKSB7XG4gICAgICAgICAgICB3aW5kb3cubG9nID0gX2xvZztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWZhdWx0TG9nZ2VyO1xuICAgIH07XG5cbiAgICBkZWZhdWx0TG9nZ2VyLmdldExvZ2dlcnMgPSBmdW5jdGlvbiBnZXRMb2dnZXJzKCkge1xuICAgICAgICByZXR1cm4gX2xvZ2dlcnNCeU5hbWU7XG4gICAgfTtcblxuICAgIC8vIEVTNiBkZWZhdWx0IGV4cG9ydCwgZm9yIGNvbXBhdGliaWxpdHlcbiAgICBkZWZhdWx0TG9nZ2VyWydkZWZhdWx0J10gPSBkZWZhdWx0TG9nZ2VyO1xuXG4gICAgcmV0dXJuIGRlZmF1bHRMb2dnZXI7XG59KSk7XG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5jb25zdCBsb2cgPSByZXF1aXJlKFwibG9nbGV2ZWxcIik7XHJcbmNvbnN0IEJUID0gcmVxdWlyZShcIi4vd2ViYmx1ZXRvb3RoXCIpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xyXG5jb25zdCBTdGF0ZSA9IEJULlN0YXRlO1xyXG5jb25zdCBidFN0YXRlID0gQlQuYnRTdGF0ZTtcclxuXHJcbmFzeW5jIGZ1bmN0aW9uIFN0YXJ0KCkge1xyXG4gICAgbG9nLmluZm8oXCJTdGFydCBjYWxsZWQuLi5cIik7XHJcblxyXG4gICAgaWYgKCFidFN0YXRlLnN0YXJ0ZWQpIHtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuTk9UX0NPTk5FQ1RFRDtcclxuICAgICAgICBCVC5zdGF0ZU1hY2hpbmUoKTsgLy8gU3RhcnQgaXRcclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGJ0U3RhdGUuc3RhdGUgPT0gU3RhdGUuRVJST1IpIHtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuTk9UX0NPTk5FQ1RFRDsgLy8gVHJ5IHRvIHJlc3RhcnRcclxuICAgIH1cclxuICAgIGF3YWl0IHV0aWxzLndhaXRGb3IoKCkgPT4gYnRTdGF0ZS5zdGF0ZSA9PSBTdGF0ZS5JRExFIHx8IGJ0U3RhdGUuc3RhdGUgPT0gU3RhdGUuU1RPUFBFRCk7XHJcbiAgICBsb2cuaW5mbyhcIlBhaXJpbmcgY29tcGxldGVkLCBzdGF0ZSA6XCIsIGJ0U3RhdGUuc3RhdGUpO1xyXG4gICAgcmV0dXJuIChidFN0YXRlLnN0YXRlICE9IFN0YXRlLlNUT1BQRUQpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBTdG9wKCkge1xyXG4gICAgbG9nLmluZm8oXCJTdG9wIHJlcXVlc3QgcmVjZWl2ZWRcIik7XHJcblxyXG4gICAgYnRTdGF0ZS5zdG9wUmVxdWVzdCA9IHRydWU7XHJcbiAgICBhd2FpdCB1dGlscy5zbGVlcCgxMDApO1xyXG5cclxuICAgIHdoaWxlKGJ0U3RhdGUuc3RhcnRlZCB8fCAoYnRTdGF0ZS5zdGF0ZSAhPSBTdGF0ZS5TVE9QUEVEICYmIGJ0U3RhdGUuc3RhdGUgIT0gU3RhdGUuTk9UX0NPTk5FQ1RFRCkpXHJcbiAgICB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdG9wUmVxdWVzdCA9IHRydWU7ICAgIFxyXG4gICAgICAgIGF3YWl0IHV0aWxzLnNsZWVwKDEwMCk7XHJcbiAgICB9XHJcbiAgICBidFN0YXRlLmNvbW1hbmQgPSBudWxsO1xyXG4gICAgYnRTdGF0ZS5zdG9wUmVxdWVzdCA9IGZhbHNlO1xyXG4gICAgbG9nLndhcm4oXCJTdG9wcGVkIG9uIHJlcXVlc3QuXCIpO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIFNldExvZ0xldmVsKGxldmVsKSB7XHJcbiAgICBsb2cuc2V0TGV2ZWwobGV2ZWwsIGZhbHNlKTtcclxufVxyXG5cclxuZXhwb3J0cy5TdGFydCA9IFN0YXJ0O1xyXG5leHBvcnRzLlN0b3AgPSBTdG9wO1xyXG5leHBvcnRzLlNldExvZ0xldmVsID0gU2V0TG9nTGV2ZWw7XHJcbmV4cG9ydHMuYnRTdGF0ZSA9IEJULmJ0U3RhdGU7XHJcbmV4cG9ydHMuU3RhdGUgPSBCVC5TdGF0ZTtcclxuZXhwb3J0cy5TZXRQYWNrZXRMb2cgPSBCVC5TZXRQYWNrZXRMb2c7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxubGV0IHNsZWVwID0gbXMgPT4gbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XHJcbmxldCB3YWl0Rm9yID0gYXN5bmMgZnVuY3Rpb24gd2FpdEZvcihmKSB7XHJcbiAgICB3aGlsZSAoIWYoKSkgYXdhaXQgc2xlZXAoMTAwICsgTWF0aC5yYW5kb20oKSAqIDI1KTtcclxuICAgIHJldHVybiBmKCk7XHJcbn07XHJcblxyXG5sZXQgd2FpdEZvclRpbWVvdXQgPSBhc3luYyBmdW5jdGlvbiB3YWl0Rm9yKGYsIHRpbWVvdXRTZWMpIHtcclxuICAgIHZhciB0b3RhbFRpbWVNcyA9IDA7XHJcbiAgICB3aGlsZSAoIWYoKSAmJiB0b3RhbFRpbWVNcyA8IHRpbWVvdXRTZWMgKiAxMDAwKSB7XHJcbiAgICAgICAgdmFyIGRlbGF5TXMgPSAxMDAgKyBNYXRoLnJhbmRvbSgpICogMjU7XHJcbiAgICAgICAgdG90YWxUaW1lTXMgKz0gZGVsYXlNcztcclxuICAgICAgICBhd2FpdCBzbGVlcChkZWxheU1zKTtcclxuICAgIH1cclxuICAgIHJldHVybiBmKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGNvbnZlcnQgYSB2YWx1ZSBpbnRvIGFuIGVudW0gdmFsdWVcclxuICogXHJcbiAqIEBwYXJhbSB7dHlwZX0gZW51bXR5cGVcclxuICogQHBhcmFtIHtudW1iZXJ9IGVudW12YWx1ZVxyXG4gKi9cclxuIGZ1bmN0aW9uIFBhcnNlKGVudW10eXBlLCBlbnVtdmFsdWUpIHtcclxuICAgIGZvciAodmFyIGVudW1OYW1lIGluIGVudW10eXBlKSB7XHJcbiAgICAgICAgaWYgKGVudW10eXBlW2VudW1OYW1lXSA9PSBlbnVtdmFsdWUpIHtcclxuICAgICAgICAgICAgLypqc2hpbnQgLVcwNjEgKi9cclxuICAgICAgICAgICAgcmV0dXJuIGV2YWwoW2VudW10eXBlICsgXCIuXCIgKyBlbnVtTmFtZV0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG59XHJcblxyXG4vKipcclxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGR1bXAgYXJyYXlidWZmZXIgYXMgaGV4IHN0cmluZ1xyXG4gKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBidWZmZXJcclxuICovXHJcbiBmdW5jdGlvbiBidWYyaGV4KGJ1ZmZlcikgeyAvLyBidWZmZXIgaXMgYW4gQXJyYXlCdWZmZXJcclxuICAgIHJldHVybiBbLi4ubmV3IFVpbnQ4QXJyYXkoYnVmZmVyKV1cclxuICAgICAgICAubWFwKHggPT4geC50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSlcclxuICAgICAgICAuam9pbignICcpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBoZXgyYnVmIChpbnB1dCkge1xyXG4gICAgaWYgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHBlY3RlZCBpbnB1dCB0byBiZSBhIHN0cmluZycpXHJcbiAgICB9XHJcbiAgICB2YXIgaGV4c3RyID0gaW5wdXQucmVwbGFjZSgvXFxzKy9nLCAnJyk7XHJcbiAgICBpZiAoKGhleHN0ci5sZW5ndGggJSAyKSAhPT0gMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdFeHBlY3RlZCBzdHJpbmcgdG8gYmUgYW4gZXZlbiBudW1iZXIgb2YgY2hhcmFjdGVycycpXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdmlldyA9IG5ldyBVaW50OEFycmF5KGhleHN0ci5sZW5ndGggLyAyKVxyXG5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaGV4c3RyLmxlbmd0aDsgaSArPSAyKSB7XHJcbiAgICAgICAgdmlld1tpIC8gMl0gPSBwYXJzZUludChoZXhzdHIuc3Vic3RyaW5nKGksIGkgKyAyKSwgMTYpXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHZpZXcuYnVmZmVyXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0geyBzbGVlcCwgd2FpdEZvciwgd2FpdEZvclRpbWVvdXQsIFBhcnNlLCBidWYyaGV4LCBoZXgyYnVmIH07IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLyoqXHJcbiAqICBCbHVldG9vdGggaGFuZGxpbmcgbW9kdWxlLCBpbmNsdWRpbmcgbWFpbiBzdGF0ZSBtYWNoaW5lIGxvb3AuXHJcbiAqICBUaGlzIG1vZHVsZSBpbnRlcmFjdHMgd2l0aCBicm93c2VyIGZvciBibHVldG9vdGggY29tdW5pY2F0aW9ucyBhbmQgcGFpcmluZywgYW5kIHdpdGggU2VuZWNhTVNDIG9iamVjdC5cclxuICovXHJcblxyXG5jb25zdCBsb2cgPSByZXF1aXJlKCdsb2dsZXZlbCcpO1xyXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcclxuXHJcbnZhciBzaW11bGF0aW9uID0gZmFsc2U7XHJcbnZhciBsb2dnaW5nID0gZmFsc2U7XHJcblxyXG4vKlxyXG4gKiBCbHVldG9vdGggY29uc3RhbnRzXHJcbiAqL1xyXG5jb25zdCBCbHVlVG9vdGhPV09OID0ge1xyXG4gICAgU2VydmljZVV1aWQ6ICcwMDAwZmZmMC0wMDAwLTEwMDAtODAwMC0wMDgwNWY5YjM0ZmInLCAvLyBibHVldG9vdGggc2VydmljZSBmb3IgT3dvbiBCNDFUK1xyXG4gICAgTm90aWZpY2F0aW9uc1V1aWQ6ICcwMDAwZmZmNC0wMDAwLTEwMDAtODAwMC0wMDgwNWY5YjM0ZmInLFxyXG59O1xyXG5cclxuLypcclxuICogSW50ZXJuYWwgc3RhdGUgbWFjaGluZSBkZXNjcmlwdGlvbnNcclxuICovXHJcbmNvbnN0IFN0YXRlID0ge1xyXG4gICAgTk9UX0NPTk5FQ1RFRDogJ05vdCBjb25uZWN0ZWQnLFxyXG4gICAgQ09OTkVDVElORzogJ0JsdWV0b290aCBkZXZpY2UgcGFpcmluZy4uLicsXHJcbiAgICBERVZJQ0VfUEFJUkVEOiAnRGV2aWNlIHBhaXJlZCcsXHJcbiAgICBTVUJTQ1JJQklORzogJ0JsdWV0b290aCBpbnRlcmZhY2VzIGNvbm5lY3RpbmcuLi4nLFxyXG4gICAgSURMRTogJ0lkbGUnLFxyXG4gICAgQlVTWTogJ0J1c3knLFxyXG4gICAgRVJST1I6ICdFcnJvcicsXHJcbiAgICBTVE9QUElORzogJ0Nsb3NpbmcgQlQgaW50ZXJmYWNlcy4uLicsXHJcbiAgICBTVE9QUEVEOiAnU3RvcHBlZCcsXHJcbiAgICBNRVRFUl9JTklUOiAnTWV0ZXIgY29ubmVjdGVkJyxcclxuICAgIE1FVEVSX0lOSVRJQUxJWklORzogJ1JlYWRpbmcgbWV0ZXIgc3RhdGUuLi4nXHJcbn07XHJcblxyXG5jbGFzcyBBUElTdGF0ZSB7XHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuTk9UX0NPTk5FQ1RFRDtcclxuICAgICAgICB0aGlzLnByZXZfc3RhdGUgPSBTdGF0ZS5OT1RfQ09OTkVDVEVEO1xyXG4gICAgICAgIHRoaXMuc3RhdGVfY3B0ID0gMDtcclxuXHJcbiAgICAgICAgdGhpcy5zdGFydGVkID0gZmFsc2U7IC8vIFN0YXRlIG1hY2hpbmUgc3RhdHVzXHJcbiAgICAgICAgdGhpcy5zdG9wUmVxdWVzdCA9IGZhbHNlOyAvLyBUbyByZXF1ZXN0IGRpc2Nvbm5lY3RcclxuXHJcblxyXG4gICAgICAgIC8vIGxhc3Qgbm90aWZpY2F0aW9uXHJcbiAgICAgICAgdGhpcy5yZXNwb25zZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5yZXNwb25zZVRpbWVTdGFtcCA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgdGhpcy5wYXJzZWRSZXNwb25zZSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5mb3JtYXR0ZWRSZXNwb25zZSA9ICcnO1xyXG5cclxuICAgICAgICAvLyBibHVldG9vdGggcHJvcGVydGllc1xyXG4gICAgICAgIHRoaXMuY2hhclJlYWQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuYnRTZXJ2aWNlID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJ0RGV2aWNlID0gbnVsbDtcclxuXHJcbiAgICAgICAgLy8gZ2VuZXJhbCBzdGF0aXN0aWNzIGZvciBkZWJ1Z2dpbmdcclxuICAgICAgICB0aGlzLnN0YXRzID0ge1xyXG4gICAgICAgICAgICBcInJlcXVlc3RzXCI6IDAsXHJcbiAgICAgICAgICAgIFwicmVzcG9uc2VzXCI6IDAsXHJcbiAgICAgICAgICAgIFwibW9kYnVzX2Vycm9yc1wiOiAwLFxyXG4gICAgICAgICAgICBcIkdBVFQgZGlzY29ubmVjdHNcIjogMCxcclxuICAgICAgICAgICAgXCJleGNlcHRpb25zXCI6IDAsXHJcbiAgICAgICAgICAgIFwic3ViY3JpYmVzXCI6IDAsXHJcbiAgICAgICAgICAgIFwiY29tbWFuZHNcIjogMCxcclxuICAgICAgICAgICAgXCJyZXNwb25zZVRpbWVcIjogMC4wLFxyXG4gICAgICAgICAgICBcImxhc3RSZXNwb25zZVRpbWVcIjogMC4wLFxyXG4gICAgICAgICAgICBcImxhc3RfY29ubmVjdFwiOiBuZXcgRGF0ZSgyMDIwLCAxLCAxKS50b0lTT1N0cmluZygpXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5vcHRpb25zID0ge1xyXG4gICAgICAgICAgICBcImZvcmNlRGV2aWNlU2VsZWN0aW9uXCI6IHRydWVcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbmxldCBidFN0YXRlID0gbmV3IEFQSVN0YXRlKCk7XHJcblxyXG4vKipcclxuICogTWFpbiBsb29wIG9mIHRoZSBtZXRlciBoYW5kbGVyLlxyXG4gKiAqL1xyXG5hc3luYyBmdW5jdGlvbiBzdGF0ZU1hY2hpbmUoKSB7XHJcbiAgICB2YXIgbmV4dEFjdGlvbjtcclxuICAgIHZhciBERUxBWV9NUyA9IChzaW11bGF0aW9uID8gMjAgOiA0NTApOyAvLyBVcGRhdGUgdGhlIHN0YXR1cyBldmVyeSBYIG1zLlxyXG4gICAgdmFyIFRJTUVPVVRfTVMgPSAoc2ltdWxhdGlvbiA/IDEwMDAgOiAzMDAwMCk7IC8vIEdpdmUgdXAgc29tZSBvcGVyYXRpb25zIGFmdGVyIFggbXMuXHJcbiAgICBidFN0YXRlLnN0YXJ0ZWQgPSB0cnVlO1xyXG5cclxuICAgIGxvZy5kZWJ1ZyhcIkN1cnJlbnQgc3RhdGU6XCIgKyBidFN0YXRlLnN0YXRlKTtcclxuXHJcbiAgICAvLyBDb25zZWN1dGl2ZSBzdGF0ZSBjb3VudGVkLiBDYW4gYmUgdXNlZCB0byB0aW1lb3V0LlxyXG4gICAgaWYgKGJ0U3RhdGUuc3RhdGUgPT0gYnRTdGF0ZS5wcmV2X3N0YXRlKSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQrKztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQgPSAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFN0b3AgcmVxdWVzdCBmcm9tIEFQSVxyXG4gICAgaWYgKGJ0U3RhdGUuc3RvcFJlcXVlc3QpIHtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuU1RPUFBJTkc7XHJcbiAgICB9XHJcblxyXG4gICAgbG9nLmRlYnVnKFwiXFxTdGF0ZTpcIiArIGJ0U3RhdGUuc3RhdGUpO1xyXG4gICAgc3dpdGNoIChidFN0YXRlLnN0YXRlKSB7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5OT1RfQ09OTkVDVEVEOiAvLyBpbml0aWFsIHN0YXRlIG9uIFN0YXJ0KClcclxuICAgICAgICAgICAgaWYgKHNpbXVsYXRpb24pIHtcclxuICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlUGFpckRldmljZTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBidFBhaXJEZXZpY2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5DT05ORUNUSU5HOiAvLyB3YWl0aW5nIGZvciBjb25uZWN0aW9uIHRvIGNvbXBsZXRlXHJcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuREVWSUNFX1BBSVJFRDogLy8gY29ubmVjdGlvbiBjb21wbGV0ZSwgYWNxdWlyZSBtZXRlciBzdGF0ZVxyXG4gICAgICAgICAgICBpZiAoc2ltdWxhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGZha2VTdWJzY3JpYmU7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gYnRTdWJzY3JpYmU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5TVUJTQ1JJQklORzogLy8gd2FpdGluZyBmb3IgQmx1ZXRvb3RoIGludGVyZmFjZXNcclxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuc3RhdGVfY3B0ID4gKFRJTUVPVVRfTVMgLyBERUxBWV9NUykpIHtcclxuICAgICAgICAgICAgICAgIC8vIFRpbWVvdXQsIHRyeSB0byByZXN1YnNjcmliZVxyXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJUaW1lb3V0IGluIFNVQlNDUklCSU5HXCIpO1xyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7XHJcbiAgICAgICAgICAgICAgICBidFN0YXRlLnN0YXRlX2NwdCA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5NRVRFUl9JTklUOiAvLyByZWFkeSB0byBjb21tdW5pY2F0ZSwgYWNxdWlyZSBtZXRlciBzdGF0dXNcclxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IG1ldGVySW5pdDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5NRVRFUl9JTklUSUFMSVpJTkc6IC8vIHJlYWRpbmcgdGhlIG1ldGVyIHN0YXR1c1xyXG4gICAgICAgICAgICBpZiAoYnRTdGF0ZS5zdGF0ZV9jcHQgPiAoVElNRU9VVF9NUyAvIERFTEFZX01TKSkge1xyXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJUaW1lb3V0IGluIE1FVEVSX0lOSVRJQUxJWklOR1wiKTtcclxuICAgICAgICAgICAgICAgIC8vIFRpbWVvdXQsIHRyeSB0byByZXN1YnNjcmliZVxyXG4gICAgICAgICAgICAgICAgaWYgKHNpbXVsYXRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gZmFrZVN1YnNjcmliZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGJ0U3Vic2NyaWJlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQgPSAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgU3RhdGUuSURMRTogLy8gcmVhZHkgdG8gcHJvY2VzcyBjb21tYW5kcyBmcm9tIEFQSVxyXG4gICAgICAgICAgICBpZiAoYnRTdGF0ZS5jb21tYW5kICE9IG51bGwpXHJcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gcHJvY2Vzc0NvbW1hbmQ7XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IHJlZnJlc2g7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5FUlJPUjogLy8gYW55dGltZSBhbiBlcnJvciBoYXBwZW5zXHJcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSBkaXNjb25uZWN0O1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFN0YXRlLkJVU1k6IC8vIHdoaWxlIGEgY29tbWFuZCBpbiBnb2luZyBvblxyXG4gICAgICAgICAgICBpZiAoYnRTdGF0ZS5zdGF0ZV9jcHQgPiAoVElNRU9VVF9NUyAvIERFTEFZX01TKSkge1xyXG4gICAgICAgICAgICAgICAgbG9nLndhcm4oXCJUaW1lb3V0IGluIEJVU1lcIik7XHJcbiAgICAgICAgICAgICAgICAvLyBUaW1lb3V0LCB0cnkgdG8gcmVzdWJzY3JpYmVcclxuICAgICAgICAgICAgICAgIGlmIChzaW11bGF0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGZha2VTdWJzY3JpYmU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBidFN1YnNjcmliZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuc3RhdGVfY3B0ID0gMDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFN0YXRlLlNUT1BQSU5HOlxyXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gZGlzY29ubmVjdDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBTdGF0ZS5TVE9QUEVEOiAvLyBhZnRlciBhIGRpc2Nvbm5lY3RvciBvciBTdG9wKCkgcmVxdWVzdCwgc3RvcHMgdGhlIHN0YXRlIG1hY2hpbmUuXHJcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIGJ0U3RhdGUucHJldl9zdGF0ZSA9IGJ0U3RhdGUuc3RhdGU7XHJcblxyXG4gICAgaWYgKG5leHRBY3Rpb24gIT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbG9nLmRlYnVnKFwiXFx0RXhlY3V0aW5nOlwiICsgbmV4dEFjdGlvbi5uYW1lKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBuZXh0QWN0aW9uKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIkV4Y2VwdGlvbiBpbiBzdGF0ZSBtYWNoaW5lXCIsIGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChidFN0YXRlLnN0YXRlICE9IFN0YXRlLlNUT1BQRUQpIHtcclxuICAgICAgICB1dGlscy5zbGVlcChERUxBWV9NUykudGhlbigoKSA9PiBzdGF0ZU1hY2hpbmUoKSk7IC8vIFJlY2hlY2sgc3RhdHVzIGluIERFTEFZX01TIG1zXHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgICBsb2cuZGVidWcoXCJcXHRUZXJtaW5hdGluZyBTdGF0ZSBtYWNoaW5lXCIpO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhcnRlZCA9IGZhbHNlO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ2FsbGVkIGZyb20gc3RhdGUgbWFjaGluZSB0byBleGVjdXRlIGEgc2luZ2xlIGNvbW1hbmQgZnJvbSBidFN0YXRlLmNvbW1hbmQgcHJvcGVydHlcclxuICogKi9cclxuYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0NvbW1hbmQoKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbW1hbmQuZXJyb3IgPSBmYWxzZTtcclxuICAgICAgICBjb21tYW5kLnBlbmRpbmcgPSBmYWxzZTtcclxuICAgICAgICBidFN0YXRlLmNvbW1hbmQgPSBudWxsO1xyXG5cclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuSURMRTtcclxuICAgICAgICBsb2cuZGVidWcoXCJcXHRcXHRDb21wbGV0ZWQgY29tbWFuZCBleGVjdXRlZFwiKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICBsb2cuZXJyb3IoXCIqKiBlcnJvciB3aGlsZSBleGVjdXRpbmcgY29tbWFuZDogXCIgKyBlcnIpO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5NRVRFUl9JTklUO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XHJcbiAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIG1vZGJ1cy5Nb2RidXNFcnJvcilcclxuICAgICAgICAgICAgYnRTdGF0ZS5zdGF0c1tcIm1vZGJ1c19lcnJvcnNcIl0rKztcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQWNxdWlyZSB0aGUgY3VycmVudCBtb2RlIGFuZCBzZXJpYWwgbnVtYmVyIG9mIHRoZSBkZXZpY2UuXHJcbiAqICovXHJcbmFzeW5jIGZ1bmN0aW9uIG1ldGVySW5pdCgpIHtcclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5JRExFO1xyXG59XHJcblxyXG4vKlxyXG4gKiBDbG9zZSB0aGUgYmx1ZXRvb3RoIGludGVyZmFjZSAodW5wYWlyKVxyXG4gKiAqL1xyXG5hc3luYyBmdW5jdGlvbiBkaXNjb25uZWN0KCkge1xyXG4gICAgYnRTdGF0ZS5jb21tYW5kID0gbnVsbDtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgaWYgKGJ0U3RhdGUuYnREZXZpY2UgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICBpZiAoYnRTdGF0ZS5idERldmljZT8uZ2F0dD8uY29ubmVjdGVkKSB7XHJcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIiogQ2FsbGluZyBkaXNjb25uZWN0IG9uIGJ0ZGV2aWNlXCIpO1xyXG4gICAgICAgICAgICAgICAgLy8gQXZvaWQgdGhlIGV2ZW50IGZpcmluZyB3aGljaCBtYXkgbGVhZCB0byBhdXRvLXJlY29ubmVjdFxyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5idERldmljZS5yZW1vdmVFdmVudExpc3RlbmVyKCdnYXR0c2VydmVyZGlzY29ubmVjdGVkJywgb25EaXNjb25uZWN0ZWQpO1xyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5idERldmljZS5nYXR0LmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBidFN0YXRlLmJ0U2VydmljZSA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBjYXRjaCB7IH1cclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xyXG59XHJcblxyXG4vKipcclxuICogRXZlbnQgY2FsbGVkIGJ5IGJyb3dzZXIgQlQgYXBpIHdoZW4gdGhlIGRldmljZSBkaXNjb25uZWN0XHJcbiAqICovXHJcbmFzeW5jIGZ1bmN0aW9uIG9uRGlzY29ubmVjdGVkKCkge1xyXG4gICAgbG9nLndhcm4oXCIqIEdBVFQgU2VydmVyIGRpc2Nvbm5lY3RlZCBldmVudCwgd2lsbCB0cnkgdG8gcmVjb25uZWN0ICpcIik7XHJcbiAgICBidFN0YXRlLmJ0U2VydmljZSA9IG51bGw7XHJcbiAgICBidFN0YXRlLnN0YXRzW1wiR0FUVCBkaXNjb25uZWN0c1wiXSsrO1xyXG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7IC8vIFRyeSB0byBhdXRvLXJlY29ubmVjdCB0aGUgaW50ZXJmYWNlcyB3aXRob3V0IHBhaXJpbmdcclxufVxyXG5cclxuLyoqXHJcbiAqIEpvaW5zIHRoZSBhcmd1bWVudHMgaW50byBhIHNpbmdsZSBidWZmZXJcclxuICogQHJldHVybnMge0J1ZmZlcn0gY29uY2F0ZW5hdGVkIGJ1ZmZlclxyXG4gKi9cclxuZnVuY3Rpb24gYXJyYXlCdWZmZXJDb25jYXQoKSB7XHJcbiAgICB2YXIgbGVuZ3RoID0gMDtcclxuICAgIHZhciBidWZmZXIgPSBudWxsO1xyXG5cclxuICAgIGZvciAodmFyIGkgaW4gYXJndW1lbnRzKSB7XHJcbiAgICAgICAgYnVmZmVyID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgIGxlbmd0aCArPSBidWZmZXIuYnl0ZUxlbmd0aDtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgam9pbmVkID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcclxuICAgIHZhciBvZmZzZXQgPSAwO1xyXG5cclxuICAgIGZvciAoaSBpbiBhcmd1bWVudHMpIHtcclxuICAgICAgICBidWZmZXIgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgam9pbmVkLnNldChuZXcgVWludDhBcnJheShidWZmZXIpLCBvZmZzZXQpO1xyXG4gICAgICAgIG9mZnNldCArPSBidWZmZXIuYnl0ZUxlbmd0aDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gam9pbmVkLmJ1ZmZlcjtcclxufVxyXG5cclxudmFyIGxhc3RUaW1lU3RhbXAgPSAwO1xyXG4vKipcclxuICogRXZlbnQgY2FsbGVkIGJ5IGJsdWV0b290aCBjaGFyYWN0ZXJpc3RpY3Mgd2hlbiByZWNlaXZpbmcgZGF0YVxyXG4gKiBAcGFyYW0ge2FueX0gZXZlbnRcclxuICovXHJcbmZ1bmN0aW9uIGhhbmRsZU5vdGlmaWNhdGlvbnMoZXZlbnQpIHtcclxuICAgIHZhciBkZWxheSA9IDA7XHJcbiAgICBsZXQgdmFsdWUgPSBldmVudC50YXJnZXQudmFsdWU7XHJcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xyXG4gICAgICAgIGxvZy5kZWJ1ZygnPDwgJyArIHV0aWxzLmJ1ZjJoZXgodmFsdWUuYnVmZmVyKSk7XHJcbiAgICAgICAgaWYgKGJ0U3RhdGUucmVzcG9uc2UgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICBidFN0YXRlLnJlc3BvbnNlID0gYXJyYXlCdWZmZXJDb25jYXQoYnRTdGF0ZS5yZXNwb25zZSwgdmFsdWUuYnVmZmVyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBidFN0YXRlLnJlc3BvbnNlID0gdmFsdWUuYnVmZmVyLnNsaWNlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIEtlZXAgdGhlIGV2ZW50IG9yaWdpbmFsIHRpbWVzdGFtcCAhIVxyXG4gICAgICAgIGJ0U3RhdGUucmVzcG9uc2VUaW1lU3RhbXAgPSBuZXcgRGF0ZShldmVudC50aW1lU3RhbXApO1xyXG4gICAgICAgIGlmIChsYXN0VGltZVN0YW1wID4gMCkge1xyXG4gICAgICAgICAgICBkZWxheSA9IGV2ZW50LnRpbWVTdGFtcCAtIGxhc3RUaW1lU3RhbXA7IC8vIG1zIGJldHdlZW4gbm90aWZpY2F0aW9uc1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGRlbGF5ID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgbGFzdFRpbWVTdGFtcCA9IGV2ZW50LnRpbWVTdGFtcDtcclxuXHJcbiAgICAgICAgcGFyc2VSZXNwb25zZShidFN0YXRlLnJlc3BvbnNlLCBidFN0YXRlLnJlc3BvbnNlVGltZVN0YW1wKTtcclxuXHJcbiAgICAgICAgLy8gTG9nIHRoZSBwYWNrZXRzXHJcbiAgICAgICAgaWYgKGxvZ2dpbmcpIHtcclxuICAgICAgICAgICAgdmFyIHBhY2tldCA9IHsgJ25vdGlmaWNhdGlvbic6IHV0aWxzLmJ1ZjJoZXgoYnRTdGF0ZS5yZXNwb25zZSksICdwYXJzZWQnOiBidFN0YXRlLnBhcnNlZFJlc3BvbnNlIH07XHJcbiAgICAgICAgICAgIHZhciBwYWNrZXRzID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiT3dvbkJUVHJhY2VcIik7XHJcbiAgICAgICAgICAgIGlmIChwYWNrZXRzID09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHBhY2tldHMgPSBbXTsgLy8gaW5pdGlhbGl6ZSBhcnJheVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcGFja2V0cyA9IEpTT04ucGFyc2UocGFja2V0cyk7IC8vIFJlc3RvcmUgdGhlIGpzb24gcGVyc2lzdGVkIG9iamVjdFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHBhY2tldHMucHVzaChwYWNrZXQpOyAvLyBBZGQgdGhlIG5ldyBvYmplY3RcclxuICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZS5zZXRJdGVtKFwiT3dvbkJUVHJhY2VcIiwgSlNPTi5zdHJpbmdpZnkocGFja2V0cykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoZGVsYXkgPiAwKSB7XHJcbiAgICAgICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJsYXN0UmVzcG9uc2VUaW1lXCJdID0gZGVsYXk7XHJcbiAgICAgICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJyZXNwb25zZVRpbWVcIl0gPSAoYnRTdGF0ZS5zdGF0c1tcInJlc3BvbnNlVGltZVwiXSAqIChidFN0YXRlLnN0YXRzW1wicmVzcG9uc2VzXCJdLTEuMCkgKyBkZWxheSkgLyBidFN0YXRlLnN0YXRzW1wicmVzcG9uc2VzXCJdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wicmVzcG9uc2VzXCJdKys7XHJcblxyXG4gICAgICAgIGJ0U3RhdGUucmVzcG9uc2UgPSBudWxsO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKiBPV09OICovXHJcblxyXG5jb25zdCBEQ1YgPSAweDA7XHJcbmNvbnN0IEFDViA9IDB4MTtcclxuY29uc3QgRENBID0gMHgyO1xyXG5jb25zdCBBQ0EgPSAweDM7XHJcbmNvbnN0IE9obSA9IDB4NDtcclxuY29uc3QgQ2FwID0gMHg1O1xyXG5jb25zdCBIeiA9IDB4NjtcclxuY29uc3QgRHV0eSA9IDB4NztcclxuY29uc3QgVGVtcEMgPSAweDg7XHJcbmNvbnN0IFRlbXBGID0gMHg5O1xyXG5jb25zdCBEaW9kZSA9IDB4QTtcclxuY29uc3QgQ29udGludWl0eSA9IDB4QjtcclxuY29uc3QgaEZFID0gMHhDO1xyXG5cclxuZnVuY3Rpb24gZm9ybWF0UGFyc2VkUmVzcG9uc2UoZnVuLCBtZWFzdXJlbWVudCwgc2NhbGUsIG92ZXJsb2FkKSB7XHJcbiAgICB2YXIgbWVhc3VyZSA9IFwiP1wiO1xyXG4gICAgdmFyIHVuaXRzID0gXCJcIjtcclxuXHJcbiAgICBzd2l0Y2ggKGZ1bikge1xyXG4gICAgICAgIGNhc2UgRENWOlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJWZGM9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJWXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQUNWOlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJWYWM9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJWXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRENBOlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJJZGM9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJBXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQUNBOlxyXG4gICAgICAgICAgICB1bml0cyA9IFwiSWFjPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiQVwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIE9obTpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiUj1cIjtcclxuICAgICAgICAgICAgdW5pdHMgPSBcIk9obXNcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBDYXA6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkM9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJGXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgSHo6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkZyZXF1ZW5jeT1cIjtcclxuICAgICAgICAgICAgdW5pdHMgPSBcIkh6XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRHV0eTpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiRHV0eT1cIjtcclxuICAgICAgICAgICAgdW5pdHMgPSBcIiVcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBUZW1wQzpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiVGVtcGVyYXR1cmU9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCLCsENcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBUZW1wRjpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiVGVtcGVyYXR1cmU9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJGXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRGlvZGU6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkRpb2RlPVwiO1xyXG4gICAgICAgICAgICB1bml0cyA9IFwiVlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIENvbnRpbnVpdHk6XHJcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkNvbnRpbnVpdHk9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJPaG1zXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgaEZFOlxyXG4gICAgICAgICAgICBtZWFzdXJlID0gXCJoRkU9XCI7XHJcbiAgICAgICAgICAgIHVuaXRzID0gXCJcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiPz1cIjtcclxuICAgICAgICAgICAgdW5pdHMgPSBcIj9cIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoIChzY2FsZSkge1xyXG4gICAgICAgIGNhc2UgMDpcclxuICAgICAgICAgICAgc2NhbGUgPSBcIlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgIHNjYWxlID0gXCJuXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMjpcclxuICAgICAgICAgICAgc2NhbGUgPSBcIm1pY3JvXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgc2NhbGUgPSBcIm1cIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSA0OlxyXG4gICAgICAgICAgICBzY2FsZSA9IFwiXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNTpcclxuICAgICAgICAgICAgc2NhbGUgPSBcImtpbG9cIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSA2OlxyXG4gICAgICAgICAgICBzY2FsZSA9IFwibWVnYVwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuICAgIGlmIChvdmVybG9hZCkge1xyXG4gICAgICAgIHJldHVybiBtZWFzdXJlICsgXCIgKipPVkVSTE9BRCoqIFwiICsgc2NhbGUgKyB1bml0cztcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJldHVybiBtZWFzdXJlICsgbWVhc3VyZW1lbnQgKyBcIiBcIiArIHNjYWxlICsgdW5pdHM7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlUmVzcG9uc2UoYnVmZmVyLCB0aW1lc3RhbXApIHtcclxuICAgIGxldCB2YWx1ZSA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xyXG4gICAgdmFyIG1lYXN1cmVtZW50ID0gTmFOO1xyXG5cclxuICAgIC8vIFNlZSBSRUFETUUubWQgb24gaHR0cHM6Ly9naXRodWIuY29tL0RlYW5Db3JkaW5nL293b25iMzVcclxuICAgIHZhciBmdW5jID0gKHZhbHVlLmdldFVpbnQxNigwLCB0cnVlKSA+PiA2KSAmIDB4MGY7XHJcbiAgICB2YXIgZGVjaW1hbCA9IHZhbHVlLmdldFVpbnQ4KDApICYgMHgwNztcclxuICAgIHZhciBzY2FsZSA9ICh2YWx1ZS5nZXRVaW50OCgwKSA+PiAzKSAmIDB4MDc7XHJcbiAgICB2YXIgdWludDE2dmFsID0gdmFsdWUuZ2V0VWludDgoNCkgKyAyNTYgKiB2YWx1ZS5nZXRVaW50OCg1KTtcclxuICAgIGlmICh1aW50MTZ2YWwgPCAweDdmZmYpIHtcclxuICAgICAgICBtZWFzdXJlbWVudCA9IHVpbnQxNnZhbCAvIE1hdGgucG93KDEwLjAsIGRlY2ltYWwpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBtZWFzdXJlbWVudCA9IC0xLjAgKiAodWludDE2dmFsICYgMHg3ZmZmKSAvIE1hdGgucG93KDEwLjAsIGRlY2ltYWwpO1xyXG4gICAgfVxyXG4gICAgdmFyIG92ZXJsb2FkID0gKGRlY2ltYWwgPT0gMHgwNyk7XHJcblxyXG4gICAgdmFyIG5vcm1hbGl6YXRpb24gPSAxLjA7XHJcbiAgICBzd2l0Y2ggKHNjYWxlKSB7XHJcbiAgICAgICAgY2FzZSAwOlxyXG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMS4wO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDE6XHJcbiAgICAgICAgICAgIG5vcm1hbGl6YXRpb24gPSAwLjAwMDAwMDAwMTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSAyOlxyXG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMC4wMDAwMDE7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgMzpcclxuICAgICAgICAgICAgbm9ybWFsaXphdGlvbiA9IDAuMDAxO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIDQ6XHJcbiAgICAgICAgICAgIG5vcm1hbGl6YXRpb24gPSAxLjA7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgNTpcclxuICAgICAgICAgICAgbm9ybWFsaXphdGlvbiA9IDEwMDAuMDtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSA2OlxyXG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMTAwMDAwMC4wO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxuICAgIHZhciBmdW5jdGlvbkRlc2MgPSAnJztcclxuICAgIHN3aXRjaCAoZnVuYykge1xyXG4gICAgICAgIGNhc2UgRENWOlxyXG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlZvbHRhZ2UgKERDKSAtIFZcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBBQ1Y6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiVm9sdGFnZSAoQUMpIC0gVlwiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIERDQTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJDdXJyZW50IChEQykgLSBBXCJcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBBQ0E6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiQ3VycmVudCAoQUMpIC0gQVwiXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgT2htOlxyXG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlJlc2lzdGFuY2UgLSBPaG1zXCJcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBDYXA6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiQ2FwYWNpdGFuY2UgLSBGXCJcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBIejpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJGcmVxdWVuY3kgLSBIelwiXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRHV0eTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJEdXR5IGN5Y2xlIC0gJVwiXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgVGVtcEM6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiVGVtcGVyYXR1cmUgLSDCsENcIlxyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFRlbXBGOlxyXG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlRlbXBlcmF0dXJlIC0gwrBGXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgRGlvZGU6XHJcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiRGlvZGUgLSBWXCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ29udGludWl0eTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJDb250aW51aXR5IC0gT2htc1wiO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIGhGRTpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJoRkVcIjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCI/XCI7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG5cclxuICAgIGJ0U3RhdGUucGFyc2VkUmVzcG9uc2UgPSB7XHJcbiAgICAgICAgXCJGdW5jdGlvblwiOiBmdW5jLFxyXG4gICAgICAgIFwiRnVuY3Rpb24gZGVzY3JpcHRpb25cIjogZnVuY3Rpb25EZXNjLFxyXG4gICAgICAgIFwiTWVhc3VyZW1lbnRcIjogbWVhc3VyZW1lbnQsXHJcbiAgICAgICAgXCJTY2FsZVwiOiBzY2FsZSxcclxuICAgICAgICBcIk92ZXJsb2FkXCI6IG92ZXJsb2FkLFxyXG4gICAgICAgIFwiVGltZXN0YW1wXCI6IHRpbWVzdGFtcCxcclxuICAgICAgICBcIlZhbHVlXCI6IG1lYXN1cmVtZW50ICogbm9ybWFsaXphdGlvbixcclxuICAgICAgICBcIkRhdGVUaW1lXCI6IG5ldyBEYXRlKCksXHJcbiAgICAgICAgXCJEZWNpbWFsXCI6IGRlY2ltYWxcclxuICAgIH07XHJcbiAgICBidFN0YXRlLmZvcm1hdHRlZFJlc3BvbnNlID0gZm9ybWF0UGFyc2VkUmVzcG9uc2UoZnVuYywgbWVhc3VyZW1lbnQsIHNjYWxlLCBvdmVybG9hZCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogVGhpcyBmdW5jdGlvbiB3aWxsIHN1Y2NlZWQgb25seSBpZiBjYWxsZWQgYXMgYSBjb25zZXF1ZW5jZSBvZiBhIHVzZXItZ2VzdHVyZVxyXG4gKiBFLmcuIGJ1dHRvbiBjbGljay4gVGhpcyBpcyBkdWUgdG8gQmx1ZVRvb3RoIEFQSSBzZWN1cml0eSBtb2RlbC5cclxuICogKi9cclxuYXN5bmMgZnVuY3Rpb24gYnRQYWlyRGV2aWNlKCkge1xyXG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkNPTk5FQ1RJTkc7XHJcbiAgICB2YXIgZm9yY2VTZWxlY3Rpb24gPSB0cnVlO1xyXG4gICAgbG9nLmRlYnVnKFwiYnRQYWlyRGV2aWNlKFwiICsgZm9yY2VTZWxlY3Rpb24gKyBcIilcIik7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgKG5hdmlnYXRvci5ibHVldG9vdGg/LmdldEF2YWlsYWJpbGl0eSkgPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBjb25zdCBhdmFpbGFiaWxpdHkgPSBhd2FpdCBuYXZpZ2F0b3IuYmx1ZXRvb3RoLmdldEF2YWlsYWJpbGl0eSgpO1xyXG4gICAgICAgICAgICBpZiAoIWF2YWlsYWJpbGl0eSkge1xyXG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiQmx1ZXRvb3RoIG5vdCBhdmFpbGFibGUgaW4gYnJvd3Nlci5cIik7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCcm93c2VyIGRvZXMgbm90IHByb3ZpZGUgYmx1ZXRvb3RoXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciBkZXZpY2UgPSBudWxsO1xyXG5cclxuICAgICAgICAvLyBJZiBub3QsIHJlcXVlc3QgZnJvbSB1c2VyXHJcbiAgICAgICAgaWYgKGRldmljZSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGRldmljZSA9IGF3YWl0IG5hdmlnYXRvci5ibHVldG9vdGhcclxuICAgICAgICAgICAgICAgIC5yZXF1ZXN0RGV2aWNlKHtcclxuICAgICAgICAgICAgICAgICAgICBhY2NlcHRBbGxEZXZpY2VzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbmFsU2VydmljZXM6IFtCbHVlVG9vdGhPV09OLlNlcnZpY2VVdWlkXVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJ0U3RhdGUuYnREZXZpY2UgPSBkZXZpY2U7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7XHJcbiAgICAgICAgbG9nLmluZm8oXCJCbHVldG9vdGggZGV2aWNlIFwiICsgZGV2aWNlLm5hbWUgKyBcIiBjb25uZWN0ZWQuXCIpO1xyXG4gICAgICAgIGF3YWl0IHV0aWxzLnNsZWVwKDUwMCk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgbG9nLndhcm4oXCIqKiBlcnJvciB3aGlsZSBjb25uZWN0aW5nOiBcIiArIGVyci5tZXNzYWdlKTtcclxuICAgICAgICBidFN0YXRlLmJ0U2VydmljZSA9IG51bGw7XHJcbiAgICAgICAgaWYgKGJ0U3RhdGUuY2hhclJlYWQgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZC5zdG9wTm90aWZpY2F0aW9ucygpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikgeyB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQgPSBudWxsO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wiZXhjZXB0aW9uc1wiXSsrO1xyXG4gICAgfVxyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBmYWtlUGFpckRldmljZSgpIHtcclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5DT05ORUNUSU5HO1xyXG4gICAgdmFyIGZvcmNlU2VsZWN0aW9uID0gdHJ1ZTtcclxuICAgIGxvZy5kZWJ1ZyhcImZha2VQYWlyRGV2aWNlKFwiICsgZm9yY2VTZWxlY3Rpb24gKyBcIilcIik7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHZhciBkZXZpY2UgPSB7IG5hbWU6IFwiRmFrZUJURGV2aWNlXCIsIGdhdHQ6IHsgY29ubmVjdGVkOiB0cnVlIH0gfTtcclxuICAgICAgICBidFN0YXRlLmJ0RGV2aWNlID0gZGV2aWNlO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEO1xyXG4gICAgICAgIGxvZy5pbmZvKFwiQmx1ZXRvb3RoIGRldmljZSBcIiArIGRldmljZS5uYW1lICsgXCIgY29ubmVjdGVkLlwiKTtcclxuICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCg1MCk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgbG9nLndhcm4oXCIqKiBlcnJvciB3aGlsZSBjb25uZWN0aW5nOiBcIiArIGVyci5tZXNzYWdlKTtcclxuICAgICAgICBidFN0YXRlLmJ0U2VydmljZSA9IG51bGw7XHJcbiAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZCA9IG51bGw7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPbmNlIHRoZSBkZXZpY2UgaXMgYXZhaWxhYmxlLCBpbml0aWFsaXplIHRoZSBzZXJ2aWNlIGFuZCB0aGUgMiBjaGFyYWN0ZXJpc3RpY3MgbmVlZGVkLlxyXG4gKiAqL1xyXG5hc3luYyBmdW5jdGlvbiBidFN1YnNjcmliZSgpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLlNVQlNDUklCSU5HO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJzdWJjcmliZXNcIl0rKztcclxuICAgICAgICBsZXQgZGV2aWNlID0gYnRTdGF0ZS5idERldmljZTtcclxuICAgICAgICBsZXQgc2VydmVyID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKCFkZXZpY2U/LmdhdHQ/LmNvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICBsb2cuZGVidWcoYENvbm5lY3RpbmcgdG8gR0FUVCBTZXJ2ZXIgb24gJHtkZXZpY2UubmFtZX0uLi5gKTtcclxuICAgICAgICAgICAgZGV2aWNlLmFkZEV2ZW50TGlzdGVuZXIoJ2dhdHRzZXJ2ZXJkaXNjb25uZWN0ZWQnLCBvbkRpc2Nvbm5lY3RlZCk7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYnRTdGF0ZS5idFNlcnZpY2U/LmNvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGJ0U3RhdGUuYnRTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcclxuICAgICAgICAgICAgICAgICAgICBidFN0YXRlLmJ0U2VydmljZSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdXRpbHMuc2xlZXAoMTAwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7IH1cclxuXHJcbiAgICAgICAgICAgIHNlcnZlciA9IGF3YWl0IGRldmljZS5nYXR0LmNvbm5lY3QoKTtcclxuICAgICAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIEdBVFQgc2VydmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBsb2cuZGVidWcoJ0dBVFQgYWxyZWFkeSBjb25uZWN0ZWQnKTtcclxuICAgICAgICAgICAgc2VydmVyID0gZGV2aWNlLmdhdHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBidFN0YXRlLmJ0U2VydmljZSA9IGF3YWl0IHNlcnZlci5nZXRQcmltYXJ5U2VydmljZShCbHVlVG9vdGhPV09OLlNlcnZpY2VVdWlkKTtcclxuICAgICAgICBpZiAoYnRTdGF0ZS5idFNlcnZpY2UgPT0gbnVsbClcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiR0FUVCBTZXJ2aWNlIHJlcXVlc3QgZmFpbGVkXCIpO1xyXG4gICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBPd29uIHNlcnZpY2UnKTtcclxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gYXdhaXQgYnRTdGF0ZS5idFNlcnZpY2UuZ2V0Q2hhcmFjdGVyaXN0aWMoQmx1ZVRvb3RoT1dPTi5Ob3RpZmljYXRpb25zVXVpZCk7XHJcbiAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIG5vdGlmaWNhdGlvbnMgY2hhcmFjdGVyaXN0aWMnKTtcclxuICAgICAgICBidFN0YXRlLnJlc3BvbnNlID0gbnVsbDtcclxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYXJhY3RlcmlzdGljdmFsdWVjaGFuZ2VkJywgaGFuZGxlTm90aWZpY2F0aW9ucyk7XHJcbiAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZC5zdGFydE5vdGlmaWNhdGlvbnMoKTtcclxuICAgICAgICBsb2cuaW5mbygnPiBCbHVldG9vdGggaW50ZXJmYWNlcyByZWFkeS4nKTtcclxuICAgICAgICBidFN0YXRlLnN0YXRzW1wibGFzdF9jb25uZWN0XCJdID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xyXG4gICAgICAgIGF3YWl0IHV0aWxzLnNsZWVwKDUwKTtcclxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuTUVURVJfSU5JVDtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnIpIHtcclxuICAgICAgICBsb2cud2FybihcIioqIGVycm9yIHdoaWxlIHN1YnNjcmliaW5nOiBcIiArIGVyci5tZXNzYWdlKTtcclxuICAgICAgICBpZiAoYnRTdGF0ZS5jaGFyUmVhZCAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoYnRTdGF0ZS5idERldmljZT8uZ2F0dD8uY29ubmVjdGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZC5zdG9wTm90aWZpY2F0aW9ucygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5idERldmljZT8uZ2F0dC5kaXNjb25uZWN0KCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IH1cclxuICAgICAgICB9XHJcbiAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZCA9IG51bGw7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0c1tcImV4Y2VwdGlvbnNcIl0rKztcclxuICAgIH1cclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmFrZVN1YnNjcmliZSgpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLlNVQlNDUklCSU5HO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJzdWJjcmliZXNcIl0rKztcclxuICAgICAgICBsZXQgZGV2aWNlID0gYnRTdGF0ZS5idERldmljZTtcclxuICAgICAgICBsZXQgc2VydmVyID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKCFkZXZpY2U/LmdhdHQ/LmNvbm5lY3RlZCkge1xyXG4gICAgICAgICAgICBsb2cuZGVidWcoYENvbm5lY3RpbmcgdG8gR0FUVCBTZXJ2ZXIgb24gJHtkZXZpY2UubmFtZX0uLi5gKTtcclxuICAgICAgICAgICAgZGV2aWNlWydnYXR0J11bJ2Nvbm5lY3RlZCddID0gdHJ1ZTtcclxuICAgICAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIEdBVFQgc2VydmVyJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBsb2cuZGVidWcoJ0dBVFQgYWxyZWFkeSBjb25uZWN0ZWQnKTtcclxuICAgICAgICAgICAgc2VydmVyID0gZGV2aWNlLmdhdHQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBidFN0YXRlLmJ0U2VydmljZSA9IHt9O1xyXG4gICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBTZXJpYWwgc2VydmljZScpO1xyXG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQgPSB7fTtcclxuICAgICAgICBsb2cuZGVidWcoJz4gRm91bmQgcmVhZCBjaGFyYWN0ZXJpc3RpYycpO1xyXG4gICAgICAgIGJ0U3RhdGUucmVzcG9uc2UgPSBudWxsO1xyXG4gICAgICAgIGxvZy5pbmZvKCc+IEJsdWV0b290aCBpbnRlcmZhY2VzIHJlYWR5LicpO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJsYXN0X2Nvbm5lY3RcIl0gPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgYXdhaXQgdXRpbHMuc2xlZXAoMTApO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5NRVRFUl9JTklUO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgc3Vic2NyaWJpbmc6IFwiICsgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQgPSBudWxsO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEO1xyXG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XHJcbiAgICB9XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogV2hlbiBpZGxlLCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZFxyXG4gKiAqL1xyXG5hc3luYyBmdW5jdGlvbiByZWZyZXNoKCkge1xyXG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkJVU1k7XHJcbiAgICAvLyBEbyBzb21ldGhpbmdcclxuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5JRExFO1xyXG59XHJcblxyXG5mdW5jdGlvbiBTZXRTaW11bGF0aW9uKHZhbHVlKSB7XHJcbiAgICBzaW11bGF0aW9uID0gdmFsdWU7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFbmFibGVzIG9yIGRpc2FibGUgd3JpdGluZyB0aGUgbm90aWZpY2F0aW9ucyBpbnRvIGEgbG9jYWwgc3RvcmFnZSBmaWxlXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gdmFsdWUgXHJcbiAqL1xyXG5mdW5jdGlvbiBTZXRQYWNrZXRMb2codmFsdWUpIHtcclxuICAgIGxvZ2dpbmcgPSB2YWx1ZTtcclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IHsgc3RhdGVNYWNoaW5lLCBTZXRTaW11bGF0aW9uLCBidFN0YXRlLCBTdGF0ZSwgU2V0UGFja2V0TG9nIH07Il19
