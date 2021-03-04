'use strict';

const Homey = require('homey');

class EbecoApp extends Homey.App {

  onInit() {
    this.log('Successfully init Ebeco App');
  }

}

module.exports = EbecoApp;
