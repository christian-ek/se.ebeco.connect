'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const { getStatus, renewAuthorizationToken } = require('./Utils');

class EbecoDevice extends Homey.Device {

  async onInit() {
    this.device = this.getData();

    await renewAuthorizationToken(this.homey);
    this.log('Authorization Token: ' + this.homey.settings.get('token'));

    const updateInterval = Number(this.getSetting('interval')) * 1000 * 60;
    this.log('Update Interval (' + updateInterval + ')');
    const {device} = this;
    this.log(`[${this.getName()}]`, `Connected to device - ID: ${device.id}`);
    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData() {
    const {device} = this;
    this.log(`${this.getName()} - Refresh device - ID: ${device.id}`);
    const urlBase = "https://ebecoconnect.com/api/services/app/Devices/GetUserDeviceById?id=";
    const url = urlBase + device.id;

    this.log('Requesting device information:', url);

    fetch(`${url}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + this.homey.settings.get('token'),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Abp.TenantId': 1
      },
    }).then(async response => {
      if (response.ok) {
        response.json().then((data) => {
          const status = getStatus(data.result);
          this.log(status);
          this.setCapabilityValue('target_temperature', status.target_temperature).catch(this.error);
          this.setCapabilityValue('measure_temperature', status.measure_temperature).catch(this.error);
        });
      } else if (response.status === 401) {
        this.log('Unauthorized, renewing token.');
        await renewAuthorizationToken(this.homey);
      } else {
        throw new Error('There is something wrong');
      }
    }).catch(error => {
      this.log(error);
      throw new Error(error);
    });
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
    const {device} = this;
    let url;
    let method;
    let data;

    /* Make sure authorization token is OK */
    await renewAuthorizationToken(this.homey);

    switch (capability) {
      case 'target_temperature':
        url = "https://ebecoconnect.com/api/services/app/Devices/UpdateUserDevice";
        method = "PUT";
        data = {
          "temperatureSet": this.getCapabilityValue('target_temperature'),
          "id": device.id
        }
        break;
    }

    this.log('Requesting device update:', url);
    this.log('with data:', data);

    fetch(`${url}`, {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + this.homey.settings.get('token'),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Abp.TenantId': 1
      },
      body: JSON.stringify(data)
    }).then(async response => {
      if (response.ok) {
        response.json().then((data) => {
          return data;
        });
      } else {
        throw new Error('There is something wrong');
      }
    }).catch(error => {
      this.log(error);
      throw new Error(error);
    });
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

  async onSettings({oldSettings, newSettings, changedKeys}) {
    const {interval} = this;
    if (oldSettings.interval !== newSettings.interval) {
      this.log(`Delete old interval of ${oldSettings.interval} min and creating new ${newSettings.interval} min`);
      clearInterval(interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  onDeleted() {
    const {interval, device} = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }

}

module.exports = EbecoDevice;
