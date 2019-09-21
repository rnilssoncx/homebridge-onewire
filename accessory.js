'use strict';

const moment = require('moment');

let Accessory, Characteristic, Service;

const owDevices = require('./ow-devices.json');

class OWAccessory {
  constructor(log, config, api, version, quiet, createLogger, server) {
    Accessory = api.hap.Accessory;
    Characteristic = api.hap.Characteristic;
    Service = api.hap.Service;

    this.log = log;
    this.log(`Creating device: ${config.address} - ${config.type}`);
    this.serialNumber = config.address;
    this.name = config.name;
    this.type = config.type;
    this.version = version;
    this.quiet = quiet;
    this.state = {};
    this.services = {};
    this.inputs = [];
    this._factories = {
      temperature: this._temperatureService.bind(this),
      humidity: this._humidityService.bind(this),
      humidistat: this._humidistatService.bind(this)
    }
    this.createLogger = createLogger;
    this.server = server;
  }

  getServices() {
    let services = [];
    let logValues = [];

    services.push(this.getAccessoryInformationService());

    for (var capability of owDevices[this.type].services) {
      services.push(this._factories[capability]());
      logValues.push(capability)
    }
    if (owDevices[this.type].logger) {
      services[services.length - 1].log = this.log;
      this.loggingService = this.createLogger(owDevices[this.type].logger, services[services.length - 1]);
      services.push(this.loggingService);
      logValues.push('FakeGato History')
    }
    this.log(`-> ${logValues.join(', ')}`);

    return services;
  }

  getAccessoryInformationService() {
    return new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Dallas Semiconductor')
      .setCharacteristic(Characteristic.Model, this.type)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
      .setCharacteristic(Characteristic.FirmwareRevision, this.version)
      .setCharacteristic(Characteristic.HardwareRevision, this.version);
  }

  _temperatureService() {
    this.inputs.push('temperature');

    this._temperatureService = new Service.TemperatureSensor(this.name);
    this.services['temperature'] = this._temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature);
    this.services['temperature']
      .setProps({ minValue: -100, maxValue: 100, minStep: 0.1 })
      .on('get', this.getState.bind(this, 'temperature'));
    return this._temperatureService;
  }

  _humidityService() {
    this.inputs.push('humidity');

    this._humidityService = new Service.HumiditySensor(this.name);
    this.services['humidity'] = this._humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity);
    this.services['humidity']
      .on('get', this.getState.bind(this, 'humidity'));
    return this._humidityService;
  }

  _humidistatService() {
    this.inputs.push('humidity', 'humidex', 'relayControl', 'relayState', 'alarmState', 'threshold');

    this._humidistat = new Service.HumidifierDehumidifier(this.name);

    this._humidistat.addCharacteristic(Characteristic.CurrentHumidex);
    this.services.humidex = this._humidistat
      .getCharacteristic(Characteristic.CurrentHumidex);
    this.services.humidex
      .on('get', this.getState.bind(this, 'humidex'));

    this.services.humidity = this._humidistat
      .getCharacteristic(Characteristic.CurrentRelativeHumidity);
    this.services.humidity
      .on('get', this.getState.bind(this, 'humidity'));

    this.services.currentState = this._humidistat
      .getCharacteristic(Characteristic.CurrentHumidifierDehumidifierState);
    this.services.currentState
      .setProps({
        validValues: [0, 1, 3]
      });
    this.services.currentState
      .on('get', this.getState.bind(this, 'currentState'));

    this.services.targetState = this._humidistat
      .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState);
    this.services.targetState
      .setProps({
        validValues: [2] // Only allow humidification
      });
    this.services.targetState
      .on('get', this.getState.bind(this, 'targetState'))
      .on('set', this.setState.bind(this, 'targetState'));

    this.services.active = this._humidistat
      .getCharacteristic(Characteristic.Active);
    this.services.active
      .on('get', this.getState.bind(this, 'active'))
      .on('set', this.setState.bind(this, 'active'));

    this.services.threshold = this._humidistat
      .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold);
    this.services.threshold
      .on('get', this.getState.bind(this, 'threshold'))
      .on('set', this.setState.bind(this, 'threshold'));

    return this._humidistat;
  }

  identify(callback) {
    this.log(`Identify requested on ${this.name}`);
    callback();
  }

  updateState(device) {
    const fG = { 'temperature': 'temp', 'humidity': 'humidity' };
    let logData = { 'time': moment().unix() };
    let logValues = [];
    let problem = false;
    let humidistat = false;
    let changes = {};

    if (typeof device == 'undefined') {
      this.log(`${this.name} - no data received`);
      return;
    }
    for (var input of this.inputs) {
      if (input in device) { // Did we get a reading?
        switch (input) {
          case 'temperature':
          case 'humidity':
            changes[input] = device[input];
            logData[fG[input]] = device[input];
            break;
          case 'humidex':
            changes[input] = device[input];
            break;
          case 'threshold':
            changes[input] = device[input];
            humidistat = true;
            break;
        }
      } else {
        logValues.push(`${input}: No data available`)
        switch (input) {
          case ('temperature'):
          case ('humidity'):
          case ('humidex'):
            if (input in this.state) {
              delete this.state[input];
            }
            break;
          case ('threshold'):
            changes.currentState = 0;
            changes.active = 0;
            break;
          default:
        }
        problem = true;
      }
    }

    if (humidistat) {
      if (typeof this.state.targetState == 'undefined') {
        changes.targetState = 2;
      }
      if (device.relayControl == 'off') {
        changes.currentState = 1;
        changes.active = 0;
      } else if (device.relayControl.startsWith('auto')) {
        if (device.alarmState) {
          changes.currentState = 3;
          changes.active = 1;
        } else {
          changes.currentState = 1;
          changes.active = 1;
        }
      } else { // Relay is set to manual control
        if (device.relayState) { // Active
          changes.currentState = 3;
          changes.active = 1;
        } else {
          changes.currentState = 1;
          changes.active = 1;
        }
      }
    }

    for (let element of Object.keys(changes)) {
      if (this.state[element] != changes[element]) {
        this.state[element] = changes[element];
        this.services[element]
          .updateValue(this.state[element], null);
        logValues.push(`${element} -> ${changes[element]}`)
      }
    }
    if (this.loggingService) {
      this.loggingService.addEntry(logData);
      logValues.push('logged');
    }
    if (!this.quiet || problem) {
      this.log(`${this.name} - ${logValues.join(', ')}`);
    }
  }

  getState(value, callback) {
    if (value in this.state) {
      this.log(`${this.name} get state - ${value}: ${this.state[value]}`);
      callback(null, this.state[value])
    } else {
      this.log(`${this.name} get state - ${value} not set`);
      callback(new Error(`Error: No ${value} set for ${this.name}`));
    }
  }

  setState(attribute, value, callback) {
    let writes = [];

    this.log(`${this.name} set state - ${attribute}: ${value}`);
    switch (attribute) {
      case 'active':
        let controlValue = (value == 0 ? 3 : 0);
        this.server.setState(this.serialNumber, 'relayControl', controlValue).then(function (data) {
          this.state[attribute] = value;
          this.server.setState(this.serialNumber, 'LEDControl', controlValue).catch(function (error) {
            this.log(`Failed to set LED state to ${controlValue}`);
          }.bind(this));
          callback();
        }.bind(this), function (error) {
          this.log(`Failed to set ${attribute} to ${value}`);
          callback(error);
        }.bind(this));
        break;
      case 'targetState':
        if (value != 2) {
          callback(new Error(`Only dehumidification supported`));
          // this.services[attribute].updateValue(this.state[attribute],null);
        }
        callback();
        break;
      default:
        callback();
        break;
    }
  }
}

module.exports = OWAccessory;