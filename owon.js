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