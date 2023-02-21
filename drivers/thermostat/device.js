'use strict';

const Homey = require('homey');
const EbecoApi = require('../../lib/api.js');

class ThermostatDevice extends Homey.Device {

  async onInit() {
    this.pauseDeviceUpdates = false;
    this.device = this.getData();
    const settings = this.getSettings();

    /* Add support for older versions of the app,
     * where username and password were in the app settings */
    if (this.homey.settings.get('email') !== null && this.homey.settings.get('email') !== ''
          && this.homey.settings.get('password') !== null && this.homey.settings.get('password') !== '') {
      this.setSettings({
        username: this.homey.settings.get('email'),
        password: this.homey.settings.get('password'),
        interval: 30,
      });

      this.homey.settings.set('email', '');
      this.homey.settings.set('password', '');
      this.homey.settings.set('interval', '');
    }

    this.api = new EbecoApi(settings.username, settings.password, this.homey);

    const updateInterval = Number(settings.interval) * 1000;

    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);

    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));

    await this.getDeviceData();

    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    const { device } = this;

    await this.api.getDevice(device.id)
      .then(data => {
        if (!this.pauseDeviceUpdates) {
          this.setCapabilityValue('target_temperature', parseFloat(data.temperatureSet)).catch(this.error);
        }

        if (this.getSetting('regulator') === 'temperatureFloor') {
          this.setCapabilityValue('measure_temperature', data.temperatureFloor).catch(this.error);
          this.setCapabilityValue('measure_temperature.alt', data.temperatureRoom).catch(this.error);
        } else if (this.getSetting('regulator') === 'temperatureRoom') {
          this.setCapabilityValue('measure_temperature', data.temperatureRoom).catch(this.error);
          this.setCapabilityValue('measure_temperature.alt', data.temperatureFloor).catch(this.error);
        }
        if (data.relayOn) {
          this.setCapabilityValue('measure_power', data.installedEffect).catch(this.error);
        } else {
          this.setCapabilityValue('measure_power', 0.5).catch(this.error);
        }
      })
      .catch(err => this.error(err));
  }

  async setTempCapabilitiesOptions(regulator) {
    this.log('Updating measure_temperature and measure_temperature.alt capabilitiesOptions');

    const floorOptions = {
      decimals: 0,
      title: {
        en: 'Floor temperature',
        sv: 'Golvtemperatur',
      },
    };

    const roomOptions = {
      decimals: 0,
      title: {
        en: 'Room temperature',
        sv: 'Rumstemperatur',
      },
    };

    if (regulator === 'temperatureFloor') {
      this.setCapabilityOptions('measure_temperature', floorOptions);
      this.setCapabilityOptions('measure_temperature.alt', roomOptions);
    } else if (regulator === 'temperatureRoom') {
      this.setCapabilityOptions('measure_temperature', roomOptions);
      this.setCapabilityOptions('measure_temperature.alt', floorOptions);
    }
  }

  async onCapabilitySetTemperature(value) {
    try {
      await this.setCapabilityValue('target_temperature', value);
      await this.updateCapabilityValues('target_temperature');
      /* Pause device from updating temperature for 2 minutes
      so that the API will return the correct target temp */
      this.pauseDeviceUpdates = true;
      setTimeout(() => {
        this.pauseDeviceUpdates = false;
      }, 120000);
    } catch (err) {
      this.error(err);
    }
  }

  async updateCapabilityValues(capability) {
    const { device } = this;

    const data = {
      temperatureSet: this.getCapabilityValue('target_temperature'),
      id: device.id,
    };

    return this.api.updateDeviceState(data)
      .catch(err => this.error(err));
  }

  onAdded() {
    this.log('device added');
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
    this.log('settings', {
      username: this.getSetting('username'),
      interval: this.getSetting('interval'),
      regulator: this.getSetting('regulator'),
    });

    this.setTempCapabilitiesOptions(this.getSetting('regulator'));
  }

  onRenamed(name) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval) {
    const updateInterval = Number(newInterval) * 1000;
    this.log(`Creating update interval with ${updateInterval}`);
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }) {
    const { interval } = this;
    for (const name of changedKeys) {
      /* Log setting changes except for password */
      if (name !== 'password') {
        this.log(`Setting '${name}' set '${oldSettings[name]}' => '${newSettings[name]}'`);
      }
      if (name === 'regulator') {
        await this.setTempCapabilitiesOptions(newSettings[name]);
      }
    }
    if (oldSettings.interval !== newSettings.interval) {
      this.log(`Delete old interval of ${oldSettings.interval}s and creating new ${newSettings.interval}s`);
      clearInterval(interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  onDeleted() {
    const { interval, device } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = ThermostatDevice;
