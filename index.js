'use strict';

const platformPrettyName = 'OneWire';
const platformName = require('./package.json').name;
const version = require('./package.json').version;

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
    this.devices = {};
    this.server = new servers[config.server || 'EDS'](log, config);
    for (var device of config.devices) {
      this.devices[device.address] = device;
    }
  }

  accessories(callback) {
    let _accessories = [];
    for (var device of Object.values(this.devices)) {
      this.log(`Found device in config: "${device.name}"`);
      if (owDevices[device.type]) {
        const accessory = new OWAccessory(this.log, device, this.api, version, this.createLogger.bind(this));
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
      size: 4032,
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
      this.devices[device].accessory.setState(deviceState[device]);
    }
  }
}
