# Owon B41t
Javascript interface for digital multimeter OWON B41T+
Test it here: https://pbrunot.github.io/owonb41t/multimeter.html (requires a modern browser with Javascript Bluetooth enabled)

![image](https://user-images.githubusercontent.com/6236243/200131788-34e4e4c0-ba97-4ba4-a363-8dcc8de0e7fc.png)


# Owon meters protocol
B41T+ follows B35 protocol, which is described here : https://github.com/DeanCording/owonb35

Basically every BT notification contains 3 int16:
- one identifying the active measure, the number of decimals, and the units
- one identifying the measure type (hold/auto/max/min...) * this one is not parsed at the moment *
- one containing the displays digits with most significant bit used as sign bit 

# Bluetooth with Javascript
https://googlechrome.github.io/samples/web-bluetooth/index.html

# Adapter required for PC
Bluetooth BLE 4.0+
Tested with TP-Link UB400
Check bluetooth first with Chrome browser: chrome://bluetooth-internals
