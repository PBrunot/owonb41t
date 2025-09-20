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

    var _loggersByName = {};
    var defaultLogger = null;

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

    function replaceLoggingMethods() {
        /*jshint validthis:true */
        var level = this.getLevel();

        // Replace the actual methods.
        for (var i = 0; i < logMethods.length; i++) {
            var methodName = logMethods[i];
            this[methodName] = (i < level) ?
                noop :
                this.methodFactory(methodName, level, this.name);
        }

        // Define log.log as an alias for log.debug
        this.log = this.debug;

        // Return any important warnings.
        if (typeof console === undefinedType && level < this.levels.SILENT) {
            return "No console available for logging";
        }
    }

    // In old IE versions, the console isn't present until you first open it.
    // We build realMethod() replacements here that regenerate logging methods
    function enableLoggingWhenConsoleArrives(methodName) {
        return function () {
            if (typeof console !== undefinedType) {
                replaceLoggingMethods.call(this);
                this[methodName].apply(this, arguments);
            }
        };
    }

    // By default, we use closely bound real methods wherever possible, and
    // otherwise we wait for a console to appear, and then try again.
    function defaultMethodFactory(methodName, _level, _loggerName) {
        /*jshint validthis:true */
        return realMethod(methodName) ||
               enableLoggingWhenConsoleArrives.apply(this, arguments);
    }

    function Logger(name, factory) {
      // Private instance variables.
      var self = this;
      /**
       * The level inherited from a parent logger (or a global default). We
       * cache this here rather than delegating to the parent so that it stays
       * in sync with the actual logging methods that we have installed (the
       * parent could change levels but we might not have rebuilt the loggers
       * in this child yet).
       * @type {number}
       */
      var inheritedLevel;
      /**
       * The default level for this logger, if any. If set, this overrides
       * `inheritedLevel`.
       * @type {number|null}
       */
      var defaultLevel;
      /**
       * A user-specific level for this logger. If set, this overrides
       * `defaultLevel`.
       * @type {number|null}
       */
      var userLevel;

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
                  var cookieName = encodeURIComponent(storageKey);
                  var location = cookie.indexOf(cookieName + "=");
                  if (location !== -1) {
                      storedLevel = /^([^;]+)/.exec(
                          cookie.slice(location + cookieName.length + 1)
                      )[1];
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
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
          } catch (ignore) {}
      }

      function normalizeLevel(input) {
          var level = input;
          if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
              level = self.levels[level.toUpperCase()];
          }
          if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
              return level;
          } else {
              throw new TypeError("log.setLevel() called with invalid level: " + input);
          }
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
          if (userLevel != null) {
            return userLevel;
          } else if (defaultLevel != null) {
            return defaultLevel;
          } else {
            return inheritedLevel;
          }
      };

      self.setLevel = function (level, persist) {
          userLevel = normalizeLevel(level);
          if (persist !== false) {  // defaults to true
              persistLevelIfPossible(userLevel);
          }

          // NOTE: in v2, this should call rebuild(), which updates children.
          return replaceLoggingMethods.call(self);
      };

      self.setDefaultLevel = function (level) {
          defaultLevel = normalizeLevel(level);
          if (!getPersistedLevel()) {
              self.setLevel(level, false);
          }
      };

      self.resetLevel = function () {
          userLevel = null;
          clearPersistedLevel();
          replaceLoggingMethods.call(self);
      };

      self.enableAll = function(persist) {
          self.setLevel(self.levels.TRACE, persist);
      };

      self.disableAll = function(persist) {
          self.setLevel(self.levels.SILENT, persist);
      };

      self.rebuild = function () {
          if (defaultLogger !== self) {
              inheritedLevel = normalizeLevel(defaultLogger.getLevel());
          }
          replaceLoggingMethods.call(self);

          if (defaultLogger === self) {
              for (var childName in _loggersByName) {
                _loggersByName[childName].rebuild();
              }
          }
      };

      // Initialize all the internal levels.
      inheritedLevel = normalizeLevel(
          defaultLogger ? defaultLogger.getLevel() : "WARN"
      );
      var initialLevel = getPersistedLevel();
      if (initialLevel != null) {
          userLevel = normalizeLevel(initialLevel);
      }
      replaceLoggingMethods.call(self);
    }

    /*
     *
     * Top-level API
     *
     */

    defaultLogger = new Logger();

    defaultLogger.getLogger = function getLogger(name) {
        if ((typeof name !== "symbol" && typeof name !== "string") || name === "") {
            throw new TypeError("You must supply a name when creating a logger.");
        }

        var logger = _loggersByName[name];
        if (!logger) {
            logger = _loggersByName[name] = new Logger(
                name,
                defaultLogger.methodFactory
            );
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbG9nbGV2ZWwvbGliL2xvZ2xldmVsLmpzIiwib3dvbi5qcyIsInV0aWxzLmpzIiwid2ViYmx1ZXRvb3RoLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qXG4qIGxvZ2xldmVsIC0gaHR0cHM6Ly9naXRodWIuY29tL3BpbXRlcnJ5L2xvZ2xldmVsXG4qXG4qIENvcHlyaWdodCAoYykgMjAxMyBUaW0gUGVycnlcbiogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuKi9cbihmdW5jdGlvbiAocm9vdCwgZGVmaW5pdGlvbikge1xuICAgIFwidXNlIHN0cmljdFwiO1xuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGRlZmluaXRpb24pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcm9vdC5sb2cgPSBkZWZpbml0aW9uKCk7XG4gICAgfVxufSh0aGlzLCBmdW5jdGlvbiAoKSB7XG4gICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAvLyBTbGlnaHRseSBkdWJpb3VzIHRyaWNrcyB0byBjdXQgZG93biBtaW5pbWl6ZWQgZmlsZSBzaXplXG4gICAgdmFyIG5vb3AgPSBmdW5jdGlvbigpIHt9O1xuICAgIHZhciB1bmRlZmluZWRUeXBlID0gXCJ1bmRlZmluZWRcIjtcbiAgICB2YXIgaXNJRSA9ICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlKSAmJiAodHlwZW9mIHdpbmRvdy5uYXZpZ2F0b3IgIT09IHVuZGVmaW5lZFR5cGUpICYmIChcbiAgICAgICAgL1RyaWRlbnRcXC98TVNJRSAvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpXG4gICAgKTtcblxuICAgIHZhciBsb2dNZXRob2RzID0gW1xuICAgICAgICBcInRyYWNlXCIsXG4gICAgICAgIFwiZGVidWdcIixcbiAgICAgICAgXCJpbmZvXCIsXG4gICAgICAgIFwid2FyblwiLFxuICAgICAgICBcImVycm9yXCJcbiAgICBdO1xuXG4gICAgdmFyIF9sb2dnZXJzQnlOYW1lID0ge307XG4gICAgdmFyIGRlZmF1bHRMb2dnZXIgPSBudWxsO1xuXG4gICAgLy8gQ3Jvc3MtYnJvd3NlciBiaW5kIGVxdWl2YWxlbnQgdGhhdCB3b3JrcyBhdCBsZWFzdCBiYWNrIHRvIElFNlxuICAgIGZ1bmN0aW9uIGJpbmRNZXRob2Qob2JqLCBtZXRob2ROYW1lKSB7XG4gICAgICAgIHZhciBtZXRob2QgPSBvYmpbbWV0aG9kTmFtZV07XG4gICAgICAgIGlmICh0eXBlb2YgbWV0aG9kLmJpbmQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXRob2QuYmluZChvYmopO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuY2FsbChtZXRob2QsIG9iaik7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgLy8gTWlzc2luZyBiaW5kIHNoaW0gb3IgSUU4ICsgTW9kZXJuaXpyLCBmYWxsYmFjayB0byB3cmFwcGluZ1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseS5hcHBseShtZXRob2QsIFtvYmosIGFyZ3VtZW50c10pO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUcmFjZSgpIGRvZXNuJ3QgcHJpbnQgdGhlIG1lc3NhZ2UgaW4gSUUsIHNvIGZvciB0aGF0IGNhc2Ugd2UgbmVlZCB0byB3cmFwIGl0XG4gICAgZnVuY3Rpb24gdHJhY2VGb3JJRSgpIHtcbiAgICAgICAgaWYgKGNvbnNvbGUubG9nKSB7XG4gICAgICAgICAgICBpZiAoY29uc29sZS5sb2cuYXBwbHkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBJbiBvbGQgSUUsIG5hdGl2ZSBjb25zb2xlIG1ldGhvZHMgdGhlbXNlbHZlcyBkb24ndCBoYXZlIGFwcGx5KCkuXG4gICAgICAgICAgICAgICAgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmFwcGx5KGNvbnNvbGUubG9nLCBbY29uc29sZSwgYXJndW1lbnRzXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnNvbGUudHJhY2UpIGNvbnNvbGUudHJhY2UoKTtcbiAgICB9XG5cbiAgICAvLyBCdWlsZCB0aGUgYmVzdCBsb2dnaW5nIG1ldGhvZCBwb3NzaWJsZSBmb3IgdGhpcyBlbnZcbiAgICAvLyBXaGVyZXZlciBwb3NzaWJsZSB3ZSB3YW50IHRvIGJpbmQsIG5vdCB3cmFwLCB0byBwcmVzZXJ2ZSBzdGFjayB0cmFjZXNcbiAgICBmdW5jdGlvbiByZWFsTWV0aG9kKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgaWYgKG1ldGhvZE5hbWUgPT09ICdkZWJ1ZycpIHtcbiAgICAgICAgICAgIG1ldGhvZE5hbWUgPSAnbG9nJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgY29uc29sZSA9PT0gdW5kZWZpbmVkVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBObyBtZXRob2QgcG9zc2libGUsIGZvciBub3cgLSBmaXhlZCBsYXRlciBieSBlbmFibGVMb2dnaW5nV2hlbkNvbnNvbGVBcnJpdmVzXG4gICAgICAgIH0gZWxzZSBpZiAobWV0aG9kTmFtZSA9PT0gJ3RyYWNlJyAmJiBpc0lFKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJhY2VGb3JJRTtcbiAgICAgICAgfSBlbHNlIGlmIChjb25zb2xlW21ldGhvZE5hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBiaW5kTWV0aG9kKGNvbnNvbGUsIG1ldGhvZE5hbWUpO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbnNvbGUubG9nICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBiaW5kTWV0aG9kKGNvbnNvbGUsICdsb2cnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBub29wO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVGhlc2UgcHJpdmF0ZSBmdW5jdGlvbnMgYWx3YXlzIG5lZWQgYHRoaXNgIHRvIGJlIHNldCBwcm9wZXJseVxuXG4gICAgZnVuY3Rpb24gcmVwbGFjZUxvZ2dpbmdNZXRob2RzKCkge1xuICAgICAgICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICAgICAgICB2YXIgbGV2ZWwgPSB0aGlzLmdldExldmVsKCk7XG5cbiAgICAgICAgLy8gUmVwbGFjZSB0aGUgYWN0dWFsIG1ldGhvZHMuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbG9nTWV0aG9kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIG1ldGhvZE5hbWUgPSBsb2dNZXRob2RzW2ldO1xuICAgICAgICAgICAgdGhpc1ttZXRob2ROYW1lXSA9IChpIDwgbGV2ZWwpID9cbiAgICAgICAgICAgICAgICBub29wIDpcbiAgICAgICAgICAgICAgICB0aGlzLm1ldGhvZEZhY3RvcnkobWV0aG9kTmFtZSwgbGV2ZWwsIHRoaXMubmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEZWZpbmUgbG9nLmxvZyBhcyBhbiBhbGlhcyBmb3IgbG9nLmRlYnVnXG4gICAgICAgIHRoaXMubG9nID0gdGhpcy5kZWJ1ZztcblxuICAgICAgICAvLyBSZXR1cm4gYW55IGltcG9ydGFudCB3YXJuaW5ncy5cbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlID09PSB1bmRlZmluZWRUeXBlICYmIGxldmVsIDwgdGhpcy5sZXZlbHMuU0lMRU5UKSB7XG4gICAgICAgICAgICByZXR1cm4gXCJObyBjb25zb2xlIGF2YWlsYWJsZSBmb3IgbG9nZ2luZ1wiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gSW4gb2xkIElFIHZlcnNpb25zLCB0aGUgY29uc29sZSBpc24ndCBwcmVzZW50IHVudGlsIHlvdSBmaXJzdCBvcGVuIGl0LlxuICAgIC8vIFdlIGJ1aWxkIHJlYWxNZXRob2QoKSByZXBsYWNlbWVudHMgaGVyZSB0aGF0IHJlZ2VuZXJhdGUgbG9nZ2luZyBtZXRob2RzXG4gICAgZnVuY3Rpb24gZW5hYmxlTG9nZ2luZ1doZW5Db25zb2xlQXJyaXZlcyhtZXRob2ROYW1lKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09IHVuZGVmaW5lZFR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMuY2FsbCh0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzW21ldGhvZE5hbWVdLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gQnkgZGVmYXVsdCwgd2UgdXNlIGNsb3NlbHkgYm91bmQgcmVhbCBtZXRob2RzIHdoZXJldmVyIHBvc3NpYmxlLCBhbmRcbiAgICAvLyBvdGhlcndpc2Ugd2Ugd2FpdCBmb3IgYSBjb25zb2xlIHRvIGFwcGVhciwgYW5kIHRoZW4gdHJ5IGFnYWluLlxuICAgIGZ1bmN0aW9uIGRlZmF1bHRNZXRob2RGYWN0b3J5KG1ldGhvZE5hbWUsIF9sZXZlbCwgX2xvZ2dlck5hbWUpIHtcbiAgICAgICAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgICAgICAgcmV0dXJuIHJlYWxNZXRob2QobWV0aG9kTmFtZSkgfHxcbiAgICAgICAgICAgICAgIGVuYWJsZUxvZ2dpbmdXaGVuQ29uc29sZUFycml2ZXMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBMb2dnZXIobmFtZSwgZmFjdG9yeSkge1xuICAgICAgLy8gUHJpdmF0ZSBpbnN0YW5jZSB2YXJpYWJsZXMuXG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAvKipcbiAgICAgICAqIFRoZSBsZXZlbCBpbmhlcml0ZWQgZnJvbSBhIHBhcmVudCBsb2dnZXIgKG9yIGEgZ2xvYmFsIGRlZmF1bHQpLiBXZVxuICAgICAgICogY2FjaGUgdGhpcyBoZXJlIHJhdGhlciB0aGFuIGRlbGVnYXRpbmcgdG8gdGhlIHBhcmVudCBzbyB0aGF0IGl0IHN0YXlzXG4gICAgICAgKiBpbiBzeW5jIHdpdGggdGhlIGFjdHVhbCBsb2dnaW5nIG1ldGhvZHMgdGhhdCB3ZSBoYXZlIGluc3RhbGxlZCAodGhlXG4gICAgICAgKiBwYXJlbnQgY291bGQgY2hhbmdlIGxldmVscyBidXQgd2UgbWlnaHQgbm90IGhhdmUgcmVidWlsdCB0aGUgbG9nZ2Vyc1xuICAgICAgICogaW4gdGhpcyBjaGlsZCB5ZXQpLlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgdmFyIGluaGVyaXRlZExldmVsO1xuICAgICAgLyoqXG4gICAgICAgKiBUaGUgZGVmYXVsdCBsZXZlbCBmb3IgdGhpcyBsb2dnZXIsIGlmIGFueS4gSWYgc2V0LCB0aGlzIG92ZXJyaWRlc1xuICAgICAgICogYGluaGVyaXRlZExldmVsYC5cbiAgICAgICAqIEB0eXBlIHtudW1iZXJ8bnVsbH1cbiAgICAgICAqL1xuICAgICAgdmFyIGRlZmF1bHRMZXZlbDtcbiAgICAgIC8qKlxuICAgICAgICogQSB1c2VyLXNwZWNpZmljIGxldmVsIGZvciB0aGlzIGxvZ2dlci4gSWYgc2V0LCB0aGlzIG92ZXJyaWRlc1xuICAgICAgICogYGRlZmF1bHRMZXZlbGAuXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfG51bGx9XG4gICAgICAgKi9cbiAgICAgIHZhciB1c2VyTGV2ZWw7XG5cbiAgICAgIHZhciBzdG9yYWdlS2V5ID0gXCJsb2dsZXZlbFwiO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHN0b3JhZ2VLZXkgKz0gXCI6XCIgKyBuYW1lO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmFtZSA9PT0gXCJzeW1ib2xcIikge1xuICAgICAgICBzdG9yYWdlS2V5ID0gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBwZXJzaXN0TGV2ZWxJZlBvc3NpYmxlKGxldmVsTnVtKSB7XG4gICAgICAgICAgdmFyIGxldmVsTmFtZSA9IChsb2dNZXRob2RzW2xldmVsTnVtXSB8fCAnc2lsZW50JykudG9VcHBlckNhc2UoKTtcblxuICAgICAgICAgIGlmICh0eXBlb2Ygd2luZG93ID09PSB1bmRlZmluZWRUeXBlIHx8ICFzdG9yYWdlS2V5KSByZXR1cm47XG5cbiAgICAgICAgICAvLyBVc2UgbG9jYWxTdG9yYWdlIGlmIGF2YWlsYWJsZVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2Vbc3RvcmFnZUtleV0gPSBsZXZlbE5hbWU7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG5cbiAgICAgICAgICAvLyBVc2Ugc2Vzc2lvbiBjb29raWUgYXMgZmFsbGJhY2tcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICB3aW5kb3cuZG9jdW1lbnQuY29va2llID1cbiAgICAgICAgICAgICAgICBlbmNvZGVVUklDb21wb25lbnQoc3RvcmFnZUtleSkgKyBcIj1cIiArIGxldmVsTmFtZSArIFwiO1wiO1xuICAgICAgICAgIH0gY2F0Y2ggKGlnbm9yZSkge31cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZ2V0UGVyc2lzdGVkTGV2ZWwoKSB7XG4gICAgICAgICAgdmFyIHN0b3JlZExldmVsO1xuXG4gICAgICAgICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09IHVuZGVmaW5lZFR5cGUgfHwgIXN0b3JhZ2VLZXkpIHJldHVybjtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHN0b3JlZExldmVsID0gd2luZG93LmxvY2FsU3RvcmFnZVtzdG9yYWdlS2V5XTtcbiAgICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG5cbiAgICAgICAgICAvLyBGYWxsYmFjayB0byBjb29raWVzIGlmIGxvY2FsIHN0b3JhZ2UgZ2l2ZXMgdXMgbm90aGluZ1xuICAgICAgICAgIGlmICh0eXBlb2Ygc3RvcmVkTGV2ZWwgPT09IHVuZGVmaW5lZFR5cGUpIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIHZhciBjb29raWUgPSB3aW5kb3cuZG9jdW1lbnQuY29va2llO1xuICAgICAgICAgICAgICAgICAgdmFyIGNvb2tpZU5hbWUgPSBlbmNvZGVVUklDb21wb25lbnQoc3RvcmFnZUtleSk7XG4gICAgICAgICAgICAgICAgICB2YXIgbG9jYXRpb24gPSBjb29raWUuaW5kZXhPZihjb29raWVOYW1lICsgXCI9XCIpO1xuICAgICAgICAgICAgICAgICAgaWYgKGxvY2F0aW9uICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gL14oW147XSspLy5leGVjKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb29raWUuc2xpY2UobG9jYXRpb24gKyBjb29raWVOYW1lLmxlbmd0aCArIDEpXG4gICAgICAgICAgICAgICAgICAgICAgKVsxXTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIElmIHRoZSBzdG9yZWQgbGV2ZWwgaXMgbm90IHZhbGlkLCB0cmVhdCBpdCBhcyBpZiBub3RoaW5nIHdhcyBzdG9yZWQuXG4gICAgICAgICAgaWYgKHNlbGYubGV2ZWxzW3N0b3JlZExldmVsXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHN0b3JlZExldmVsID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBzdG9yZWRMZXZlbDtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gY2xlYXJQZXJzaXN0ZWRMZXZlbCgpIHtcbiAgICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gdW5kZWZpbmVkVHlwZSB8fCAhc3RvcmFnZUtleSkgcmV0dXJuO1xuXG4gICAgICAgICAgLy8gVXNlIGxvY2FsU3RvcmFnZSBpZiBhdmFpbGFibGVcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oc3RvcmFnZUtleSk7XG4gICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuXG4gICAgICAgICAgLy8gVXNlIHNlc3Npb24gY29va2llIGFzIGZhbGxiYWNrXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd2luZG93LmRvY3VtZW50LmNvb2tpZSA9XG4gICAgICAgICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KHN0b3JhZ2VLZXkpICsgXCI9OyBleHBpcmVzPVRodSwgMDEgSmFuIDE5NzAgMDA6MDA6MDAgVVRDXCI7XG4gICAgICAgICAgfSBjYXRjaCAoaWdub3JlKSB7fVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBub3JtYWxpemVMZXZlbChpbnB1dCkge1xuICAgICAgICAgIHZhciBsZXZlbCA9IGlucHV0O1xuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWwgPT09IFwic3RyaW5nXCIgJiYgc2VsZi5sZXZlbHNbbGV2ZWwudG9VcHBlckNhc2UoKV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBsZXZlbCA9IHNlbGYubGV2ZWxzW2xldmVsLnRvVXBwZXJDYXNlKCldO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodHlwZW9mIGxldmVsID09PSBcIm51bWJlclwiICYmIGxldmVsID49IDAgJiYgbGV2ZWwgPD0gc2VsZi5sZXZlbHMuU0lMRU5UKSB7XG4gICAgICAgICAgICAgIHJldHVybiBsZXZlbDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwibG9nLnNldExldmVsKCkgY2FsbGVkIHdpdGggaW52YWxpZCBsZXZlbDogXCIgKyBpbnB1dCk7XG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvKlxuICAgICAgICpcbiAgICAgICAqIFB1YmxpYyBsb2dnZXIgQVBJIC0gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9waW10ZXJyeS9sb2dsZXZlbCBmb3IgZGV0YWlsc1xuICAgICAgICpcbiAgICAgICAqL1xuXG4gICAgICBzZWxmLm5hbWUgPSBuYW1lO1xuXG4gICAgICBzZWxmLmxldmVscyA9IHsgXCJUUkFDRVwiOiAwLCBcIkRFQlVHXCI6IDEsIFwiSU5GT1wiOiAyLCBcIldBUk5cIjogMyxcbiAgICAgICAgICBcIkVSUk9SXCI6IDQsIFwiU0lMRU5UXCI6IDV9O1xuXG4gICAgICBzZWxmLm1ldGhvZEZhY3RvcnkgPSBmYWN0b3J5IHx8IGRlZmF1bHRNZXRob2RGYWN0b3J5O1xuXG4gICAgICBzZWxmLmdldExldmVsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmICh1c2VyTGV2ZWwgIT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHVzZXJMZXZlbDtcbiAgICAgICAgICB9IGVsc2UgaWYgKGRlZmF1bHRMZXZlbCAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdExldmVsO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gaW5oZXJpdGVkTGV2ZWw7XG4gICAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgc2VsZi5zZXRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCwgcGVyc2lzdCkge1xuICAgICAgICAgIHVzZXJMZXZlbCA9IG5vcm1hbGl6ZUxldmVsKGxldmVsKTtcbiAgICAgICAgICBpZiAocGVyc2lzdCAhPT0gZmFsc2UpIHsgIC8vIGRlZmF1bHRzIHRvIHRydWVcbiAgICAgICAgICAgICAgcGVyc2lzdExldmVsSWZQb3NzaWJsZSh1c2VyTGV2ZWwpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE5PVEU6IGluIHYyLCB0aGlzIHNob3VsZCBjYWxsIHJlYnVpbGQoKSwgd2hpY2ggdXBkYXRlcyBjaGlsZHJlbi5cbiAgICAgICAgICByZXR1cm4gcmVwbGFjZUxvZ2dpbmdNZXRob2RzLmNhbGwoc2VsZik7XG4gICAgICB9O1xuXG4gICAgICBzZWxmLnNldERlZmF1bHRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCkge1xuICAgICAgICAgIGRlZmF1bHRMZXZlbCA9IG5vcm1hbGl6ZUxldmVsKGxldmVsKTtcbiAgICAgICAgICBpZiAoIWdldFBlcnNpc3RlZExldmVsKCkpIHtcbiAgICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChsZXZlbCwgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHNlbGYucmVzZXRMZXZlbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB1c2VyTGV2ZWwgPSBudWxsO1xuICAgICAgICAgIGNsZWFyUGVyc2lzdGVkTGV2ZWwoKTtcbiAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMuY2FsbChzZWxmKTtcbiAgICAgIH07XG5cbiAgICAgIHNlbGYuZW5hYmxlQWxsID0gZnVuY3Rpb24ocGVyc2lzdCkge1xuICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHMuVFJBQ0UsIHBlcnNpc3QpO1xuICAgICAgfTtcblxuICAgICAgc2VsZi5kaXNhYmxlQWxsID0gZnVuY3Rpb24ocGVyc2lzdCkge1xuICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHMuU0lMRU5ULCBwZXJzaXN0KTtcbiAgICAgIH07XG5cbiAgICAgIHNlbGYucmVidWlsZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoZGVmYXVsdExvZ2dlciAhPT0gc2VsZikge1xuICAgICAgICAgICAgICBpbmhlcml0ZWRMZXZlbCA9IG5vcm1hbGl6ZUxldmVsKGRlZmF1bHRMb2dnZXIuZ2V0TGV2ZWwoKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlcGxhY2VMb2dnaW5nTWV0aG9kcy5jYWxsKHNlbGYpO1xuXG4gICAgICAgICAgaWYgKGRlZmF1bHRMb2dnZXIgPT09IHNlbGYpIHtcbiAgICAgICAgICAgICAgZm9yICh2YXIgY2hpbGROYW1lIGluIF9sb2dnZXJzQnlOYW1lKSB7XG4gICAgICAgICAgICAgICAgX2xvZ2dlcnNCeU5hbWVbY2hpbGROYW1lXS5yZWJ1aWxkKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBJbml0aWFsaXplIGFsbCB0aGUgaW50ZXJuYWwgbGV2ZWxzLlxuICAgICAgaW5oZXJpdGVkTGV2ZWwgPSBub3JtYWxpemVMZXZlbChcbiAgICAgICAgICBkZWZhdWx0TG9nZ2VyID8gZGVmYXVsdExvZ2dlci5nZXRMZXZlbCgpIDogXCJXQVJOXCJcbiAgICAgICk7XG4gICAgICB2YXIgaW5pdGlhbExldmVsID0gZ2V0UGVyc2lzdGVkTGV2ZWwoKTtcbiAgICAgIGlmIChpbml0aWFsTGV2ZWwgIT0gbnVsbCkge1xuICAgICAgICAgIHVzZXJMZXZlbCA9IG5vcm1hbGl6ZUxldmVsKGluaXRpYWxMZXZlbCk7XG4gICAgICB9XG4gICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMuY2FsbChzZWxmKTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqXG4gICAgICogVG9wLWxldmVsIEFQSVxuICAgICAqXG4gICAgICovXG5cbiAgICBkZWZhdWx0TG9nZ2VyID0gbmV3IExvZ2dlcigpO1xuXG4gICAgZGVmYXVsdExvZ2dlci5nZXRMb2dnZXIgPSBmdW5jdGlvbiBnZXRMb2dnZXIobmFtZSkge1xuICAgICAgICBpZiAoKHR5cGVvZiBuYW1lICE9PSBcInN5bWJvbFwiICYmIHR5cGVvZiBuYW1lICE9PSBcInN0cmluZ1wiKSB8fCBuYW1lID09PSBcIlwiKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiWW91IG11c3Qgc3VwcGx5IGEgbmFtZSB3aGVuIGNyZWF0aW5nIGEgbG9nZ2VyLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsb2dnZXIgPSBfbG9nZ2Vyc0J5TmFtZVtuYW1lXTtcbiAgICAgICAgaWYgKCFsb2dnZXIpIHtcbiAgICAgICAgICAgIGxvZ2dlciA9IF9sb2dnZXJzQnlOYW1lW25hbWVdID0gbmV3IExvZ2dlcihcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIGRlZmF1bHRMb2dnZXIubWV0aG9kRmFjdG9yeVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbG9nZ2VyO1xuICAgIH07XG5cbiAgICAvLyBHcmFiIHRoZSBjdXJyZW50IGdsb2JhbCBsb2cgdmFyaWFibGUgaW4gY2FzZSBvZiBvdmVyd3JpdGVcbiAgICB2YXIgX2xvZyA9ICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlKSA/IHdpbmRvdy5sb2cgOiB1bmRlZmluZWQ7XG4gICAgZGVmYXVsdExvZ2dlci5ub0NvbmZsaWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlICYmXG4gICAgICAgICAgICAgICB3aW5kb3cubG9nID09PSBkZWZhdWx0TG9nZ2VyKSB7XG4gICAgICAgICAgICB3aW5kb3cubG9nID0gX2xvZztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWZhdWx0TG9nZ2VyO1xuICAgIH07XG5cbiAgICBkZWZhdWx0TG9nZ2VyLmdldExvZ2dlcnMgPSBmdW5jdGlvbiBnZXRMb2dnZXJzKCkge1xuICAgICAgICByZXR1cm4gX2xvZ2dlcnNCeU5hbWU7XG4gICAgfTtcblxuICAgIC8vIEVTNiBkZWZhdWx0IGV4cG9ydCwgZm9yIGNvbXBhdGliaWxpdHlcbiAgICBkZWZhdWx0TG9nZ2VyWydkZWZhdWx0J10gPSBkZWZhdWx0TG9nZ2VyO1xuXG4gICAgcmV0dXJuIGRlZmF1bHRMb2dnZXI7XG59KSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmNvbnN0IGxvZyA9IHJlcXVpcmUoXCJsb2dsZXZlbFwiKTtcbmNvbnN0IEJUID0gcmVxdWlyZShcIi4vd2ViYmx1ZXRvb3RoXCIpO1xuY29uc3QgdXRpbHMgPSByZXF1aXJlKFwiLi91dGlsc1wiKTtcbmNvbnN0IFN0YXRlID0gQlQuU3RhdGU7XG5jb25zdCBidFN0YXRlID0gQlQuYnRTdGF0ZTtcblxuYXN5bmMgZnVuY3Rpb24gU3RhcnQoKSB7XG4gICAgbG9nLmluZm8oXCJTdGFydCBjYWxsZWQuLi5cIik7XG5cbiAgICBpZiAoIWJ0U3RhdGUuc3RhcnRlZCkge1xuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuTk9UX0NPTk5FQ1RFRDtcbiAgICAgICAgQlQuc3RhdGVNYWNoaW5lKCk7IC8vIFN0YXJ0IGl0XG4gICAgfVxuICAgIGVsc2UgaWYgKGJ0U3RhdGUuc3RhdGUgPT0gU3RhdGUuRVJST1IpIHtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLk5PVF9DT05ORUNURUQ7IC8vIFRyeSB0byByZXN0YXJ0XG4gICAgfVxuICAgIGF3YWl0IHV0aWxzLndhaXRGb3IoKCkgPT4gYnRTdGF0ZS5zdGF0ZSA9PSBTdGF0ZS5JRExFIHx8IGJ0U3RhdGUuc3RhdGUgPT0gU3RhdGUuU1RPUFBFRCk7XG4gICAgbG9nLmluZm8oXCJQYWlyaW5nIGNvbXBsZXRlZCwgc3RhdGUgOlwiLCBidFN0YXRlLnN0YXRlKTtcbiAgICByZXR1cm4gKGJ0U3RhdGUuc3RhdGUgIT0gU3RhdGUuU1RPUFBFRCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIFN0b3AoKSB7XG4gICAgbG9nLmluZm8oXCJTdG9wIHJlcXVlc3QgcmVjZWl2ZWRcIik7XG5cbiAgICBidFN0YXRlLnN0b3BSZXF1ZXN0ID0gdHJ1ZTtcbiAgICBhd2FpdCB1dGlscy5zbGVlcCgxMDApO1xuXG4gICAgd2hpbGUoYnRTdGF0ZS5zdGFydGVkIHx8IChidFN0YXRlLnN0YXRlICE9IFN0YXRlLlNUT1BQRUQgJiYgYnRTdGF0ZS5zdGF0ZSAhPSBTdGF0ZS5OT1RfQ09OTkVDVEVEKSlcbiAgICB7XG4gICAgICAgIGJ0U3RhdGUuc3RvcFJlcXVlc3QgPSB0cnVlOyAgICBcbiAgICAgICAgYXdhaXQgdXRpbHMuc2xlZXAoMTAwKTtcbiAgICB9XG4gICAgYnRTdGF0ZS5jb21tYW5kID0gbnVsbDtcbiAgICBidFN0YXRlLnN0b3BSZXF1ZXN0ID0gZmFsc2U7XG4gICAgbG9nLndhcm4oXCJTdG9wcGVkIG9uIHJlcXVlc3QuXCIpO1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBTZXRMb2dMZXZlbChsZXZlbCkge1xuICAgIGxvZy5zZXRMZXZlbChsZXZlbCwgZmFsc2UpO1xufVxuXG5leHBvcnRzLlN0YXJ0ID0gU3RhcnQ7XG5leHBvcnRzLlN0b3AgPSBTdG9wO1xuZXhwb3J0cy5TZXRMb2dMZXZlbCA9IFNldExvZ0xldmVsO1xuZXhwb3J0cy5idFN0YXRlID0gQlQuYnRTdGF0ZTtcbmV4cG9ydHMuU3RhdGUgPSBCVC5TdGF0ZTtcbmV4cG9ydHMuU2V0UGFja2V0TG9nID0gQlQuU2V0UGFja2V0TG9nOyIsIid1c2Ugc3RyaWN0JztcblxubGV0IHNsZWVwID0gbXMgPT4gbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIG1zKSk7XG5sZXQgd2FpdEZvciA9IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3IoZikge1xuICAgIHdoaWxlICghZigpKSBhd2FpdCBzbGVlcCgxMDAgKyBNYXRoLnJhbmRvbSgpICogMjUpO1xuICAgIHJldHVybiBmKCk7XG59O1xuXG5sZXQgd2FpdEZvclRpbWVvdXQgPSBhc3luYyBmdW5jdGlvbiB3YWl0Rm9yKGYsIHRpbWVvdXRTZWMpIHtcbiAgICB2YXIgdG90YWxUaW1lTXMgPSAwO1xuICAgIHdoaWxlICghZigpICYmIHRvdGFsVGltZU1zIDwgdGltZW91dFNlYyAqIDEwMDApIHtcbiAgICAgICAgdmFyIGRlbGF5TXMgPSAxMDAgKyBNYXRoLnJhbmRvbSgpICogMjU7XG4gICAgICAgIHRvdGFsVGltZU1zICs9IGRlbGF5TXM7XG4gICAgICAgIGF3YWl0IHNsZWVwKGRlbGF5TXMpO1xuICAgIH1cbiAgICByZXR1cm4gZigpO1xufTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gY29udmVydCBhIHZhbHVlIGludG8gYW4gZW51bSB2YWx1ZVxuICogXG4gKiBAcGFyYW0ge3R5cGV9IGVudW10eXBlXG4gKiBAcGFyYW0ge251bWJlcn0gZW51bXZhbHVlXG4gKi9cbiBmdW5jdGlvbiBQYXJzZShlbnVtdHlwZSwgZW51bXZhbHVlKSB7XG4gICAgZm9yICh2YXIgZW51bU5hbWUgaW4gZW51bXR5cGUpIHtcbiAgICAgICAgaWYgKGVudW10eXBlW2VudW1OYW1lXSA9PSBlbnVtdmFsdWUpIHtcbiAgICAgICAgICAgIC8qanNoaW50IC1XMDYxICovXG4gICAgICAgICAgICByZXR1cm4gZXZhbChbZW51bXR5cGUgKyBcIi5cIiArIGVudW1OYW1lXSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogSGVscGVyIGZ1bmN0aW9uIHRvIGR1bXAgYXJyYXlidWZmZXIgYXMgaGV4IHN0cmluZ1xuICogQHBhcmFtIHtBcnJheUJ1ZmZlcn0gYnVmZmVyXG4gKi9cbiBmdW5jdGlvbiBidWYyaGV4KGJ1ZmZlcikgeyAvLyBidWZmZXIgaXMgYW4gQXJyYXlCdWZmZXJcbiAgICByZXR1cm4gWy4uLm5ldyBVaW50OEFycmF5KGJ1ZmZlcildXG4gICAgICAgIC5tYXAoeCA9PiB4LnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpKVxuICAgICAgICAuam9pbignICcpO1xufVxuXG5mdW5jdGlvbiBoZXgyYnVmIChpbnB1dCkge1xuICAgIGlmICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGlucHV0IHRvIGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgdmFyIGhleHN0ciA9IGlucHV0LnJlcGxhY2UoL1xccysvZywgJycpO1xuICAgIGlmICgoaGV4c3RyLmxlbmd0aCAlIDIpICE9PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdFeHBlY3RlZCBzdHJpbmcgdG8gYmUgYW4gZXZlbiBudW1iZXIgb2YgY2hhcmFjdGVycycpXG4gICAgfVxuXG4gICAgY29uc3QgdmlldyA9IG5ldyBVaW50OEFycmF5KGhleHN0ci5sZW5ndGggLyAyKVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBoZXhzdHIubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgdmlld1tpIC8gMl0gPSBwYXJzZUludChoZXhzdHIuc3Vic3RyaW5nKGksIGkgKyAyKSwgMTYpXG4gICAgfVxuXG4gICAgcmV0dXJuIHZpZXcuYnVmZmVyXG59XG5cbm1vZHVsZS5leHBvcnRzID0geyBzbGVlcCwgd2FpdEZvciwgd2FpdEZvclRpbWVvdXQsIFBhcnNlLCBidWYyaGV4LCBoZXgyYnVmIH07IiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqICBCbHVldG9vdGggaGFuZGxpbmcgbW9kdWxlLCBpbmNsdWRpbmcgbWFpbiBzdGF0ZSBtYWNoaW5lIGxvb3AuXG4gKiAgVGhpcyBtb2R1bGUgaW50ZXJhY3RzIHdpdGggYnJvd3NlciBmb3IgYmx1ZXRvb3RoIGNvbXVuaWNhdGlvbnMgYW5kIHBhaXJpbmcsIGFuZCB3aXRoIFNlbmVjYU1TQyBvYmplY3QuXG4gKi9cblxuY29uc3QgbG9nID0gcmVxdWlyZSgnbG9nbGV2ZWwnKTtcbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG52YXIgc2ltdWxhdGlvbiA9IGZhbHNlO1xudmFyIGxvZ2dpbmcgPSBmYWxzZTtcblxuLypcbiAqIEJsdWV0b290aCBjb25zdGFudHNcbiAqL1xuY29uc3QgQmx1ZVRvb3RoT1dPTiA9IHtcbiAgICBTZXJ2aWNlVXVpZDogJzAwMDBmZmYwLTAwMDAtMTAwMC04MDAwLTAwODA1ZjliMzRmYicsIC8vIGJsdWV0b290aCBzZXJ2aWNlIGZvciBPd29uIEI0MVQrXG4gICAgTm90aWZpY2F0aW9uc1V1aWQ6ICcwMDAwZmZmNC0wMDAwLTEwMDAtODAwMC0wMDgwNWY5YjM0ZmInLFxufTtcblxuLypcbiAqIEludGVybmFsIHN0YXRlIG1hY2hpbmUgZGVzY3JpcHRpb25zXG4gKi9cbmNvbnN0IFN0YXRlID0ge1xuICAgIE5PVF9DT05ORUNURUQ6ICdOb3QgY29ubmVjdGVkJyxcbiAgICBDT05ORUNUSU5HOiAnQmx1ZXRvb3RoIGRldmljZSBwYWlyaW5nLi4uJyxcbiAgICBERVZJQ0VfUEFJUkVEOiAnRGV2aWNlIHBhaXJlZCcsXG4gICAgU1VCU0NSSUJJTkc6ICdCbHVldG9vdGggaW50ZXJmYWNlcyBjb25uZWN0aW5nLi4uJyxcbiAgICBJRExFOiAnSWRsZScsXG4gICAgQlVTWTogJ0J1c3knLFxuICAgIEVSUk9SOiAnRXJyb3InLFxuICAgIFNUT1BQSU5HOiAnQ2xvc2luZyBCVCBpbnRlcmZhY2VzLi4uJyxcbiAgICBTVE9QUEVEOiAnU3RvcHBlZCcsXG4gICAgTUVURVJfSU5JVDogJ01ldGVyIGNvbm5lY3RlZCcsXG4gICAgTUVURVJfSU5JVElBTElaSU5HOiAnUmVhZGluZyBtZXRlciBzdGF0ZS4uLidcbn07XG5cbmNsYXNzIEFQSVN0YXRlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLk5PVF9DT05ORUNURUQ7XG4gICAgICAgIHRoaXMucHJldl9zdGF0ZSA9IFN0YXRlLk5PVF9DT05ORUNURUQ7XG4gICAgICAgIHRoaXMuc3RhdGVfY3B0ID0gMDtcblxuICAgICAgICB0aGlzLnN0YXJ0ZWQgPSBmYWxzZTsgLy8gU3RhdGUgbWFjaGluZSBzdGF0dXNcbiAgICAgICAgdGhpcy5zdG9wUmVxdWVzdCA9IGZhbHNlOyAvLyBUbyByZXF1ZXN0IGRpc2Nvbm5lY3RcblxuXG4gICAgICAgIC8vIGxhc3Qgbm90aWZpY2F0aW9uXG4gICAgICAgIHRoaXMucmVzcG9uc2UgPSBudWxsO1xuICAgICAgICB0aGlzLnJlc3BvbnNlVGltZVN0YW1wID0gbmV3IERhdGUoKTtcbiAgICAgICAgdGhpcy5wYXJzZWRSZXNwb25zZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZm9ybWF0dGVkUmVzcG9uc2UgPSAnJztcblxuICAgICAgICAvLyBibHVldG9vdGggcHJvcGVydGllc1xuICAgICAgICB0aGlzLmNoYXJSZWFkID0gbnVsbDtcbiAgICAgICAgdGhpcy5idFNlcnZpY2UgPSBudWxsO1xuICAgICAgICB0aGlzLmJ0RGV2aWNlID0gbnVsbDtcblxuICAgICAgICAvLyBnZW5lcmFsIHN0YXRpc3RpY3MgZm9yIGRlYnVnZ2luZ1xuICAgICAgICB0aGlzLnN0YXRzID0ge1xuICAgICAgICAgICAgXCJyZXF1ZXN0c1wiOiAwLFxuICAgICAgICAgICAgXCJyZXNwb25zZXNcIjogMCxcbiAgICAgICAgICAgIFwibW9kYnVzX2Vycm9yc1wiOiAwLFxuICAgICAgICAgICAgXCJHQVRUIGRpc2Nvbm5lY3RzXCI6IDAsXG4gICAgICAgICAgICBcImV4Y2VwdGlvbnNcIjogMCxcbiAgICAgICAgICAgIFwic3ViY3JpYmVzXCI6IDAsXG4gICAgICAgICAgICBcImNvbW1hbmRzXCI6IDAsXG4gICAgICAgICAgICBcInJlc3BvbnNlVGltZVwiOiAwLjAsXG4gICAgICAgICAgICBcImxhc3RSZXNwb25zZVRpbWVcIjogMC4wLFxuICAgICAgICAgICAgXCJsYXN0X2Nvbm5lY3RcIjogbmV3IERhdGUoMjAyMCwgMSwgMSkudG9JU09TdHJpbmcoKVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IHtcbiAgICAgICAgICAgIFwiZm9yY2VEZXZpY2VTZWxlY3Rpb25cIjogdHJ1ZVxuICAgICAgICB9XG4gICAgfVxufVxuXG5sZXQgYnRTdGF0ZSA9IG5ldyBBUElTdGF0ZSgpO1xuXG4vKipcbiAqIE1haW4gbG9vcCBvZiB0aGUgbWV0ZXIgaGFuZGxlci5cbiAqICovXG5hc3luYyBmdW5jdGlvbiBzdGF0ZU1hY2hpbmUoKSB7XG4gICAgdmFyIG5leHRBY3Rpb247XG4gICAgdmFyIERFTEFZX01TID0gKHNpbXVsYXRpb24gPyAyMCA6IDQ1MCk7IC8vIFVwZGF0ZSB0aGUgc3RhdHVzIGV2ZXJ5IFggbXMuXG4gICAgdmFyIFRJTUVPVVRfTVMgPSAoc2ltdWxhdGlvbiA/IDEwMDAgOiAzMDAwMCk7IC8vIEdpdmUgdXAgc29tZSBvcGVyYXRpb25zIGFmdGVyIFggbXMuXG4gICAgYnRTdGF0ZS5zdGFydGVkID0gdHJ1ZTtcblxuICAgIGxvZy5kZWJ1ZyhcIkN1cnJlbnQgc3RhdGU6XCIgKyBidFN0YXRlLnN0YXRlKTtcblxuICAgIC8vIENvbnNlY3V0aXZlIHN0YXRlIGNvdW50ZWQuIENhbiBiZSB1c2VkIHRvIHRpbWVvdXQuXG4gICAgaWYgKGJ0U3RhdGUuc3RhdGUgPT0gYnRTdGF0ZS5wcmV2X3N0YXRlKSB7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGVfY3B0Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQgPSAwO1xuICAgIH1cblxuICAgIC8vIFN0b3AgcmVxdWVzdCBmcm9tIEFQSVxuICAgIGlmIChidFN0YXRlLnN0b3BSZXF1ZXN0KSB7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5TVE9QUElORztcbiAgICB9XG5cbiAgICBsb2cuZGVidWcoXCJcXFN0YXRlOlwiICsgYnRTdGF0ZS5zdGF0ZSk7XG4gICAgc3dpdGNoIChidFN0YXRlLnN0YXRlKSB7XG4gICAgICAgIGNhc2UgU3RhdGUuTk9UX0NPTk5FQ1RFRDogLy8gaW5pdGlhbCBzdGF0ZSBvbiBTdGFydCgpXG4gICAgICAgICAgICBpZiAoc2ltdWxhdGlvbikge1xuICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlUGFpckRldmljZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGJ0UGFpckRldmljZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFN0YXRlLkNPTk5FQ1RJTkc6IC8vIHdhaXRpbmcgZm9yIGNvbm5lY3Rpb24gdG8gY29tcGxldGVcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5ERVZJQ0VfUEFJUkVEOiAvLyBjb25uZWN0aW9uIGNvbXBsZXRlLCBhY3F1aXJlIG1ldGVyIHN0YXRlXG4gICAgICAgICAgICBpZiAoc2ltdWxhdGlvbikge1xuICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlU3Vic2NyaWJlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gYnRTdWJzY3JpYmU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5TVUJTQ1JJQklORzogLy8gd2FpdGluZyBmb3IgQmx1ZXRvb3RoIGludGVyZmFjZXNcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoYnRTdGF0ZS5zdGF0ZV9jcHQgPiAoVElNRU9VVF9NUyAvIERFTEFZX01TKSkge1xuICAgICAgICAgICAgICAgIC8vIFRpbWVvdXQsIHRyeSB0byByZXN1YnNjcmliZVxuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiVGltZW91dCBpbiBTVUJTQ1JJQklOR1wiKTtcbiAgICAgICAgICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuREVWSUNFX1BBSVJFRDtcbiAgICAgICAgICAgICAgICBidFN0YXRlLnN0YXRlX2NwdCA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5NRVRFUl9JTklUOiAvLyByZWFkeSB0byBjb21tdW5pY2F0ZSwgYWNxdWlyZSBtZXRlciBzdGF0dXNcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSBtZXRlckluaXQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5NRVRFUl9JTklUSUFMSVpJTkc6IC8vIHJlYWRpbmcgdGhlIG1ldGVyIHN0YXR1c1xuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuc3RhdGVfY3B0ID4gKFRJTUVPVVRfTVMgLyBERUxBWV9NUykpIHtcbiAgICAgICAgICAgICAgICBsb2cud2FybihcIlRpbWVvdXQgaW4gTUVURVJfSU5JVElBTElaSU5HXCIpO1xuICAgICAgICAgICAgICAgIC8vIFRpbWVvdXQsIHRyeSB0byByZXN1YnNjcmliZVxuICAgICAgICAgICAgICAgIGlmIChzaW11bGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlU3Vic2NyaWJlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBidFN1YnNjcmliZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFN0YXRlLklETEU6IC8vIHJlYWR5IHRvIHByb2Nlc3MgY29tbWFuZHMgZnJvbSBBUElcbiAgICAgICAgICAgIGlmIChidFN0YXRlLmNvbW1hbmQgIT0gbnVsbClcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gcHJvY2Vzc0NvbW1hbmQ7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXh0QWN0aW9uID0gcmVmcmVzaDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFN0YXRlLkVSUk9SOiAvLyBhbnl0aW1lIGFuIGVycm9yIGhhcHBlbnNcbiAgICAgICAgICAgIG5leHRBY3Rpb24gPSBkaXNjb25uZWN0O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgU3RhdGUuQlVTWTogLy8gd2hpbGUgYSBjb21tYW5kIGluIGdvaW5nIG9uXG4gICAgICAgICAgICBpZiAoYnRTdGF0ZS5zdGF0ZV9jcHQgPiAoVElNRU9VVF9NUyAvIERFTEFZX01TKSkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiVGltZW91dCBpbiBCVVNZXCIpO1xuICAgICAgICAgICAgICAgIC8vIFRpbWVvdXQsIHRyeSB0byByZXN1YnNjcmliZVxuICAgICAgICAgICAgICAgIGlmIChzaW11bGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBmYWtlU3Vic2NyaWJlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5leHRBY3Rpb24gPSBidFN1YnNjcmliZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnRTdGF0ZS5zdGF0ZV9jcHQgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFN0YXRlLlNUT1BQSU5HOlxuICAgICAgICAgICAgbmV4dEFjdGlvbiA9IGRpc2Nvbm5lY3Q7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5TVE9QUEVEOiAvLyBhZnRlciBhIGRpc2Nvbm5lY3RvciBvciBTdG9wKCkgcmVxdWVzdCwgc3RvcHMgdGhlIHN0YXRlIG1hY2hpbmUuXG4gICAgICAgICAgICBuZXh0QWN0aW9uID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBidFN0YXRlLnByZXZfc3RhdGUgPSBidFN0YXRlLnN0YXRlO1xuXG4gICAgaWYgKG5leHRBY3Rpb24gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGxvZy5kZWJ1ZyhcIlxcdEV4ZWN1dGluZzpcIiArIG5leHRBY3Rpb24ubmFtZSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBuZXh0QWN0aW9uKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIkV4Y2VwdGlvbiBpbiBzdGF0ZSBtYWNoaW5lXCIsIGUpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChidFN0YXRlLnN0YXRlICE9IFN0YXRlLlNUT1BQRUQpIHtcbiAgICAgICAgdXRpbHMuc2xlZXAoREVMQVlfTVMpLnRoZW4oKCkgPT4gc3RhdGVNYWNoaW5lKCkpOyAvLyBSZWNoZWNrIHN0YXR1cyBpbiBERUxBWV9NUyBtc1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgbG9nLmRlYnVnKFwiXFx0VGVybWluYXRpbmcgU3RhdGUgbWFjaGluZVwiKTtcbiAgICAgICAgYnRTdGF0ZS5zdGFydGVkID0gZmFsc2U7XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxlZCBmcm9tIHN0YXRlIG1hY2hpbmUgdG8gZXhlY3V0ZSBhIHNpbmdsZSBjb21tYW5kIGZyb20gYnRTdGF0ZS5jb21tYW5kIHByb3BlcnR5XG4gKiAqL1xuYXN5bmMgZnVuY3Rpb24gcHJvY2Vzc0NvbW1hbmQoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29tbWFuZC5lcnJvciA9IGZhbHNlO1xuICAgICAgICBjb21tYW5kLnBlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgYnRTdGF0ZS5jb21tYW5kID0gbnVsbDtcblxuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgbG9nLmRlYnVnKFwiXFx0XFx0Q29tcGxldGVkIGNvbW1hbmQgZXhlY3V0ZWRcIik7XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLmVycm9yKFwiKiogZXJyb3Igd2hpbGUgZXhlY3V0aW5nIGNvbW1hbmQ6IFwiICsgZXJyKTtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLk1FVEVSX0lOSVQ7XG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBtb2RidXMuTW9kYnVzRXJyb3IpXG4gICAgICAgICAgICBidFN0YXRlLnN0YXRzW1wibW9kYnVzX2Vycm9yc1wiXSsrO1xuICAgICAgICByZXR1cm47XG4gICAgfVxufVxuXG5cbi8qKlxuICogQWNxdWlyZSB0aGUgY3VycmVudCBtb2RlIGFuZCBzZXJpYWwgbnVtYmVyIG9mIHRoZSBkZXZpY2UuXG4gKiAqL1xuYXN5bmMgZnVuY3Rpb24gbWV0ZXJJbml0KCkge1xuICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5JRExFO1xufVxuXG4vKlxuICogQ2xvc2UgdGhlIGJsdWV0b290aCBpbnRlcmZhY2UgKHVucGFpcilcbiAqICovXG5hc3luYyBmdW5jdGlvbiBkaXNjb25uZWN0KCkge1xuICAgIGJ0U3RhdGUuY29tbWFuZCA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKGJ0U3RhdGUuYnREZXZpY2UgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGJ0U3RhdGUuYnREZXZpY2U/LmdhdHQ/LmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgICAgIGxvZy53YXJuKFwiKiBDYWxsaW5nIGRpc2Nvbm5lY3Qgb24gYnRkZXZpY2VcIik7XG4gICAgICAgICAgICAgICAgLy8gQXZvaWQgdGhlIGV2ZW50IGZpcmluZyB3aGljaCBtYXkgbGVhZCB0byBhdXRvLXJlY29ubmVjdFxuICAgICAgICAgICAgICAgIGJ0U3RhdGUuYnREZXZpY2UucmVtb3ZlRXZlbnRMaXN0ZW5lcignZ2F0dHNlcnZlcmRpc2Nvbm5lY3RlZCcsIG9uRGlzY29ubmVjdGVkKTtcbiAgICAgICAgICAgICAgICBidFN0YXRlLmJ0RGV2aWNlLmdhdHQuZGlzY29ubmVjdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJ0U3RhdGUuYnRTZXJ2aWNlID0gbnVsbDtcbiAgICB9XG4gICAgY2F0Y2ggeyB9XG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG59XG5cbi8qKlxuICogRXZlbnQgY2FsbGVkIGJ5IGJyb3dzZXIgQlQgYXBpIHdoZW4gdGhlIGRldmljZSBkaXNjb25uZWN0XG4gKiAqL1xuYXN5bmMgZnVuY3Rpb24gb25EaXNjb25uZWN0ZWQoKSB7XG4gICAgbG9nLndhcm4oXCIqIEdBVFQgU2VydmVyIGRpc2Nvbm5lY3RlZCBldmVudCwgd2lsbCB0cnkgdG8gcmVjb25uZWN0ICpcIik7XG4gICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xuICAgIGJ0U3RhdGUuc3RhdHNbXCJHQVRUIGRpc2Nvbm5lY3RzXCJdKys7XG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7IC8vIFRyeSB0byBhdXRvLXJlY29ubmVjdCB0aGUgaW50ZXJmYWNlcyB3aXRob3V0IHBhaXJpbmdcbn1cblxuLyoqXG4gKiBKb2lucyB0aGUgYXJndW1lbnRzIGludG8gYSBzaW5nbGUgYnVmZmVyXG4gKiBAcmV0dXJucyB7QnVmZmVyfSBjb25jYXRlbmF0ZWQgYnVmZmVyXG4gKi9cbmZ1bmN0aW9uIGFycmF5QnVmZmVyQ29uY2F0KCkge1xuICAgIHZhciBsZW5ndGggPSAwO1xuICAgIHZhciBidWZmZXIgPSBudWxsO1xuXG4gICAgZm9yICh2YXIgaSBpbiBhcmd1bWVudHMpIHtcbiAgICAgICAgYnVmZmVyID0gYXJndW1lbnRzW2ldO1xuICAgICAgICBsZW5ndGggKz0gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgfVxuXG4gICAgdmFyIGpvaW5lZCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG4gICAgdmFyIG9mZnNldCA9IDA7XG5cbiAgICBmb3IgKGkgaW4gYXJndW1lbnRzKSB7XG4gICAgICAgIGJ1ZmZlciA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgam9pbmVkLnNldChuZXcgVWludDhBcnJheShidWZmZXIpLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gYnVmZmVyLmJ5dGVMZW5ndGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGpvaW5lZC5idWZmZXI7XG59XG5cbnZhciBsYXN0VGltZVN0YW1wID0gMDtcbi8qKlxuICogRXZlbnQgY2FsbGVkIGJ5IGJsdWV0b290aCBjaGFyYWN0ZXJpc3RpY3Mgd2hlbiByZWNlaXZpbmcgZGF0YVxuICogQHBhcmFtIHthbnl9IGV2ZW50XG4gKi9cbmZ1bmN0aW9uIGhhbmRsZU5vdGlmaWNhdGlvbnMoZXZlbnQpIHtcbiAgICB2YXIgZGVsYXkgPSAwO1xuICAgIGxldCB2YWx1ZSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgICAgICBsb2cuZGVidWcoJzw8ICcgKyB1dGlscy5idWYyaGV4KHZhbHVlLmJ1ZmZlcikpO1xuICAgICAgICBpZiAoYnRTdGF0ZS5yZXNwb25zZSAhPSBudWxsKSB7XG4gICAgICAgICAgICBidFN0YXRlLnJlc3BvbnNlID0gYXJyYXlCdWZmZXJDb25jYXQoYnRTdGF0ZS5yZXNwb25zZSwgdmFsdWUuYnVmZmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ0U3RhdGUucmVzcG9uc2UgPSB2YWx1ZS5idWZmZXIuc2xpY2UoKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBLZWVwIHRoZSBldmVudCBvcmlnaW5hbCB0aW1lc3RhbXAgISFcbiAgICAgICAgYnRTdGF0ZS5yZXNwb25zZVRpbWVTdGFtcCA9IG5ldyBEYXRlKGV2ZW50LnRpbWVTdGFtcCk7XG4gICAgICAgIGlmIChsYXN0VGltZVN0YW1wID4gMCkge1xuICAgICAgICAgICAgZGVsYXkgPSBldmVudC50aW1lU3RhbXAgLSBsYXN0VGltZVN0YW1wOyAvLyBtcyBiZXR3ZWVuIG5vdGlmaWNhdGlvbnNcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbGF5ID0gMDtcbiAgICAgICAgfVxuICAgICAgICBsYXN0VGltZVN0YW1wID0gZXZlbnQudGltZVN0YW1wO1xuXG4gICAgICAgIHBhcnNlUmVzcG9uc2UoYnRTdGF0ZS5yZXNwb25zZSwgYnRTdGF0ZS5yZXNwb25zZVRpbWVTdGFtcCk7XG5cbiAgICAgICAgLy8gTG9nIHRoZSBwYWNrZXRzXG4gICAgICAgIGlmIChsb2dnaW5nKSB7XG4gICAgICAgICAgICB2YXIgcGFja2V0ID0geyAnbm90aWZpY2F0aW9uJzogdXRpbHMuYnVmMmhleChidFN0YXRlLnJlc3BvbnNlKSwgJ3BhcnNlZCc6IGJ0U3RhdGUucGFyc2VkUmVzcG9uc2UgfTtcbiAgICAgICAgICAgIHZhciBwYWNrZXRzID0gd2luZG93LmxvY2FsU3RvcmFnZS5nZXRJdGVtKFwiT3dvbkJUVHJhY2VcIik7XG4gICAgICAgICAgICBpZiAocGFja2V0cyA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcGFja2V0cyA9IFtdOyAvLyBpbml0aWFsaXplIGFycmF5XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYWNrZXRzID0gSlNPTi5wYXJzZShwYWNrZXRzKTsgLy8gUmVzdG9yZSB0aGUganNvbiBwZXJzaXN0ZWQgb2JqZWN0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwYWNrZXRzLnB1c2gocGFja2V0KTsgLy8gQWRkIHRoZSBuZXcgb2JqZWN0XG4gICAgICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJPd29uQlRUcmFjZVwiLCBKU09OLnN0cmluZ2lmeShwYWNrZXRzKSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChkZWxheSA+IDApIHtcbiAgICAgICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJsYXN0UmVzcG9uc2VUaW1lXCJdID0gZGVsYXk7XG4gICAgICAgICAgICBidFN0YXRlLnN0YXRzW1wicmVzcG9uc2VUaW1lXCJdID0gKGJ0U3RhdGUuc3RhdHNbXCJyZXNwb25zZVRpbWVcIl0gKiAoYnRTdGF0ZS5zdGF0c1tcInJlc3BvbnNlc1wiXS0xLjApICsgZGVsYXkpIC8gYnRTdGF0ZS5zdGF0c1tcInJlc3BvbnNlc1wiXTtcbiAgICAgICAgfVxuICAgICAgICBidFN0YXRlLnN0YXRzW1wicmVzcG9uc2VzXCJdKys7XG5cbiAgICAgICAgYnRTdGF0ZS5yZXNwb25zZSA9IG51bGw7XG4gICAgfVxufVxuXG4vKiBPV09OICovXG5cbmNvbnN0IERDViA9IDB4MDtcbmNvbnN0IEFDViA9IDB4MTtcbmNvbnN0IERDQSA9IDB4MjtcbmNvbnN0IEFDQSA9IDB4MztcbmNvbnN0IE9obSA9IDB4NDtcbmNvbnN0IENhcCA9IDB4NTtcbmNvbnN0IEh6ID0gMHg2O1xuY29uc3QgRHV0eSA9IDB4NztcbmNvbnN0IFRlbXBDID0gMHg4O1xuY29uc3QgVGVtcEYgPSAweDk7XG5jb25zdCBEaW9kZSA9IDB4QTtcbmNvbnN0IENvbnRpbnVpdHkgPSAweEI7XG5jb25zdCBoRkUgPSAweEM7XG5cbmZ1bmN0aW9uIGZvcm1hdFBhcnNlZFJlc3BvbnNlKGZ1biwgbWVhc3VyZW1lbnQsIHNjYWxlLCBvdmVybG9hZCkge1xuICAgIHZhciBtZWFzdXJlID0gXCI/XCI7XG4gICAgdmFyIHVuaXRzID0gXCJcIjtcblxuICAgIHN3aXRjaCAoZnVuKSB7XG4gICAgICAgIGNhc2UgRENWOlxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiVmRjPVwiO1xuICAgICAgICAgICAgdW5pdHMgPSBcIlZcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEFDVjpcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIlZhYz1cIjtcbiAgICAgICAgICAgIHVuaXRzID0gXCJWXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEQ0E6XG4gICAgICAgICAgICBtZWFzdXJlID0gXCJJZGM9XCI7XG4gICAgICAgICAgICB1bml0cyA9IFwiQVwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQUNBOlxuICAgICAgICAgICAgdW5pdHMgPSBcIklhYz1cIjtcbiAgICAgICAgICAgIHVuaXRzID0gXCJBXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBPaG06XG4gICAgICAgICAgICBtZWFzdXJlID0gXCJSPVwiO1xuICAgICAgICAgICAgdW5pdHMgPSBcIk9obXNcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIENhcDpcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkM9XCI7XG4gICAgICAgICAgICB1bml0cyA9IFwiRlwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgSHo6XG4gICAgICAgICAgICBtZWFzdXJlID0gXCJGcmVxdWVuY3k9XCI7XG4gICAgICAgICAgICB1bml0cyA9IFwiSHpcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIER1dHk6XG4gICAgICAgICAgICBtZWFzdXJlID0gXCJEdXR5PVwiO1xuICAgICAgICAgICAgdW5pdHMgPSBcIiVcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFRlbXBDOlxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiVGVtcGVyYXR1cmU9XCI7XG4gICAgICAgICAgICB1bml0cyA9IFwiwrBDXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBUZW1wRjpcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIlRlbXBlcmF0dXJlPVwiO1xuICAgICAgICAgICAgdW5pdHMgPSBcIkZcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpb2RlOlxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiRGlvZGU9XCI7XG4gICAgICAgICAgICB1bml0cyA9IFwiVlwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgQ29udGludWl0eTpcbiAgICAgICAgICAgIG1lYXN1cmUgPSBcIkNvbnRpbnVpdHk9XCI7XG4gICAgICAgICAgICB1bml0cyA9IFwiT2htc1wiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaEZFOlxuICAgICAgICAgICAgbWVhc3VyZSA9IFwiaEZFPVwiO1xuICAgICAgICAgICAgdW5pdHMgPSBcIlwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBtZWFzdXJlID0gXCI/PVwiO1xuICAgICAgICAgICAgdW5pdHMgPSBcIj9cIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHN3aXRjaCAoc2NhbGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgICAgc2NhbGUgPSBcIlwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHNjYWxlID0gXCJuXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgc2NhbGUgPSBcIm1pY3JvXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgc2NhbGUgPSBcIm1cIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICBzY2FsZSA9IFwiXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgICAgc2NhbGUgPSBcImtpbG9cIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgICBzY2FsZSA9IFwibWVnYVwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGlmIChvdmVybG9hZCkge1xuICAgICAgICByZXR1cm4gbWVhc3VyZSArIFwiICoqT1ZFUkxPQUQqKiBcIiArIHNjYWxlICsgdW5pdHM7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gbWVhc3VyZSArIG1lYXN1cmVtZW50ICsgXCIgXCIgKyBzY2FsZSArIHVuaXRzO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VSZXNwb25zZShidWZmZXIsIHRpbWVzdGFtcCkge1xuICAgIGxldCB2YWx1ZSA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICAgIHZhciBtZWFzdXJlbWVudCA9IE5hTjtcblxuICAgIC8vIFNlZSBSRUFETUUubWQgb24gaHR0cHM6Ly9naXRodWIuY29tL0RlYW5Db3JkaW5nL293b25iMzVcbiAgICB2YXIgZnVuYyA9ICh2YWx1ZS5nZXRVaW50MTYoMCwgdHJ1ZSkgPj4gNikgJiAweDBmO1xuICAgIHZhciBkZWNpbWFsID0gdmFsdWUuZ2V0VWludDgoMCkgJiAweDA3O1xuICAgIHZhciBzY2FsZSA9ICh2YWx1ZS5nZXRVaW50OCgwKSA+PiAzKSAmIDB4MDc7XG4gICAgdmFyIHVpbnQxNnZhbCA9IHZhbHVlLmdldFVpbnQ4KDQpICsgMjU2ICogdmFsdWUuZ2V0VWludDgoNSk7XG4gICAgaWYgKHVpbnQxNnZhbCA8IDB4N2ZmZikge1xuICAgICAgICBtZWFzdXJlbWVudCA9IHVpbnQxNnZhbCAvIE1hdGgucG93KDEwLjAsIGRlY2ltYWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1lYXN1cmVtZW50ID0gLTEuMCAqICh1aW50MTZ2YWwgJiAweDdmZmYpIC8gTWF0aC5wb3coMTAuMCwgZGVjaW1hbCk7XG4gICAgfVxuICAgIHZhciBvdmVybG9hZCA9IChkZWNpbWFsID09IDB4MDcpO1xuXG4gICAgdmFyIG5vcm1hbGl6YXRpb24gPSAxLjA7XG4gICAgc3dpdGNoIChzY2FsZSkge1xuICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMS4wO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIG5vcm1hbGl6YXRpb24gPSAwLjAwMDAwMDAwMTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMC4wMDAwMDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgbm9ybWFsaXphdGlvbiA9IDAuMDAxO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgIG5vcm1hbGl6YXRpb24gPSAxLjA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgICAgbm9ybWFsaXphdGlvbiA9IDEwMDAuMDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgICBub3JtYWxpemF0aW9uID0gMTAwMDAwMC4wO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHZhciBmdW5jdGlvbkRlc2MgPSAnJztcbiAgICBzd2l0Y2ggKGZ1bmMpIHtcbiAgICAgICAgY2FzZSBEQ1Y6XG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlZvbHRhZ2UgKERDKSAtIFZcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEFDVjpcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiVm9sdGFnZSAoQUMpIC0gVlwiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRENBOlxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJDdXJyZW50IChEQykgLSBBXCJcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEFDQTpcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiQ3VycmVudCAoQUMpIC0gQVwiXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBPaG06XG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlJlc2lzdGFuY2UgLSBPaG1zXCJcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIENhcDpcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiQ2FwYWNpdGFuY2UgLSBGXCJcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIEh6OlxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJGcmVxdWVuY3kgLSBIelwiXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEdXR5OlxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJEdXR5IGN5Y2xlIC0gJVwiXG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBUZW1wQzpcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiVGVtcGVyYXR1cmUgLSDCsENcIlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgVGVtcEY6XG4gICAgICAgICAgICBmdW5jdGlvbkRlc2MgPSBcIlRlbXBlcmF0dXJlIC0gwrBGXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaW9kZTpcbiAgICAgICAgICAgIGZ1bmN0aW9uRGVzYyA9IFwiRGlvZGUgLSBWXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBDb250aW51aXR5OlxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJDb250aW51aXR5IC0gT2htc1wiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgaEZFOlxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCJoRkVcIjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgZnVuY3Rpb25EZXNjID0gXCI/XCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBidFN0YXRlLnBhcnNlZFJlc3BvbnNlID0ge1xuICAgICAgICBcIkZ1bmN0aW9uXCI6IGZ1bmMsXG4gICAgICAgIFwiRnVuY3Rpb24gZGVzY3JpcHRpb25cIjogZnVuY3Rpb25EZXNjLFxuICAgICAgICBcIk1lYXN1cmVtZW50XCI6IG1lYXN1cmVtZW50LFxuICAgICAgICBcIlNjYWxlXCI6IHNjYWxlLFxuICAgICAgICBcIk92ZXJsb2FkXCI6IG92ZXJsb2FkLFxuICAgICAgICBcIlRpbWVzdGFtcFwiOiB0aW1lc3RhbXAsXG4gICAgICAgIFwiVmFsdWVcIjogbWVhc3VyZW1lbnQgKiBub3JtYWxpemF0aW9uLFxuICAgICAgICBcIkRhdGVUaW1lXCI6IG5ldyBEYXRlKCksXG4gICAgICAgIFwiRGVjaW1hbFwiOiBkZWNpbWFsXG4gICAgfTtcbiAgICBidFN0YXRlLmZvcm1hdHRlZFJlc3BvbnNlID0gZm9ybWF0UGFyc2VkUmVzcG9uc2UoZnVuYywgbWVhc3VyZW1lbnQsIHNjYWxlLCBvdmVybG9hZCk7XG59XG5cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgc3VjY2VlZCBvbmx5IGlmIGNhbGxlZCBhcyBhIGNvbnNlcXVlbmNlIG9mIGEgdXNlci1nZXN0dXJlXG4gKiBFLmcuIGJ1dHRvbiBjbGljay4gVGhpcyBpcyBkdWUgdG8gQmx1ZVRvb3RoIEFQSSBzZWN1cml0eSBtb2RlbC5cbiAqICovXG5hc3luYyBmdW5jdGlvbiBidFBhaXJEZXZpY2UoKSB7XG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkNPTk5FQ1RJTkc7XG4gICAgdmFyIGZvcmNlU2VsZWN0aW9uID0gdHJ1ZTtcbiAgICBsb2cuZGVidWcoXCJidFBhaXJEZXZpY2UoXCIgKyBmb3JjZVNlbGVjdGlvbiArIFwiKVwiKTtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIChuYXZpZ2F0b3IuYmx1ZXRvb3RoPy5nZXRBdmFpbGFiaWxpdHkpID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNvbnN0IGF2YWlsYWJpbGl0eSA9IGF3YWl0IG5hdmlnYXRvci5ibHVldG9vdGguZ2V0QXZhaWxhYmlsaXR5KCk7XG4gICAgICAgICAgICBpZiAoIWF2YWlsYWJpbGl0eSkge1xuICAgICAgICAgICAgICAgIGxvZy5lcnJvcihcIkJsdWV0b290aCBub3QgYXZhaWxhYmxlIGluIGJyb3dzZXIuXCIpO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkJyb3dzZXIgZG9lcyBub3QgcHJvdmlkZSBibHVldG9vdGhcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGRldmljZSA9IG51bGw7XG5cbiAgICAgICAgLy8gSWYgbm90LCByZXF1ZXN0IGZyb20gdXNlclxuICAgICAgICBpZiAoZGV2aWNlID09IG51bGwpIHtcbiAgICAgICAgICAgIGRldmljZSA9IGF3YWl0IG5hdmlnYXRvci5ibHVldG9vdGhcbiAgICAgICAgICAgICAgICAucmVxdWVzdERldmljZSh7XG4gICAgICAgICAgICAgICAgICAgIGFjY2VwdEFsbERldmljZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbmFsU2VydmljZXM6IFtCbHVlVG9vdGhPV09OLlNlcnZpY2VVdWlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGJ0U3RhdGUuYnREZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5ERVZJQ0VfUEFJUkVEO1xuICAgICAgICBsb2cuaW5mbyhcIkJsdWV0b290aCBkZXZpY2UgXCIgKyBkZXZpY2UubmFtZSArIFwiIGNvbm5lY3RlZC5cIik7XG4gICAgICAgIGF3YWl0IHV0aWxzLnNsZWVwKDUwMCk7XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nLndhcm4oXCIqKiBlcnJvciB3aGlsZSBjb25uZWN0aW5nOiBcIiArIGVyci5tZXNzYWdlKTtcbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xuICAgICAgICBpZiAoYnRTdGF0ZS5jaGFyUmVhZCAhPSBudWxsKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGJ0U3RhdGUuY2hhclJlYWQuc3RvcE5vdGlmaWNhdGlvbnMoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IH1cbiAgICAgICAgfVxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gbnVsbDtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICBidFN0YXRlLnN0YXRzW1wiZXhjZXB0aW9uc1wiXSsrO1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZmFrZVBhaXJEZXZpY2UoKSB7XG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkNPTk5FQ1RJTkc7XG4gICAgdmFyIGZvcmNlU2VsZWN0aW9uID0gdHJ1ZTtcbiAgICBsb2cuZGVidWcoXCJmYWtlUGFpckRldmljZShcIiArIGZvcmNlU2VsZWN0aW9uICsgXCIpXCIpO1xuICAgIHRyeSB7XG4gICAgICAgIHZhciBkZXZpY2UgPSB7IG5hbWU6IFwiRmFrZUJURGV2aWNlXCIsIGdhdHQ6IHsgY29ubmVjdGVkOiB0cnVlIH0gfTtcbiAgICAgICAgYnRTdGF0ZS5idERldmljZSA9IGRldmljZTtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7XG4gICAgICAgIGxvZy5pbmZvKFwiQmx1ZXRvb3RoIGRldmljZSBcIiArIGRldmljZS5uYW1lICsgXCIgY29ubmVjdGVkLlwiKTtcbiAgICAgICAgYXdhaXQgdXRpbHMuc2xlZXAoNTApO1xuICAgIH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgY29ubmVjdGluZzogXCIgKyBlcnIubWVzc2FnZSk7XG4gICAgICAgIGJ0U3RhdGUuYnRTZXJ2aWNlID0gbnVsbDtcbiAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZCA9IG51bGw7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5FUlJPUjtcbiAgICAgICAgYnRTdGF0ZS5zdGF0c1tcImV4Y2VwdGlvbnNcIl0rKztcbiAgICB9XG59XG5cbi8qKlxuICogT25jZSB0aGUgZGV2aWNlIGlzIGF2YWlsYWJsZSwgaW5pdGlhbGl6ZSB0aGUgc2VydmljZSBhbmQgdGhlIDIgY2hhcmFjdGVyaXN0aWNzIG5lZWRlZC5cbiAqICovXG5hc3luYyBmdW5jdGlvbiBidFN1YnNjcmliZSgpIHtcbiAgICB0cnkge1xuICAgICAgICBidFN0YXRlLnN0YXRlID0gU3RhdGUuU1VCU0NSSUJJTkc7XG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJzdWJjcmliZXNcIl0rKztcbiAgICAgICAgbGV0IGRldmljZSA9IGJ0U3RhdGUuYnREZXZpY2U7XG4gICAgICAgIGxldCBzZXJ2ZXIgPSBudWxsO1xuXG4gICAgICAgIGlmICghZGV2aWNlPy5nYXR0Py5jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIGxvZy5kZWJ1ZyhgQ29ubmVjdGluZyB0byBHQVRUIFNlcnZlciBvbiAke2RldmljZS5uYW1lfS4uLmApO1xuICAgICAgICAgICAgZGV2aWNlLmFkZEV2ZW50TGlzdGVuZXIoJ2dhdHRzZXJ2ZXJkaXNjb25uZWN0ZWQnLCBvbkRpc2Nvbm5lY3RlZCk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChidFN0YXRlLmJ0U2VydmljZT8uY29ubmVjdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGJ0U3RhdGUuYnRTZXJ2aWNlLmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgICAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCgxMDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikgeyB9XG5cbiAgICAgICAgICAgIHNlcnZlciA9IGF3YWl0IGRldmljZS5nYXR0LmNvbm5lY3QoKTtcbiAgICAgICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBHQVRUIHNlcnZlcicpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nLmRlYnVnKCdHQVRUIGFscmVhZHkgY29ubmVjdGVkJyk7XG4gICAgICAgICAgICBzZXJ2ZXIgPSBkZXZpY2UuZ2F0dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ0U3RhdGUuYnRTZXJ2aWNlID0gYXdhaXQgc2VydmVyLmdldFByaW1hcnlTZXJ2aWNlKEJsdWVUb290aE9XT04uU2VydmljZVV1aWQpO1xuICAgICAgICBpZiAoYnRTdGF0ZS5idFNlcnZpY2UgPT0gbnVsbClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkdBVFQgU2VydmljZSByZXF1ZXN0IGZhaWxlZFwiKTtcbiAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIE93b24gc2VydmljZScpO1xuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gYXdhaXQgYnRTdGF0ZS5idFNlcnZpY2UuZ2V0Q2hhcmFjdGVyaXN0aWMoQmx1ZVRvb3RoT1dPTi5Ob3RpZmljYXRpb25zVXVpZCk7XG4gICAgICAgIGxvZy5kZWJ1ZygnPiBGb3VuZCBub3RpZmljYXRpb25zIGNoYXJhY3RlcmlzdGljJyk7XG4gICAgICAgIGJ0U3RhdGUucmVzcG9uc2UgPSBudWxsO1xuICAgICAgICBidFN0YXRlLmNoYXJSZWFkLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYXJhY3RlcmlzdGljdmFsdWVjaGFuZ2VkJywgaGFuZGxlTm90aWZpY2F0aW9ucyk7XG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQuc3RhcnROb3RpZmljYXRpb25zKCk7XG4gICAgICAgIGxvZy5pbmZvKCc+IEJsdWV0b290aCBpbnRlcmZhY2VzIHJlYWR5LicpO1xuICAgICAgICBidFN0YXRlLnN0YXRzW1wibGFzdF9jb25uZWN0XCJdID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCg1MCk7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5NRVRFUl9JTklUO1xuICAgIH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgc3Vic2NyaWJpbmc6IFwiICsgZXJyLm1lc3NhZ2UpO1xuICAgICAgICBpZiAoYnRTdGF0ZS5jaGFyUmVhZCAhPSBudWxsKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmIChidFN0YXRlLmJ0RGV2aWNlPy5nYXR0Py5jb25uZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYnRTdGF0ZS5jaGFyUmVhZC5zdG9wTm90aWZpY2F0aW9ucygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBidFN0YXRlLmJ0RGV2aWNlPy5nYXR0LmRpc2Nvbm5lY3QoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7IH1cbiAgICAgICAgfVxuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gbnVsbDtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7XG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XG4gICAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBmYWtlU3Vic2NyaWJlKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5TVUJTQ1JJQklORztcbiAgICAgICAgYnRTdGF0ZS5zdGF0c1tcInN1YmNyaWJlc1wiXSsrO1xuICAgICAgICBsZXQgZGV2aWNlID0gYnRTdGF0ZS5idERldmljZTtcbiAgICAgICAgbGV0IHNlcnZlciA9IG51bGw7XG5cbiAgICAgICAgaWYgKCFkZXZpY2U/LmdhdHQ/LmNvbm5lY3RlZCkge1xuICAgICAgICAgICAgbG9nLmRlYnVnKGBDb25uZWN0aW5nIHRvIEdBVFQgU2VydmVyIG9uICR7ZGV2aWNlLm5hbWV9Li4uYCk7XG4gICAgICAgICAgICBkZXZpY2VbJ2dhdHQnXVsnY29ubmVjdGVkJ10gPSB0cnVlO1xuICAgICAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIEdBVFQgc2VydmVyJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsb2cuZGVidWcoJ0dBVFQgYWxyZWFkeSBjb25uZWN0ZWQnKTtcbiAgICAgICAgICAgIHNlcnZlciA9IGRldmljZS5nYXR0O1xuICAgICAgICB9XG5cbiAgICAgICAgYnRTdGF0ZS5idFNlcnZpY2UgPSB7fTtcbiAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIFNlcmlhbCBzZXJ2aWNlJyk7XG4gICAgICAgIGJ0U3RhdGUuY2hhclJlYWQgPSB7fTtcbiAgICAgICAgbG9nLmRlYnVnKCc+IEZvdW5kIHJlYWQgY2hhcmFjdGVyaXN0aWMnKTtcbiAgICAgICAgYnRTdGF0ZS5yZXNwb25zZSA9IG51bGw7XG4gICAgICAgIGxvZy5pbmZvKCc+IEJsdWV0b290aCBpbnRlcmZhY2VzIHJlYWR5LicpO1xuICAgICAgICBidFN0YXRlLnN0YXRzW1wibGFzdF9jb25uZWN0XCJdID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICBhd2FpdCB1dGlscy5zbGVlcCgxMCk7XG4gICAgICAgIGJ0U3RhdGUuc3RhdGUgPSBTdGF0ZS5NRVRFUl9JTklUO1xuICAgIH1cbiAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZy53YXJuKFwiKiogZXJyb3Igd2hpbGUgc3Vic2NyaWJpbmc6IFwiICsgZXJyLm1lc3NhZ2UpO1xuICAgICAgICBidFN0YXRlLmNoYXJSZWFkID0gbnVsbDtcbiAgICAgICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkRFVklDRV9QQUlSRUQ7XG4gICAgICAgIGJ0U3RhdGUuc3RhdHNbXCJleGNlcHRpb25zXCJdKys7XG4gICAgfVxufVxuXG5cbi8qKlxuICogV2hlbiBpZGxlLCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICogKi9cbmFzeW5jIGZ1bmN0aW9uIHJlZnJlc2goKSB7XG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLkJVU1k7XG4gICAgLy8gRG8gc29tZXRoaW5nXG4gICAgYnRTdGF0ZS5zdGF0ZSA9IFN0YXRlLklETEU7XG59XG5cbmZ1bmN0aW9uIFNldFNpbXVsYXRpb24odmFsdWUpIHtcbiAgICBzaW11bGF0aW9uID0gdmFsdWU7XG59XG5cbi8qKlxuICogRW5hYmxlcyBvciBkaXNhYmxlIHdyaXRpbmcgdGhlIG5vdGlmaWNhdGlvbnMgaW50byBhIGxvY2FsIHN0b3JhZ2UgZmlsZVxuICogQHBhcmFtIHtib29sZWFufSB2YWx1ZSBcbiAqL1xuZnVuY3Rpb24gU2V0UGFja2V0TG9nKHZhbHVlKSB7XG4gICAgbG9nZ2luZyA9IHZhbHVlO1xufVxubW9kdWxlLmV4cG9ydHMgPSB7IHN0YXRlTWFjaGluZSwgU2V0U2ltdWxhdGlvbiwgYnRTdGF0ZSwgU3RhdGUsIFNldFBhY2tldExvZyB9OyJdfQ==
