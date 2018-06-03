'use strict';

const convert = require('xml-js');
const http = require('http');
const relayControlOptions = { '0': 'auto', '1': 'auto on', '2': 'manual', '3': 'off' };
const relayState = { '0': false, '1': true };

class ServerEDS {
  constructor(log, config, quiet) {
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
      switch (element) {
        case 'Temperature':
          cleanJSON.temperature = this._temperature(device[element]._text, device[element]._attributes.Units);
          break;
        case 'Humidity':
          cleanJSON.humidity = this._percentage(device[element]._text);
          break;
        case 'Humidex':
          cleanJSON.humidex = this._percentage(device[element]._text);
          break;
        case 'RelayFunction':
          cleanJSON.relayControl = relayControlOptions[device[element]._text];
          break;
        case 'RelayState':
          cleanJSON.relayState = relayState[device[element]._text];
          break;
        case 'TemperatureHighAlarmState':
        case 'TemperatureLowAlarmState':
        case 'HumidityHighAlarmState':
        case 'HumidityLowAlarmStat':
        case 'DewPointHighAlarmState':
        case 'DewPointLowAlarmState':
        case 'HumidexHighAlarmState':
        case 'HumidexLowAlarmState':
        case 'HeatIndexHighAlarmState':
        case 'HeatIndexLowAlarmState':
          if (device[element]._text == '1') {
            cleanJSON.alarmState = true;
          } else if (typeof cleanJSON.alarmState == 'undefined') {
            cleanJSON.alarmState = false;
          }
          break;
        case 'HumidexHighAlarmValue': // Hard code to Humidex
          cleanJSON.threshold = parseInt(device[element]._text);
          break;
        default:
        // cleanJSON[element] = device[element]._text;
      }
    }
    return cleanJSON;
  }

  _temperature(value, units, precision = 1) {
    const factor = Math.pow(10, precision);
    const temperature = parseFloat(value);

    switch (units) {
      case 'Centigrade':
        break;
      case 'Farenheight':
        temperature = ((temperature - 32) * 5) / 9;;
        break;
    }
    return Math.round(temperature * factor) / factor;
  }

  _percentage(value, precision = 0) {
    const factor = Math.pow(10, precision);
    const percentage = parseFloat(value);

    return Math.round(percentage * factor) / factor;
  }

  setState(rom, attribute, value) {
    const translate = {
      'threshold': 'HumidexHighAlarmValue',
      'relayControl': 'RelayFunction',
      'LEDControl': 'LEDFunction',
      'RelayState': 'RelayState'
    };
    const callParms = {'rom': rom, 'attribute': attribute, 'value': value};

    attribute = translate[attribute];
    return new Promise((resolve, reject) => {
      if (typeof attribute == 'undefined') {
        this.log(`Undefined element: ${callParms}`);
        let error = new Error(`Undefined element: ${attribute}`);
        error.callParms = callParms;
        reject(error);
      }
      http.get({ hostname: this.host, port: this.port, path: `/devices.htm?rom=${rom}&variable=${attribute}&value=${value}` }, (resp) => {
        if (resp.statusCode != 200) {
          this.log(`Failed to set value: ${callParms}`);
          let error = new Error(`Failed to set value: ${callParms} - Response: ${resp.statusCode}`);
          error.callParms = callParms;
          reject(error);
        }
        resolve(callParms);
      }).on("error", (error) => {
        this.log(`Failed to set value: ${callParms} - Response: ${resp.statusCode}`);
        error.callParms = callParms;
        reject(error);
      });
    })
  }
}

module.exports = ServerEDS;