'use strict';

const Homey = require('homey');

class EbecoApp extends Homey.App {

  onInit() {
    this.registerFlowListeners();

    this.log('Successfully init Ebeco Connect App');
  }

  registerFlowListeners() {
    // condition cards
    this.homey.flow.getConditionCard('thermostat_program_equals')
      .registerRunListener(async args => {
        return (args.device.getCapabilityValue('thermostat_program') === args.mode);
      });
  }

}

module.exports = EbecoApp;
