# Owon B41t web interface

Javascript interface for digital multimeter OWON B41T+

Test it here in your browser: [Github webpage](https://pbrunot.github.io/owonb41t/multimeter.html) 

![image](https://github.com/PBrunot/owonb41t/assets/6236243/b0cb0a81-5eff-47bf-b08c-5f332fa6a527)

# Requirements

- It requires a modern browser with Javascript Bluetooth enabled (tested with Chrome and Edge)
- Bluetooth BLE 4.0+ hardware interface
- Check bluetooth first with Chrome browser: chrome://bluetooth-internals

I tested with TP-Link UB400 adapted module on Desktop Windows 10.

# Owon meters protocol

B41T+ follows B35 protocol, which is described here : https://github.com/DeanCording/owonb35

Basically every BT notification contains 3 int16:
- one identifying the active measure, the number of decimals, and the units
- one identifying the measure type (hold/auto/max/min...) * this one is not parsed at the moment *
- one containing the displays digits with most significant bit used as sign bit 

# Bluetooth with Javascript

Reference document : [Web Bluetooth](https://googlechrome.github.io/samples/web-bluetooth/index.html)

