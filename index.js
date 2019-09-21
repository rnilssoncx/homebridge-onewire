'use strict';

const platformPrettyName = 'OneWire';
const platformName = require('./package.json').name;
const version = require('./package.json').version;
const inherits = require('util').inherits;

const OWAccessory = require('./accessory.js');
const owDevices = require('./ow-devices.json');

const ServerEDS = require('./server-eds.js');
const ServerOWFS = require('./server-owfs.js');
const servers = {
  'EDS': ServerEDS,
  'OWFS': ServerOWFS
}

var Accessory, Service, Characteristic, UUIDGen, FakeGatoHistoryService, CustomCharacteristic;

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  /**
   * Characteristic "Current Humidex"
   */

  Characteristic.CurrentHumidex = function () {
    Characteristic.call(this, 'Current Humidex', '21000010-0000-1000-8000-0026BB765291');
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: Characteristic.Units.PERCENTAGE,
      maxValue: 100,
      minValue: 0,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };

  inherits(Characteristic.CurrentHumidex, Characteristic);

  Characteristic.CurrentHumidex.UUID = '21000010-0000-1000-8000-0026BB765291';

  UUIDGen = homebridge.hap.uuid;
  FakeGatoHistoryService = require('fakegato-history')(homebridge);

  homebridge.registerPlatform(platformName, platformPrettyName, OneWire);
}

class OneWire {
  constructor(log, config, api) {
    this.log = log;
    this.log(`${platformPrettyName} Plugin Loaded - Version ${version}`);
    this.api = api;
    this.host = config.host || 'localhost';
    this.port = config.port || 80;
    this.update_interval = config['update_interval'] || 1; // minutes
    this.logDays = config['log_days'] || 365;
    this.quiet = config.quiet || false;
    if (this.quiet) {
      this.log('Quiet logging mode');
    }
    this.devices = {};
    this.server = new servers[config.server || 'EDS'](log, config, this.quiet);
    for (var device of config.devices) {
      this.devices[device.address] = device;
    }
  }

  accessories(callback) {
    let _accessories = [];
    for (var device of Object.values(this.devices)) {
      this.log(`Found device in config: "${device.name}"`);
      if (owDevices[device.type]) {
        const accessory = new OWAccessory(this.log, device, this.api, version, this.quiet, this.createLogger.bind(this), this.server);
        this.devices[device.address].accessory = accessory;
        _accessories.push(accessory);
      } else {
        this.log.warn(`Device not added, unknown Type:  ${device.type}`)
        delete this.devices[device.address];
      }
    }

    callback(_accessories);
    this.updateDevices();
    this._timer = setInterval(this.updateDevices.bind(this), this.update_interval * 60000);
  }

  createLogger(type, accessory) {
    return new FakeGatoHistoryService(type, accessory, {
      size: this.logDays * 24 * 6, // Fakegato logs a data point every 10 minutes
      storage: 'fs'
    });
  }

  updateDevices() {
    this.server.getState(this.devices, this._processUpdate.bind(this));
  }

  _processUpdate(error, deviceState) {
    if (error) {
      return error;
    }
    for (var device of Object.keys(this.devices)) {
      this.devices[device].accessory.updateState(deviceState[device]);
    }
  }
}
