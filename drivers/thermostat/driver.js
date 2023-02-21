'use strict';

const Homey = require('homey');
const EbecoApi = require('../../lib/api.js');

class ThermostatDriver extends Homey.Driver {

  onInit() {
  }

  // Pairing
  async onPair(session) {
    let username = '';
    let password = '';

    session.setHandler('login', async data => {
      username = data.username;
      password = data.password;

      this.api = new EbecoApi(username, password, this.homey);

      const credentialsAreValid = await this.api.login();

      // return true to continue adding the device if the login succeeded
      // return false to indicate to the user the login attempt failed
      // thrown errors will also be shown to the user
      return credentialsAreValid;
    });

    session.setHandler('list_devices', async () => {
      this.api.login();

      const myDevices = await this.api.getUserDevices();

      this.log(myDevices);
      const devices = myDevices.map(myDevice => {
        return {
          name: myDevice.displayName,
          data: {
            id: myDevice.id,
            name: myDevice.displayName,
          },
          settings: {
            // Store username & password in settings
            // so the user can change them later
            username,
            password,
            interval: 30,
            regulator: 'temperatureFloor',
          },
        };
      });

      return devices;
    });

    session.setHandler('list_devices_selection', async data => {
      this.homey.app.log(`[Driver] ${this.id} - selected_device - `, data[0].name);
      this.device = data[0];
    });

    session.setHandler('select_regulator', async data => {
      this.homey.app.log(`[Driver] ${this.id} - selected_regulator - `, data);
      this.device.settings.regulator = data;
      return this.device;
    });
  }

}

module.exports = ThermostatDriver;
