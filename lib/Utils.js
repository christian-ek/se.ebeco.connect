'use strict';

const fetch = require('node-fetch');

module.exports.getStatus = (regulator, body) => {
  const result = {};

  result.id = body.id;
  result.name = body.displayName;
  result.target_temperature = parseFloat(body['temperatureSet']);
  result.measure_temperature = parseFloat(body[regulator]);

  return result;
};

async function renewAuthorizationToken(homey) {
  const timeNow = new Date();
  const tokenTime = new Date(homey.settings.get('token.timestamp'))
    .setSeconds(homey.settings.get('token.expireInSeconds') - 3600);

  if (timeNow < tokenTime) {
    return;
  }

  homey.log('Authorization Token expires soon, renewing..');

  const url = 'https://ebecoconnect.com/api/TokenAuth/Authenticate';
  const data = {
    userNameOrEmailAddress: homey.settings.get('email'),
    password: homey.settings.get('password'),
  };

  const response = this.doRequest(homey, url, 'POST', data);

  if (response.ok) {
    homey.settings.set('token', response.result.accessToken);
    homey.settings.set('token.timestamp', new Date());
    homey.settings.set('token.expireInSeconds', response.result.expireInSeconds);
  }
}

async function checkResponseStatus(res, homey) {
  if (res.ok) {
    return res;
  } if (res.status === 401) {
    homey.log('Unauthorized, renewing token.');
    await renewAuthorizationToken(homey);
  }
  throw new Error(`Status of the reponse: ${res.status} (${res.statusText})`);
}

module.exports.doRequest = async function doRequest(homey, url, method, data) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${homey.settings.get('token')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Abp.TenantId': 1,
    },
  };

  if (method === 'POST') {
    await renewAuthorizationToken(homey);
  }

  if (data) {
    options.push({
      key: 'data',
      value: JSON.stringify(data),
    });
  }

  return fetch(url, options)
    .then(res => checkResponseStatus(res, homey))
    .then(res => {
      return res.json();
    })
    .then(responseData => {
      return responseData;
    })
    .catch(error => {
      homey.log(error);
      throw new Error(error);
    });
};
