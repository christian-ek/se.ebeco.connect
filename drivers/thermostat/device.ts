"use strict";

import Homey from "homey";
import { EbecoApi } from "../../lib/api";
import type {
  Device,
  ThermostatProgram,
  TemperatureRegulator,
} from "../../lib/ebeco-types";
import type {
  DeviceData,
  DeviceSettings as ThermostatSettings,
} from "../../lib/driver-types";

class ThermostatDevice extends Homey.Device {
  declare homey: any;
  private pauseDeviceUpdates: boolean = false;
  private device!: DeviceData;
  private api!: EbecoApi;
  private interval!: NodeJS.Timeout;

  async onInit(): Promise<void> {
    this.pauseDeviceUpdates = false;
    this.device = this.getData();
    this.log("device loaded");
    this.printInfo();

    this.api = new EbecoApi(
      this.getSetting("username"),
      this.getSetting("password"),
      this.homey
    );

    let updateInterval = Number(this.getSetting("interval")) * 1000;

    if (!updateInterval || updateInterval < 10000) {
      /* We never want to end up in a state where updateInterval is below 10000 */
      updateInterval = 10000;
    }

    this.log(
      `[${this.getName()}][${this.device.id}]`,
      `Update Interval: ${updateInterval}`
    );

    // New capability, can be removed once all installations are updated.
    if (!this.hasCapability("meter_power")) {
      try {
        await this.addCapability("meter_power");
        this.log("meter_power capability added successfully");
      } catch (error) {
        this.error("Error adding meter_power capability:", error);
      }
    }
    // End of removable code.

    this.registerCapabilityListener(
      "target_temperature",
      this.onCapabilitySetTemperature.bind(this)
    );
    this.registerCapabilityListener(
      "onoff",
      this.onCapabilitySetOnOff.bind(this)
    );
    this.registerCapabilityListener(
      "thermostat_program",
      this.onCapabilitySetThermostatProgram.bind(this)
    );

    await this.getDeviceData();

    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  }

  async getDeviceData(): Promise<void> {
    const { device } = this;

    try {
      const data: Device = await this.api.getDevice(device.id);
      this.log(data);

      if (!this.pauseDeviceUpdates) {
        await this.setCapabilityValue(
          "target_temperature",
          parseFloat(data.temperatureSet.toString())
        );
      }

      if (this.getSetting("regulator") === "temperatureFloor") {
        await this.setCapabilityValue(
          "measure_temperature",
          data.temperatureFloor
        );
        await this.setCapabilityValue(
          "measure_temperature.alt",
          data.temperatureRoom
        );
      } else if (this.getSetting("regulator") === "temperatureRoom") {
        await this.setCapabilityValue(
          "measure_temperature",
          data.temperatureRoom
        );
        await this.setCapabilityValue(
          "measure_temperature.alt",
          data.temperatureFloor
        );
      }

      if (data.relayOn) {
        await this.setCapabilityValue("measure_power", data.installedEffect);
      } else {
        await this.setCapabilityValue("measure_power", 0.5);
      }

      // Calculate cumulative energy consumption in kWh
      const energyConsumptionKwh =
        (data.todaysOnMinutes * data.installedEffect) / (1000 * 60);
      await this.setCapabilityValue("meter_power", energyConsumptionKwh);

      await this.setCapabilityValue("onoff", data.powerOn);
      await this.setCapabilityValue(
        "thermostat_program",
        (data.selectedProgram as ThermostatProgram) || "Manual"
      );
    } catch (err) {
      this.error(err);
    }
  }

  async setTempCapabilitiesOptions(
    regulator: TemperatureRegulator
  ): Promise<void> {
    this.log(
      "Updating measure_temperature and measure_temperature.alt capabilitiesOptions"
    );

    const floorOptions = {
      decimals: 0,
      title: {
        en: "Floor temperature",
        sv: "Golvtemperatur",
      },
    };

    const roomOptions = {
      decimals: 0,
      title: {
        en: "Room temperature",
        sv: "Rumstemperatur",
      },
    };

    if (regulator === "temperatureFloor") {
      this.setCapabilityOptions("measure_temperature", floorOptions);
      this.setCapabilityOptions("measure_temperature.alt", roomOptions);
    } else if (regulator === "temperatureRoom") {
      this.setCapabilityOptions("measure_temperature", roomOptions);
      this.setCapabilityOptions("measure_temperature.alt", floorOptions);
    }
  }

  async onCapabilitySetTemperature(value: number): Promise<void> {
    try {
      await this.setCapabilityValue("target_temperature", value);
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

  async onCapabilitySetThermostatProgram(
    value: ThermostatProgram
  ): Promise<void> {
    /**
     * Not allowed to set these values.
     * They are only for representation in case they are set on the thermostat.
     * */
    const notAllowedValues = ["Hotel", "Remote"];

    // Check if the value is in the notAllowedValues list, in that case we do nothing
    if (notAllowedValues.includes(value)) {
      return;
    }

    try {
      await this.setCapabilityValue("thermostat_program", value);
      await this.updateCapabilityValues();
    } catch (err) {
      this.error(err);
    }
  }

  async onCapabilitySetOnOff(value: boolean): Promise<void> {
    try {
      await this.setCapabilityValue("onoff", value);
      await this.updateCapabilityValues();
    } catch (err) {
      this.error(err);
    }
  }

  async updateCapabilityValues(): Promise<void> {
    const { device } = this;

    const data = {
      id: device.id,
      powerOn: this.getCapabilityValue("onoff"),
      selectedProgram: this.getCapabilityValue("thermostat_program"),
      temperatureSet: this.getCapabilityValue("target_temperature"),
    };

    try {
      await this.api.updateDeviceState(data);
    } catch (err) {
      this.error(err);
    }
  }

  printInfo(): void {
    this.log("name:", this.getName());
    this.log("class:", this.getClass());
    this.log("data", this.getData());
    this.log("settings", {
      username: this.getSetting("username"),
      interval: this.getSetting("interval"),
      regulator: this.getSetting("regulator"),
    });
  }

  onAdded(): void {
    this.log("device added");
    this.printInfo();
    this.setTempCapabilitiesOptions(this.getSetting("regulator"));
  }

  onRenamed(name: string): void {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval: number): void {
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
   * @param event the onSettings event data
   * @param event.oldSettings The old settings object
   * @param event.newSettings The new settings object
   * @param event.changedKeys An array of keys changed since the previous version
   * @returns return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: ThermostatSettings;
    newSettings: ThermostatSettings;
    changedKeys: string[];
  }): Promise<string | void> {
    const { interval } = this;
    for (const name of changedKeys) {
      /* Log setting changes except for password */
      if (name !== "password") {
        this.log(
          `Setting '${name}' set '${oldSettings[name]}' => '${newSettings[name]}'`
        );
      }
      if (name === "regulator") {
        await this.setTempCapabilitiesOptions(newSettings[name]);
      }
    }
    if (oldSettings.interval !== newSettings.interval) {
      this.log(
        `Delete old interval of ${oldSettings.interval}s and creating new ${newSettings.interval}s`
      );
      clearInterval(interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  onDeleted(): void {
    const { interval, device } = this;
    this.log(`${device.name} deleted`);
    clearInterval(interval);
  }
}

export = ThermostatDevice;
