"use strict";

import Homey from "homey";
import { EbecoApi } from "../../lib/api";
import type { Device, TemperatureRegulator } from "../../lib/ebeco-types";
import type { PairSessionData, HomeyDevice } from "../../lib/driver-types";

class ThermostatDriver extends Homey.Driver {
  declare homey: any;
  declare id: string;
  private api!: EbecoApi;
  private device!: HomeyDevice;

  onInit(): void {
    // Driver initialization
  }

  // Pairing
  async onPair(session: any): Promise<void> {
    let username = "";
    let password = "";

    session.setHandler(
      "login",
      async (data: PairSessionData): Promise<boolean> => {
        username = data.username;
        password = data.password;

        this.api = new EbecoApi(username, password, this.homey);

        const credentialsAreValid = await this.api.login();

        // return true to continue adding the device if the login succeeded
        // return false to indicate to the user the login attempt failed
        // thrown errors will also be shown to the user
        return !!credentialsAreValid;
      }
    );

    session.setHandler("list_devices", async (): Promise<HomeyDevice[]> => {
      await this.api.login();

      const myDevices: Device[] = await this.api.getUserDevices();

      this.log(myDevices);
      const devices: HomeyDevice[] = myDevices.map((myDevice: Device) => {
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
            regulator: "temperatureFloor" as const,
          },
        };
      });

      return devices;
    });

    session.setHandler(
      "list_devices_selection",
      async (data: HomeyDevice[]): Promise<void> => {
        this.homey.app.log(
          `[Driver] ${this.id} - selected_device - `,
          data[0].name
        );
        this.device = data[0];
      }
    );

    session.setHandler(
      "select_regulator",
      async (data: TemperatureRegulator): Promise<HomeyDevice> => {
        this.homey.app.log(`[Driver] ${this.id} - selected_regulator - `, data);
        this.device.settings.regulator = data;
        return this.device;
      }
    );
  }
}

export = ThermostatDriver;
