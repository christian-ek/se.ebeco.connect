'use strict';

const Homey = require('homey');
const { getStatus, doRequest } = require('./Utils');

const regulatorSetting = null;

class EbecoDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();

    const settings = this.getSettings();
    const updateInterval = Number(settings.interval) * 1000 * 60;
    this.regulatorSetting = settings.regulator;

    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, `Update Interval: ${updateInterval}`);
    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.interval = setInterval(async () => {
      await this.getDeviceData(regulatorSetting);
    }, updateInterval);
  }

  async getDeviceData() {
    const { device } = this;
    this.log(`[${this.getName()}][${device.id}]`, 'Refresh device');

    const urlBase = 'https://ebecoconnect.com/api/services/app/Devices/GetUserDeviceById?id=';
    const url = urlBase + device.id;

    this.log('Requesting device information:', url);

    const data = await doRequest(this.homey, url, 'GET')
      .then(res => res)
      .catch(err => this.log(err));

    if (data) {
      const status = getStatus(this.regulatorSetting, data.result);
      this.log(status);
      this.setCapabilityValue('target_temperature', status.target_temperature).catch(this.error);
      this.setCapabilityValue('measure_temperature', status.measure_temperature).catch(this.error);
      if (status.relayOn) {
        this.setCapabilityValue('measure_power', status.installedEffect).catch(this.error);
      } else {
        this.setCapabilityValue('measure_power', 0.5).catch(this.error);
      }
    }
  }

  async onCapabilitySetTemperature(value) {
    try {
      await this.setCapabilityValue('target_temperature', value);
      await this.updateCapabilityValues('target_temperature');
    } catch (error) {
      this.log(error);
      throw new Error(error);
    }
  }

  async updateCapabilityValues(capability) {
    const { device } = this;
    let url;
    let method;
    let data = null;

    // eslint-disable-next-line default-case
    switch (capability) {
      case 'target_temperature':
        url = 'https://ebecoconnect.com/api/services/app/Devices/UpdateUserDevice';
        method = 'PUT';
        data = {
          temperatureSet: this.getCapabilityValue('target_temperature'),
          id: device.id,
        };
        break;
    }

    this.log('Requesting device update:', url);
    this.log('with data:', data);

    return doRequest(this.homey, url, method, data)
      .then(res => res)
      .catch(err => this.log(err));
  }

  onAdded() {
    this.log('device added');
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
  }

  onRenamed(name) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval) {
    const updateInterval = Number(newInterval) * 1000 * 60;
    this.log(`Creating update interval with ${updateInterval}`);
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    const { interval } = this;

    for (const changedKey of changedKeys) {
      if (changedKey === 'interval' && oldSettings.interval !== newSettings.interval) {
        this.log(`Delete old interval of ${oldSettings.interval} min and creating new ${newSettings.interval} min`);
        clearInterval(interval);
        this.setUpdateInterval(newSettings.interval);
      }
      if (changedKey === 'regulator' && oldSettings.regulator !== newSettings.regulator) {
        this.log(`Replacing regulator setting ${oldSettings.regulator} with ${newSettings.regulator}`);
        this.regulatorSetting = newSettings.regulator;
      }
    }
  }

  onDeleted() {
    const { interval, device } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = EbecoDevice;
