# OneWire Platform - Beta

A platform that allows [1-Wire](https://en.wikipedia.org/wiki/1-Wire) devices to be linked to HomeKit through Homebridge.  This plugin supports both the [OWFS 1-Wire Filesystem](http://owfs.org/) as well as the [EDS (Embedded Data Systems) OW-SERVER](https://www.embeddeddatasystems.com/OW-SERVER-1-Wire-to-Ethernet-Server-Revision-2_p_152.html) platform.

Currently the plugin supports Temperature and Humidity sensors.  Check the file [`ow-devices.json`](ow-devices.json) for the list of devices.

## Why do we need this platform

The implementation of a 1-Wire system is simple, but relies on hardware that limits the flexibility of deployment.  Using the EDS OW-SERVER is a reasonably low cost and formally supported alternative to the OWFS system, and doesn't require the maintenance of a Linux platform.

## Installation instructions

After [Homebridge](https://github.com/nfarina/homebridge) has been installed:

 `sudo npm install -g homebridge-onewire`

## Example config.json:

```json
{
  "bridge": {
      ...
  },
  "platforms": [
    {
      "platform": "OneWire",
      "server": "EDS",
      "host": "<IP Address or Host Name>",
      "port": 80,
      "devices": [
        {
          "name": "Wiring Closet",
          "address": "2848DCC800EF0055",
          "type": "DS18B20"
        },
        {
          "name": "Upper Attic",
          "address": "26BAF7D60F000073",
          "type": "DS2438"
        }
      ]
    }
  ]
}
```

`server`:

* "EDS" - EDS OW-SERVER hardware platform
* "OWFS" - Uses the OWFS [`owserver`](http://owfs.org/index.php?page=owserver)

`host`: IP Address or hostname of the EDS or OWFS server

`port`: Port to use for the EDS or OWFS server

`devices`: List of 1-Wire devices that will be presented to HomeKit

* `name`: Name of the device as it will appear in HomeKit
* `address`: ROMId (EDS) or address (OWFS) of the 1-Wire device
* `type`: Type of 1-Wire device (see [`ow-devices.json`](ow-devices.json) for list)

### Optional platform settings:

`update_interval`:  Number of minutes between polls of the 1-Wire system (default: `1`)

`log_days`: Number of days of Fakegato history to log for sensors (default: `365`)

`quiet`: If set to `true`, logging will only happen for errors.  If not present or set to "false", log will contain entries for each sensor reading. (default: `false`)

## Credits

See [CONTRIBUTORS](CONTRIBUTORS.md) for acknowledgements to the individuals that contributed to this plugin.

## Some asks for friendly gestures

If you use this and like it - please leave a note by staring this package here or on GitHub.

If you use it and have a problem, file an issue at [GitHub](https://github.com/rnilsson/homebridge-onewire/issues) - I'll try to help.

If you tried this, but don't like it: tell me about it in an issue too. I'll try my best
to address these in my spare time.

If you fork this, go ahead - I'll accept pull requests for enhancements.

## License

MIT License

Copyright (c) 2018 Robert Nilsson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.