'use strict';

const fetch = require('node-fetch');

module.exports.getStatus = body => {
  const result = {};

  result.id = body.id;
  result.name = body.displayName;
  result.target_temperature = parseFloat(body.temperatureSet);
  result.measure_temperature = parseFloat(body.temperatureFloor);

  return result;
};

module.exports.renewAuthorizationToken = async function renewAuthorizationToken(homey) {
  const timeNow = new Date();
  const tokenTime = new Date(homey.settings.get('token.timestamp'))
      .setSeconds(homey.settings.get('token.expireInSeconds') - 3600);

  if (timeNow < tokenTime) {
    return
  }

  homey.log("Authorization Token expires soon, renewing..")

  const url = 'https://ebecoconnect.com/api/TokenAuth/Authenticate';
  const headers = {
    'Content-Type': 'application/json',
    'Abp.TenantId': 1
  }
  const data = {
    userNameOrEmailAddress: homey.settings.get('email'),
    password: homey.settings.get('password')
  }

  fetch(url, {method: 'POST', headers: headers, body: JSON.stringify(data)})
      .then((response) => {
        if (response.ok) {
          response.json().then((data) => {
            homey.settings.set('token', data.result.accessToken)
            homey.settings.set('token.timestamp', new Date())
            homey.settings.set('token.expireInSeconds', data.result.expireInSeconds)
          });
        } else {
          homey.log(response)
        }
      })
      .catch(error => {
        homey.log(error);
      });
}
