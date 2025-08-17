/**
 * Type definitions for Ebeco Connect device drivers and pairing
 */

import type { ThermostatProgram, TemperatureRegulator } from "./ebeco-types";

/**
 * Data for login credentials used in pairing
 */
export interface PairSessionData {
  username: string;
  password: string;
}

/**
 * Base device data structure used in device creation
 */
export interface DeviceData {
  id: number;
  name: string;
}

/**
 * Device settings interface for thermostat devices
 */
export interface DeviceSettings {
  username: string;
  password: string;
  interval: number;
  regulator: TemperatureRegulator;
  [key: string]: any; // Allow dynamic property access for settings changes
}

/**
 * Complete device item structure returned during pairing
 */
export interface HomeyDevice {
  name: string;
  data: DeviceData;
  settings: DeviceSettings;
}

/**
 * Flow card arguments for thermostat program condition
 */
export interface ThermostatFlowArgs {
  device: any; // Homey.Device but avoiding circular import
  mode: string;
}
