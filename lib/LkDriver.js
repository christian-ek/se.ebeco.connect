'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const { getStatus } = require('./Utils');

class LkDriver extends Homey.Driver {

  onInit() {
  }

  async onPairListDevices() {
    if (this.homey.settings.get('ip') === '') {
      this.log('No IP in app settings.');
      throw new Error('You must add IP in app settings before running.');
    }
    if (this.homey.settings.get('password') === '') {
      this.log('No password in app settings.');
      throw new Error('You must add LK webserver password in app settings before running.');
    }
    const thermostats = [];
    this.log('Start requesting thermostat info from LK Webserver...');

    const activeThermostatIds = await this.getActiveThermostats();

    for (let i = 0; i < activeThermostatIds.length; i++) {
      await this.getThermostatData(activeThermostatIds[i]).then(
        res => thermostats.push(res),
      );
    }

    this.log('Thermostat data collection done!');

    // return devices when searching is done
    return thermostats;
  }

  async getActiveThermostats() {
    const urlBase = `http://${this.homey.settings.get('ip')}`;
    const password = this.homey.settings.get('password');
    const auth = `Basic ${Buffer.from(`lk:${password}`).toString('base64')}`;
    const url = `${urlBase}/main.json`;

    this.log('Requesting list of active devices');
    const devices = [];

    try {
      const response = await fetch(`${url}`, {
        method: 'GET',
        headers: {
          Authorization: auth,
        },
      });

      if (response.ok) {
        const result = await response.json();
        for (let i = 0; i < result.active.length; i++) {
          if (result.active[i] === '1') {
            devices.push(i + 1);
          }
        }
      }
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
    this.log(`Got thermostat ids: ${devices}`);
    return devices;
  }

  async getThermostatData(i) {
    const urlBase = `http://${this.homey.settings.get('ip')}`;
    const password = this.homey.settings.get('password');
    const auth = `Basic ${Buffer.from(`lk:${password}`).toString('base64')}`;
    const url = `${urlBase}/thermostat.json?tid=${i}`;
    this.log('Requesting thermostat data:', url);
    let device = {};

    try {
      const response = await fetch(`${url}`, {
        method: 'GET',
        headers: {
          Authorization: auth,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const status = getStatus(result);
        device = {
          name: status.name,
          data: {
            name: status.name,
            id: i,
          },
        };
      }
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
    return device;
  }

}

module.exports = LkDriver;
