'use strict';

const fetch = require('node-fetch');

async function checkResponseStatus(res) {
  if (res.ok) {
    return res;
  }
  throw new Error(`Status of the reponse: ${res.status} (${res.statusText})`);
}

module.exports.getStatus = (regulator, body) => {
  const result = {};

  result.id = body.id;
  result.name = body.displayName;
  result.target_temperature = parseFloat(body.temperatureSet);
  result.installedEffect = body.installedEffect; // Watt
  result.relayOn = body.relayOn;
  result.measure_temperature = parseFloat(body[regulator]);

  return result;
};

async function renewAuthorizationToken(homey) {
  const timeNow = new Date();
  const tokenTime = new Date(homey.settings.get('token.timestamp'))
    .setSeconds(homey.settings.get('token.expireInSeconds') - 3600);

  if (timeNow < tokenTime) {
    return null;
  }

  homey.log('Authorization Token expires soon, renewing..');

  const url = 'https://ebecoconnect.com/api/TokenAuth/Authenticate';
  const headers = {
    'Content-Type': 'application/json',
    'Abp.TenantId': 1,
  };
  const data = {
    userNameOrEmailAddress: homey.settings.get('email'),
    password: homey.settings.get('password'),
  };

  return fetch(url, { method: 'POST', headers, body: JSON.stringify(data) })
    .then(res => checkResponseStatus(res))
    .then(res => {
      return res.json();
    })
    .then(responseData => {
      homey.settings.set('token', responseData.result.accessToken);
      homey.settings.set('token.timestamp', new Date());
      homey.settings.set('token.expireInSeconds', responseData.result.expireInSeconds);
      return responseData.result.accessToken;
    })
    .catch(error => {
      homey.log(error);
      throw new Error(error);
    });
}

module.exports.doRequest = async function doRequest(homey, url, method, data) {
  let token = await renewAuthorizationToken(homey);

  if (homey.settings.get('token')) {
    token = homey.settings.get('token');
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Abp.TenantId': 1,
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  return fetch(url, options)
    .then(res => checkResponseStatus(res))
    .then(res => {
      return res.json();
    })
    .then(responseData => {
      return responseData;
    })
    .catch(error => {
      throw new Error(error);
    });
};
