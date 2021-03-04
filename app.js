'use strict';

const Homey = require('homey');

class LkApp extends Homey.App {

  onInit() {
    this.log('Successfully init LK App');
  }

}

module.exports = LkApp;
