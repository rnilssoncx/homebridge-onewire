'use strict';

const convert = require('xml-js');
const http = require('http');

class ServerEDS {
  constructor (log, config, quiet) {
    this.log = log;
    this.quiet = quiet;
    this.host = config.host;
    this.port = config.port;
    this.log(`Initialized EDS OW-Server at ${this.host}:${this.port}`);
  }

  getState(deviceList, callback) {
    if (!this.quiet) {
      this.log(`Pulling update from ${this.host}`);
    }
    http.get({ hostname: this.host, port: this.port, path: '/details.xml' }, (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received.
      resp.on('end', () => {
        this._processXML(data, callback);
      });
    }).on("error", (error) => {
      this.log('Failed to get update from server');
      callback(error);
    });

  }

  _processXML(data, callback) {
    let newReading = {};
  
    let options = { compact: true };
    let json = convert.xml2js(data, options);

    let jsonDetails = json['Devices-Detail-Response'];
    if (jsonDetails) {
      let deviceList = Object.keys(jsonDetails).filter(v => v.startsWith('owd_'));
      for (let deviceType of deviceList) {
        if (Array.isArray(jsonDetails[deviceType])) {
          for (let device of jsonDetails[deviceType]) {
            newReading[device.ROMId._text] = this._cleanJSON(device);
          }
        } else {
          newReading[jsonDetails[deviceType].ROMId._text] = this._cleanJSON(jsonDetails[deviceType]);
        }
      }
      callback(null, newReading);
    } else {
      callback(new Error(`Failed to process XML`));
    }
  }

  _cleanJSON(device) {
    let cleanJSON = {};
    
    for (var element of Object.keys(device)) {
      switch(element) {
        case 'Temperature':
          cleanJSON.temperature = this._temperature(device[element]._text, device[element]._attributes.Units);
          break;
        case 'Humidity':
          cleanJSON.humidity = this._humidity(device);
          break;
        default:
          cleanJSON[element] = device[element]._text;
      }
    }
    return cleanJSON;
  }

  _temperature(value, units, precision = 1) {
    var factor = Math.pow(10, precision);
    var temperature = parseFloat(value);

    switch (units) {
      case 'Centigrade':
        break;
      case 'Farenheight':
        temperature = ((temperature - 32) * 5) / 9;;
        break;
    }
    return Math.round(temperature * factor) / factor;
  }

  _humidity(device, precision = 1) {
    var factor = Math.pow(10, precision);
    var humidity = parseFloat(device['Humidity']._text);

    switch (device['Name']) {
      default:
        break;
    }

    switch (device['Humidity']._attributes.Units) {
      default:
        break;
    }
    return Math.round(humidity * factor) / factor;
  }
}

module.exports = ServerEDS;