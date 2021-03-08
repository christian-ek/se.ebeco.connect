'use strict';

// a method named 'onHomeyReady' must be present in your code
// eslint-disable-next-line no-unused-vars
function onHomeyReady(Homey) {
  // Tell Homey we're ready to be displayed
  Homey.ready();

  const emailElement = document.getElementById('email');
  const passwordElement = document.getElementById('password');
  const saveElement = document.getElementById('save');
  const savedTextElement = document.getElementById('saved');

  // eslint-disable-next-line consistent-return
  Homey.get('email', (err, email) => {
    if (err) return Homey.alert(err);
    emailElement.value = email;
  });

  Homey.get('password', (err, password) => {
    if (err) return Homey.alert(err);
    passwordElement.value = password;
  });

  saveElement.addEventListener('click', e => {
    Homey.set('email', emailElement.value, err => {
      if (err) return Homey.alert(err);
    });
    Homey.set('password', passwordElement.value, err => {
      if (err) return Homey.alert(err);
    });
    savedTextElement.style.display = 'block';
  });
}
