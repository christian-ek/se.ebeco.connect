import sourceMapSupport from "source-map-support";
sourceMapSupport.install();

import Homey from "homey";
import type { ThermostatFlowArgs } from "./lib/driver-types";

class EbecoApp extends Homey.App {
  declare homey: any;
  onInit(): void {
    this.registerFlowListeners();

    this.log("Successfully init Ebeco Connect App");
  }

  registerFlowListeners(): void {
    // condition cards
    this.homey.flow
      .getConditionCard("thermostat_program_equals")
      .registerRunListener(async (args: ThermostatFlowArgs): Promise<boolean> => {
        return (
          args.device.getCapabilityValue("thermostat_program") === args.mode
        );
      });
  }
}

export = EbecoApp;
