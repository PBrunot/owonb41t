# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a JavaScript library for interfacing with the OWON B41T+ digital multimeter via Web Bluetooth. The project enables browser-based communication with the multimeter to read measurements in real-time.

## Development Commands

### Build Commands
- `npm run dev` - Build unminified development version to `./dist/bt-owon-bt.js`
- `npm run dist` - Build minified production version to `./dist/bt-owon-bt.min.js`

### Testing
- `npm test` - Run Jest tests

### Package Management
- `npm ci` - Install dependencies (preferred for CI/clean installs)

## Core Architecture

### Main Entry Point
- `owon.js` - Main API module that exports Start(), Stop(), SetLogLevel() functions and exposes btState object

### Core Modules
- `webbluetooth.js` - Contains the main Bluetooth state machine and protocol implementation
  - Implements Bluetooth Low Energy communication using Web Bluetooth API
  - Handles device pairing, service discovery, and notification subscriptions
  - Contains protocol parser for OWON B35/B41T+ data format
  - State machine with states: NOT_CONNECTED, CONNECTING, DEVICE_PAIRED, SUBSCRIBING, IDLE, BUSY, ERROR, STOPPING, STOPPED, METER_INIT, METER_INITIALIZING

- `utils.js` - Utility functions for async operations and data conversion
  - sleep(), waitFor(), waitForTimeout() - async helpers
  - buf2hex(), hex2buf() - ArrayBuffer conversion utilities

### Protocol Implementation
The project implements the OWON B35 protocol (compatible with B41T+):
- Bluetooth service UUID: `0000fff0-0000-1000-8000-00805f9b34fb`
- Notifications UUID: `0000fff4-0000-1000-8000-00805f9b34fb`
- Each notification contains 3 int16 values: measurement type/decimals/units, measure type flags, and display digits with sign bit

### Frontend Integration
- `multimeter.html` - Demo web interface using Bootstrap and Chart.js
- Built files in `dist/` are standalone and can be included via script tags
- Library exports `OwonBT` global when used in browser

### Build System
- Uses Browserify to create standalone browser bundles
- UglifyJS for minification with source maps
- Jest for unit testing with jsdom environment

## Key Implementation Details

### State Management
The core state is managed in `webbluetooth.js` through the `btState` object which contains:
- Connection state and state machine status
- Bluetooth device/service/characteristic references
- Raw and parsed measurement data
- Statistics and debugging information

### Error Handling
- Auto-reconnection logic on GATT disconnections
- Timeout handling for various operations (30s default, 1s in simulation)
- Error states trigger cleanup and potential reconnection attempts

### Data Flow
1. User calls `OwonBT.Start()` to initiate connection
2. State machine handles Bluetooth pairing and service discovery
3. Notifications from multimeter are parsed and stored in `btState.parsedResponse`
4. Frontend can read live data from `btState` object
5. `OwonBT.Stop()` cleanly disconnects and stops state machine

## Testing Strategy
- Unit tests focus on API existence and state object structure
- Uses Jest with jsdom environment for browser API mocking
- Tests are in `tests/OwonBT.test.js`