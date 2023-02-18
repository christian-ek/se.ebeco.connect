'use strict';

const Homey = require('homey');
const EbecoApi = require('../../lib/api.js');

class ThermostatDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();
    const settings = this.getSettings();
    const firstRun = this.getStoreValue('first_run');

    if (firstRun != null && firstRun) {
      /* During the first run we remove the target_temperature sub capability
       * which is connected to the regulator that is not in use.
       * The user selects regulator during setup.
       */

      if (this.getSetting('regulator') === 'temperatureFloor') {
        this.removeCapability('target_temperature.temperatureRoom');
      } else if (this.getSetting('regulator') === 'temperatureRoom') {
        this.removeCapability('target_temperature.temperatureFloor');
      }

      this.setStoreValue('first_run', false);
    }

    this.api = new EbecoApi(settings.username, settings.password, this.homey);

    const updateInterval = Number(settings.interval) * 1000;

    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);

    this.registerCapabilityListener(`target_temperature.${this.getSetting('regulator')}`, this.onCapabilitySetTemperature.bind(this));

    await this.getDeviceData();

    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    const { device } = this;

    await this.api.getDevice(device.id)
      .then(data => {
        this.log(data);

        this.setCapabilityValue(`target_temperature.${this.getSetting('regulator')}`, parseFloat(data.temperatureSet)).catch(this.error);

        this.setCapabilityValue('measure_temperature.temperatureFloor', data.temperatureFloor).catch(this.error);
        this.setCapabilityValue('measure_temperature.temperatureRoom', data.temperatureRoom).catch(this.error);
        if (data.relayOn) {
          this.setCapabilityValue('measure_power', data.installedEffect).catch(this.error);
        } else {
          this.setCapabilityValue('measure_power', 0.5).catch(this.error);
        }
      });
  }

  async onCapabilitySetTemperature(value) {
    try {
      await this.setCapabilityValue(`target_temperature.${this.getSetting('regulator')}`, value);
      await this.updateCapabilityValues(`target_temperature.${this.getSetting('regulator')}`);
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
  }

  async updateCapabilityValues(capability) {
    const { device } = this;

    const data = {
      temperatureSet: this.getCapabilityValue(`target_temperature.${this.getSetting('regulator')}`),
      id: device.id,
    };

    return this.api.updateDeviceState(data)
      .then(res => res)
      .catch(err => this.log(err));
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

    this.log('store', this.getStore());
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
