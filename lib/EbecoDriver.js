'use strict';

const Homey = require('homey');
const { getStatus, doRequest } = require('./Utils');

class EbecoDriver extends Homey.Driver {

  onInit() {
  }

  async onPairListDevices() {
    if (this.homey.settings.get('email') === '' || this.homey.settings.get('email') === null) {
      this.log('No email in app settings.');
      throw new Error('You must add your email in app settings before running.');
    }
    if (this.homey.settings.get('password') === '' || this.homey.settings.get('password') === null) {
      this.log('No password in app settings.');
      throw new Error('You must add your password in app settings before running.');
    }

    let thermostats = [];
    this.log('Start requesting thermostat info from Ebeco Connect...');

    thermostats = await this.getThermostatData().then();

    this.log('Thermostat data collection done!');

    // return devices when searching is done
    return thermostats;
  }

  async getThermostatData() {
    const url = 'https://ebecoconnect.com/api/services/app/Devices/GetUserDevices';
    this.log('Requesting thermostat data');
    const devices = [];

    const content = await doRequest(this.homey, url, 'GET', null)
      .then(res => res)
      .catch(err => this.log(err));

    if (content) {
      for (let i = 0; i < content.result.length; i++) {
        const status = getStatus('temperatureFloor', content.result[i]);
        this.log(status);
        const device = {
          name: status.name,
          data: {
            name: status.name,
            id: status.id,
          },
        };
        devices.push(device);
      }
    }

    return devices;
  }

}

module.exports = EbecoDriver;
