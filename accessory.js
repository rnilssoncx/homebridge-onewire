'use strict';

const moment = require('moment');

let Accessory, Characteristic, Service;

const owDevices = require('./ow-devices.json');

class OWAccessory {
  constructor(log, config, api, version, createLogger) {
    Accessory = api.hap.Accessory;
    Characteristic = api.hap.Characteristic;
    Service = api.hap.Service;

    this.log = log;
    this.log(`Creating device: ${config.address} - ${config.type}`);
    this.serialNumber = config.address;
    this.name = config.name;
    this.type = config.type;
    this.version = version;
    this.state = {};
    this.services = {};
    this._factories = {
      temperature: this._temperatureService.bind(this),
      humidity: this._humidityService.bind(this)
    }
    this.createLogger = createLogger;
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
    this._temperatureService = new Service.TemperatureSensor(this.name);
    this.services['temperature'] = this._temperatureService
      .getCharacteristic(Characteristic.CurrentTemperature);
    this.services['temperature']
      .setProps({ minValue: -100, maxValue: 100, minStep: 0.1 })
      .on('get', this.getState.bind(this, 'temperature'));
    return this._temperatureService;
  }

  _humidityService() {
    this._humidityService = new Service.HumiditySensor(this.name);
    this.services['humidity'] = this._humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity);
    this.services['humidity']
      .on('get', this.getState.bind(this, 'humidity'));
    return this._humidityService;
  }

  identify(callback) {
    this.log(`Identify requested on ${this.name}`);
    callback();
  }

  setState(device) {
    const fG = { 'temperature': 'temp', 'humidity': 'humidity' };
    let logData = { 'time': moment().unix() };
    let logValues = [];

    for (var capability of owDevices[this.type].services) {
      if (capability in device) { // Did we get a reading?
        switch (capability) {
          case 'temperature':
          case 'humidity':
            logValues.push(`${capability}: ${device[capability]}`)
            this.services[capability]
              .updateValue(device[capability], null);
            logData[fG[capability]] = device[capability];
            this.state[capability] = device[capability];
            break;
        }
      } else {
        logValues.push(`${capability}: No data available`)
        if (this.state[capability]) {
          delete this.state[capability];
        }
      }
    }
    if (this.loggingService) {
      this.loggingService.addEntry(logData);
      logValues.push('logged');
    }
    this.log(`${this.name} - ${logValues.join(', ')}`);
  }

  getState(service, callback) {
    if (this.state[service]) {
      callback(null, this.state[service])
    } else {
      callback(new Error(`Error: No ${service} set for ${this.name}`));
    }
  }
}

module.exports = OWAccessory;