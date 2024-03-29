'use strict';

const Homey = require('homey');
const EbecoApi = require('../../lib/api.js');

class ThermostatDevice extends Homey.Device {

  async onInit() {
    this.pauseDeviceUpdates = false;
    this.device = this.getData();
    this.log('device loaded');
    this.printInfo();

    this.api = new EbecoApi(this.getSetting('username'), this.getSetting('password'), this.homey);

    let updateInterval = Number(this.getSetting('interval')) * 1000;

    if (!updateInterval || updateInterval < 10000) {
      /* We never want to end up in a state where updateInterval is below 10000 */
      updateInterval = 10000;
    }

    this.log(`[${this.getName()}][${this.device.id}]`, `Update Interval: ${updateInterval}`);

    // New capabilites added in version 2.2.0 Can be removed once all installations are updated.
    if (!this.hasCapability('onoff')) {
      try {
        await this.addCapability('onoff');
        this.log('onoff capability added successfully');
      } catch (error) {
        this.error('Error adding onoff capability:', error);
      }
    }
    if (!this.hasCapability('thermostat_program')) {
      try {
        await this.addCapability('thermostat_program');
        this.log('thermostat_program capability added successfully');
      } catch (error) {
        this.error('Error adding thermostat_program capability:', error);
      }
    }
    // End of removable code.

    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.registerCapabilityListener('onoff', this.onCapabilitySetOnOff.bind(this));
    this.registerCapabilityListener('thermostat_program', this.onCapabilitySetThermostatProgram.bind(this));

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
        this.setCapabilityValue('onoff', data.powerOn).catch(this.error);
        this.setCapabilityValue('thermostat_program', data.selectedProgram).catch(this.error);
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
      await this.updateCapabilityValues();
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

  async onCapabilitySetThermostatProgram(value) {
    /**
     * Not allowed to set these values.
     * They are only for representation in case they are set on the thermostat.
     * */
    const notAllowedValues = ['Hotel', 'Remote'];

    // Check if the value is in the notAllowedValues list, in that case we do nothing
    if (notAllowedValues.includes(value)) {
      return;
    }

    try {
      await this.setCapabilityValue('thermostat_program', value);
      await this.updateCapabilityValues();
    } catch (err) {
      this.error(err);
    }
  }

  async onCapabilitySetOnOff(value) {
    try {
      await this.setCapabilityValue('onoff', value);
      await this.updateCapabilityValues();
    } catch (err) {
      this.error(err);
    }
  }

  async updateCapabilityValues() {
    const { device } = this;

    const data = {
      id: device.id,
      powerOn: this.getCapabilityValue('onoff'),
      selectedProgram: this.getCapabilityValue('thermostat_program'),
      temperatureSet: this.getCapabilityValue('target_temperature'),
    };

    return this.api.updateDeviceState(data)
      .catch(err => this.error(err));
  }

  printInfo() {
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
    this.log('settings', {
      username: this.getSetting('username'),
      interval: this.getSetting('interval'),
      regulator: this.getSetting('regulator'),
    });
  }

  onAdded() {
    this.log('device added');
    this.printInfo();
    this.setTempCapabilitiesOptions(this.getSetting('regulator'));
  }

  onRenamed(name) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval) {
    let updateInterval = Number(newInterval) * 1000;
    if (!updateInterval || updateInterval < 10000) {
      /* We never want to end up in a state where updateInterval is below 10000 */
      updateInterval = 10000;
    }
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
