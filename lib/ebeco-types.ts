/**
 * Type definitions for Ebeco Connect API
 */

/**
 * Thermostat program types based on API documentation
 */
export type ThermostatProgram =
  | "Manual"
  | "Week"
  | "Timer"
  | "Remote"
  | "Hotel";

/**
 * Program state types
 */
export type ProgramState = "Standby" | "Active" | "Timer";

/**
 * Temperature regulator options
 */
export type TemperatureRegulator = "temperatureFloor" | "temperatureRoom";

/**
 * Error interface for API responses
 */
export interface EbecoError {
  code: number;
  message: string;
  details: string;
}

/**
 * Interface defining the standard object which seems to wrap all the
 * API responses.
 *
 * This is not detailed in the swagger specification!
 */
export interface MvcAjaxResponse<T> {
  result: T;
  success: boolean;
  error?: EbecoError;
  unAuthorizedRequest: boolean;
}

/**
 * Login request interface
 */
export interface LoginRequest {
  userNameOrEmailAddress: string;
  password: string;
}

/**
 * Login response interface - fields we care about from a successful authentication
 */
export interface LoginResponse {
  accessToken: string;
  expireInSeconds: number;
  requiresTwoFactorVerification: boolean;
}

/**
 * Building/Premise information
 */
export interface Building {
  id: number;
  name: string;
}

/**
 * Complete device information from the Ebeco API
 *
 * This matches the UserDeviceDto from the Swagger specification
 */
export interface Device {
  /**
   * Thermostat id
   */
  id: number;
  /**
   * The given name of the thermostat
   */
  displayName: string;
  /**
   * State of thermostat (on/off)
   */
  powerOn: boolean;
  /**
   * Program currently set on thermostat. Possible values are: Manual, Week, Timer
   */
  selectedProgram?: ThermostatProgram;
  /**
   * State of current program. Possible values are: Standby, Active, Timer
   */
  programState?: ProgramState;
  /**
   * Temperature until next program event, or fixed when on manual program. When on Timer program,
   * temperature is set 'Active' temperature (when the timer is running)
   */
  temperatureSet: number;
  /**
   * Current temperature, floor sensor.
   */
  temperatureFloor: number;
  /**
   * Current temperature, room sensor.
   */
  temperatureRoom: number;
  /**
   * Current temperature with decimals, floor sensor.
   */
  temperatureFloorDecimals: number;
  /**
   * Current temperature with decimals, room sensor.
   */
  temperatureRoomDecimals: number;
  /**
   * State of internal relay.
   */
  relayOn: boolean;
  /**
   * Estimated number of minutes to reach temperatureSet.
   */
  minutesToTarget: number;
  /**
   * State of remote input port.
   */
  remoteInput: boolean;
  /**
   * Number of minutes the internal relay has been on today.
   */
  todaysOnMinutes: number;
  /**
   * Power of installed heating [W], used to calculate kWh from operating time
   */
  installedEffect: number;
  /**
   * If the thermostat is reporting an error or appears to be offline.
   */
  hasError: boolean;
  /**
   * Description of error.
   */
  errorMessage?: string;
  /**
   * The current active sensor
   */
  sensorApplication?: string;
  /**
   * The name of the premise where this thermostat is located.
   */
  building?: Building;
}

/**
 * Device update request interface - for sending changes to the API
 */
export interface DeviceUpdateRequest {
  /**
   * Thermostat id
   */
  id: number;
  /**
   * Temperature until next program event, or fixed when on manual program.
   * When on Timer program, temperature is 'Active' temperature (when the timer is running).
   */
  temperatureSet?: number;
  /**
   * Turn thermostat on or off.
   */
  powerOn?: boolean;
  /**
   * Program running on thermostat. Valid set options are: Manual, Week, Timer.
   * Switching to Timer also starts the timer.
   */
  selectedProgram?: ThermostatProgram;
}

/**
 * Energy data response from GetUserDeviceEnergyData endpoint
 */
export interface EnergyData {
  /**
   * The date from which this data was collected.
   */
  date: string;
  /**
   * The total energy consumption for this date in kWh.
   */
  totalConsumption: number;
  /**
   * The total number of minutes this date where the thermostat was actively heating.
   */
  totalMinutes: number;
}
