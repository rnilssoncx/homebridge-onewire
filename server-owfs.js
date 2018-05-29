'use strict';

const OWClient = require("owjs").Client;
const Q = require('q');
const owDevices = require('./ow-devices.json');

class ServerOWFS {
  constructor(log, config) {
    this.log = log;
    this.host = config.host;
    this.port = config.port;
    this.owServer = new OWClient({ host: this.host, port: this.port });
    this.log(`Initialized OWFS Server at ${this.host}:${this.port}`);
  }

  getState(deviceList, callback) {
    let owReads = [];
    let cleanJSON = {};

    for (let device of Object.keys(deviceList)) {
      cleanJSON[device] = {};
      for (let attribute of Object.keys(owDevices[deviceList[device].type].OWFSServer)) {
        owReads.push(this._owRead('/' + deviceList[device].address + '/' + owDevices[deviceList[device].type].OWFSServer[attribute][0],
          device, attribute));
      }
    }
    Q.allSettled(owReads)
      .then(function (results) {
        for (let result of results) {
          if (result.state === "fulfilled") {
            let data = result.value;
            cleanJSON[data.device][data.attribute] = Math.round(parseFloat(data.value.replace(/[^\d.-]/g, '')) * 10) / 10;
          }
        }
        callback(null, cleanJSON);
      }.bind(this));
  }

  _owRead(path, device, attribute) {
    return new Promise((resolve, reject) => {
      this.owServer.read(path)
        .then(function (result) {
          result.device = device;
          result.attribute = attribute;
          resolve(result);
        }.bind(this), function (error) {
          this.log.error(`OWFS Server failed to read ${path}`);
          reject(error);
        }.bind(this))
    })
  }
}

module.exports = ServerOWFS;