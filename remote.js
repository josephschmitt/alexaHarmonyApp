'use strict';

let alexa = require('alexa-app');
let _ = require('underscore');
let HarmonyUtils = require('harmony-hub-util');
let dotenv = require('dotenv').config();
let co = require('co');
let Promise = require('node-promise');

let harmony_clients = {};
let hub_ip = dotenv.HUB_IP;
let app_id = dotenv.SKILL_APP_ID;
let interval = 5 * 60 * 1000;

let app = new alexa.app('remote');
let resetInterval = setInterval(cacheHarmonyUtils, interval);
let harmony;

cacheHarmonyUtils();

app.launch(function(req, res) {
  console.log("Launching the application");
});

app.intent('IncreaseVolume', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();
  let amt = (parseInt(req.slot('AMOUNT'), 10) || 10) * 2;

  hutils.executeCommand(false, curActivity, 'Volume,Volume Up', amt).then(function () {
    console.log('Volume increased', amt);
  });
  res.say('Ok').send();
}));

app.intent('DecreaseVolume', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();
  let amt = parseInt(req.slot('AMOUNT'), 10) || 10;

  hutils.executeCommand(false, curActivity, 'Volume,Volume Down', amt).then(function () {
    console.log('Volume decreased', amt);
  });
  res.say('Ok').send();
}));

app.intent('MuteVolume', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();

  hutils.executeCommand(false, curActivity, 'Volume,Mute', 1).then(function () {
    console.log('Volume muted');
  });

  res.say('Ok').send();
}));

app.intent('StartActivity', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let activities = yield hutils.readActivities();
  let reqName = req.slot('activityName');
  let activityName = reqName === 'power off' ? 'PowerOff' : activities.filter(function (act) {
    return act.toLowerCase().indexOf(reqName) >= 0;
  })[0];

  startActivity(activityName, res);
}));

app.intent('CommandActivity', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();
  let reqCommand = req.slot('activityCommand');

  let allCommands = yield hutils.readCommands(false, curActivity);
  let cmdMatch = allCommands.filter(function (cmd) {
    return cmd[1].toLowerCase() == reqCommand.toLowerCase();
  });

  if (cmdMatch.length) {
    res.say('Ok').send();
    return hutils.executeCommand(false, activity, cmdMatch[0].join(','), 1).then(function () {
      console.log("Command " + cmdMatch[0][1] + " on activity " + activity + " executed.");
    });
  }
  else {
    return res.say('Sorry, I couldn\'t do that').send();
  }
}));

app.intent('EndActivity', function (req, res) {
  endCurrentActivity(res);
});

app.intent('ToggleActivity', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let activityName = req.slot('activityName');
  let action = req.slot('toggleAction');

  console.log('Executing ' + action + ' for activity ' + activityName);

  if (action.toLowerCase() === 'start') {
    startActivity(activityName, res)
  }
  else if (action.toLowerCase() === 'end') {
    endCurrentActivity(res);
  }
  else {
    return res.say("I'm sorry, I was unable to do that.");
  }
}));

/**
 * Works like the co.wrap function but instead of returning a Promise it returns false so that
 * Alexa knows to wait for a response.
 * @param {Function} fn
 * @returns {Boolean} false
 */
function coAlexaWrap(fn) {
  createResponse.__generatorFunction__ = fn;
  return createResponse;
  function createResponse() {
    co.call(this, fn.apply(this, arguments));
    return false;
  }
}

function cacheHarmonyUtils() {
  harmony = null;

  return new HarmonyUtils(hub_ip).then(function (hub) {
      harmony = hub;
      return harmony;
  });
}

function getHarmonyHub() {
  let deferred = Promise.defer();
  if (harmony) {
    deferred.resolve(harmony);
  }
  else {
    clearInterval(resetInterval);
    cacheHarmonyUtils().catch(deferred.reject).then(deferred.resolve);
  }
  return deferred.promise;
}

function startActivity(activityName, res) {
  if (activityName) {
    console.log('Starting activity ' + activityName);
    res.say('Ok, ' + activityName).send();
    return hutils.executeActivity(activityName);
  }
  else {
    console.log('Unable to find activity ' + activityName);
    return res.say('No activity found').send();
  }
}

function endCurrentActivity(res) {
  res.say('Ok').send();
  return hutils.endCurrentActivity();
}

module.exports = app;
