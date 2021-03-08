'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const { getStatus, renewAuthorizationToken } = require('./Utils');

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

    await renewAuthorizationToken(this.homey);

    thermostats = await this.getThermostatData().then();

    this.log('Thermostat data collection done!');

    // return devices when searching is done
    return thermostats;
  }

  async getThermostatData() {
    const url = "https://ebecoconnect.com/api/services/app/Devices/GetUserDevices";
    this.log('Requesting thermostat data');
    const devices = [];
    const options = {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + this.homey.settings.get('token'),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Abp.TenantId': 1
      }
    }

    try {
      const response = await fetch(`${url}`, options);

      if (response.ok) {
        const content = await response.json();
        for (let i = 0; i < content.result.length; i++) {
          const status = getStatus(content.result[i]);
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
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
    return devices;
  }

}

module.exports = EbecoDriver;
