"use strict";

// Shoutout to dhutchinson for most of the code in this client.
// https://github.com/dhutchison/homebridge-ebeco/blob/master/src/lib/ebecoApi.ts

import Homey from "homey";
import axios, { type AxiosInstance } from "axios";
import https from "https";
import type {
  MvcAjaxResponse,
  LoginRequest,
  LoginResponse,
  Device,
  DeviceUpdateRequest,
  EnergyData,
} from "./ebeco-types";

/**
 * Client for sending requests to Ebeco Connect and getting replies
 */
export class EbecoApi extends Homey.SimpleClass {
  private username: string;
  private password: string;
  private accessToken: string;
  private homey: any;
  private client: AxiosInstance;
  private loginPromise: Promise<LoginResponse> | null = null;

  private mockDevices: Device[] = [
    {
      displayName: "Bathroom",
      powerOn: true,
      selectedProgram: "Manual",
      programState: "Standby",
      temperatureSet: 19,
      temperatureFloor: 15,
      temperatureRoom: 17,
      temperatureFloorDecimals: 15.0,
      temperatureRoomDecimals: 17.0,
      relayOn: true,
      minutesToTarget: 0,
      remoteInput: false,
      hasError: false,
      errorMessage: undefined,
      todaysOnMinutes: 216,
      installedEffect: 470,
      building: { name: "Elm street", id: 1 },
      id: 1,
    },
    {
      displayName: "Living Room",
      powerOn: true,
      selectedProgram: "Manual",
      programState: "Standby",
      temperatureSet: 22,
      temperatureFloor: 23,
      temperatureRoom: 19,
      temperatureFloorDecimals: 23.0,
      temperatureRoomDecimals: 19.0,
      relayOn: false,
      minutesToTarget: 0,
      remoteInput: false,
      hasError: false,
      errorMessage: undefined,
      todaysOnMinutes: 216,
      installedEffect: 470,
      building: { name: "Elm street", id: 1 },
      id: 2,
    },
    {
      displayName: "Kitchen",
      powerOn: true,
      selectedProgram: "Manual",
      programState: "Standby",
      temperatureSet: 20,
      temperatureFloor: 20,
      temperatureRoom: 20,
      temperatureFloorDecimals: 20.0,
      temperatureRoomDecimals: 20.0,
      relayOn: false,
      minutesToTarget: 0,
      remoteInput: false,
      hasError: false,
      errorMessage: undefined,
      todaysOnMinutes: 216,
      installedEffect: 500,
      building: { name: "Elm street", id: 1 },
      id: 3,
    },
  ];

  /**
   * Construct the client
   * @param username - E-mail for logging in to Ebeco Connect
   * @param password - Password for logging in to Ebeco Connect
   * @param homey - Homey instance
   */
  constructor(username: string, password: string, homey: any) {
    super();
    this.homey = homey;
    this.username = username;
    this.password = password;
    this.accessToken = "";

    if (this.homey.settings.get("token")) {
      this.accessToken = this.homey.settings.get("token");
    }

    /* Validate the configuration */
    if (!username || !password) {
      throw new Error('Missing "username" or "password".');
    }

    /* Create a dedicated axios instance with keepAlive disabled to prevent stale socket reuse */
    this.client = axios.create({
      baseURL: "https://ebecoconnect.com",
      headers: {
        "Abp.TenantId": "1",
        "Content-Type": "application/json",
      },
      httpsAgent: new https.Agent({ keepAlive: false }),
    });

    /* Configure an interceptor to refresh our authentication credentials */
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        /* Return any error which is not due to authentication back to the calling service */
        if (!error.response || error.response.status !== 401) {
          return Promise.reject(error);
        }

        /* Reject if we were trying to authenticate and it failed */
        if (error.config.url === "/api/TokenAuth/Authenticate") {
          return Promise.reject(error);
        }

        /* Login again then retry the request */
        try {
          const loginResponse = await this.login();
          const { config } = error;
          config.headers["Authorization"] = `Bearer ${loginResponse.accessToken}`;
          return this.client.request(config);
        } catch (authenticationError) {
          return Promise.reject(authenticationError);
        }
      }
    );
  }

  /**
   * Log in user
   */
  login(): Promise<LoginResponse> {
    const data: LoginRequest = {
      userNameOrEmailAddress: this.username,
      password: this.password,
    };

    if (this.username === "test" && this.password === "test") {
      return Promise.resolve({
        accessToken: "test-token",
        expireInSeconds: 3600,
        requiresTwoFactorVerification: false,
      });
    }

    /* If a login is already in progress, return the same promise (login mutex) */
    if (this.loginPromise) {
      this.homey.log("Login already in progress, waiting for existing login...");
      return this.loginPromise;
    }

    this.homey.log(
      `Sending login request with user name: ${data.userNameOrEmailAddress}`
    );

    this.loginPromise = this.client
      .post<MvcAjaxResponse<LoginResponse>>(
        "/api/TokenAuth/Authenticate",
        data
      )
      .then((response) => {
        if (response.data.result.requiresTwoFactorVerification) {
          throw new Error("Account requires two factor authentication");
        }
        this.accessToken = response.data.result.accessToken;
        this.homey.settings.set("token", response.data.result.accessToken);
        return response.data.result;
      })
      .catch((err) => {
        if (err.response && err.response.status === 500) {
          throw new Error("Wrong username or password");
        }
        throw err;
      })
      .finally(() => {
        this.loginPromise = null;
      });

    return this.loginPromise;
  }

  /**
   * Get all devices for the logged in user.
   */
  getUserDevices(): Promise<Device[]> {
    if (this.username === "test" && this.password === "test") {
      return Promise.resolve(this.mockDevices);
    }

    const config = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    return new Promise((resolve, reject) => {
      this.client
        .get<MvcAjaxResponse<Device[]>>(
          "/api/services/app/Devices/GetUserDevices",
          config
        )
        .then((response) => {
          this.homey.log(
            `Loaded device list, ${response.data?.result?.length} device(s).`
          );
          resolve(response.data.result);
        })
        .catch((err) => {
          this.homey.error(`Failed to load device list: ${err}`);
          reject(err);
        });
    });
  }

  /**
   * Get device
   * @param deviceId id of the device to get.
   */
  getDevice(deviceId: number): Promise<Device> {
    if (this.username === "test" && this.password === "test") {
      return new Promise((resolve, reject) => {
        const device = this.mockDevices.find(
          (device) => device.id === deviceId
        );
        if (device) {
          resolve(device);
        } else {
          reject(new Error(`Device ${deviceId} not found`));
        }
      });
    }

    const config = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    return new Promise((resolve, reject) => {
      this.client
        .get<MvcAjaxResponse<Device>>(
          `/api/services/app/Devices/GetUserDeviceById?id=${deviceId}`,
          config
        )
        .then((response) => {
          resolve(response.data.result);
        })
        .catch((err) => {
          this.homey.error(`Failed to load device: ${err}`);
          reject(err);
        });
    });
  }

  /**
   * Get device energy data
   * @param deviceId id of the device to get energy data for
   * @param from starting date of retrieved data
   * @param to ending date of retrieved data
   */
  getDeviceEnergyData(
    deviceId: number,
    from: Date,
    to: Date
  ): Promise<EnergyData[]> {
    if (this.username === "test" && this.password === "test") {
      return Promise.resolve([]);
    }

    const config = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    return new Promise((resolve, reject) => {
      this.client
        .get<MvcAjaxResponse<EnergyData[]>>(
          `/api/services/app/Devices/GetUserDeviceEnergyData?Id=${deviceId}&From=${fromStr}&To=${toStr}`,
          config
        )
        .then((response) => {
          resolve(response.data.result);
        })
        .catch((err) => {
          this.homey.error(`Failed to load device energy data: ${err}`);
          reject(err);
        });
    });
  }

  /**
   * Update the state of a device.
   * @param updatedState the device parameters to change.
   */
  updateDeviceState(updatedState: DeviceUpdateRequest): Promise<boolean> {
    if (this.username === "test" && this.password === "test") {
      const deviceIndex = this.mockDevices.findIndex(
        (device) => device.id === updatedState.id
      );
      if (deviceIndex !== -1 && updatedState.temperatureSet !== undefined) {
        this.mockDevices[deviceIndex].temperatureSet =
          updatedState.temperatureSet;
      }
      return Promise.resolve(true);
    }

    const config = {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    };

    return new Promise((resolve, reject) => {
      this.client
        .put<MvcAjaxResponse<any>>(
          "/api/services/app/Devices/UpdateUserDevice",
          updatedState,
          config
        )
        .then((response) => {
          this.homey.log(
            `Sent update to device state, response: ${JSON.stringify(
              response.data
            )}`
          );
          resolve(response.data.success);
        })
        .catch((err) => {
          this.homey.log(`Failed to update device state: ${err}`);
          reject(err);
        });
    });
  }
}
