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

  if (activityName) {
    console.log('Starting activity ' + activityName);
    hutils.executeActivity(activityName);
    resp.say('Ok, ' + activityName).send();
  }
  else {
    console.log('Unable to find activity ' + activityName + ', requested ' + reqName);
    resp.say('No activity for ' + reqName).send();
  }
}));

app.intent('CommandActivity', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();
  let allCommands = yield hutils.readCommands(false, curActivity);
  let activityCommand = req.slot('activityCommand');
  let cmdMatch = allCommands.filter(function (cmd) {
    return cmd[1].toLowerCase() == activityCommand.toLowerCase();
  });

  if (cmdMatch.length) {
    hutils.executeCommand(false, curActivity, cmdMatch[0].join(','), 1).then(function () {
      console.log("Command " + cmdMatch[0][1] + " on activity " + curActivity + " executed.");
    });
    resp.say('Ok').send();
  }
  else {
    resp.say('Sorry, I couldn\'t do that').send();
  }

  return false;
}));

app.intent('ToggleActivity', coAlexaWrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let activityName = req.slot('activityName');
  let action = req.slot('toggleAction');

  console.log('Executing ' + action + ' for activity ' + activityName);

  if (action.toLowerCase() === 'start') {
    let activities = yield hutils.readActivities();
    let foundActivity = activities.filter(function (act) {
        return act.toLowerCase() === activityName;
    })[0];

    console.log('matched activity name', foundActivity);

    hutils.executeActivity(foundActivity).then(function () {
      console.log("Started activity " + foundActivity);
    });
    resp.say('Starting ' + foundActivity).send();
  }
  else if (action.toLowerCase() === 'end') {
    hutils.endCurrentActivity().then(function () {
      console.log("Ended activity " + activityName);
    });
    resp.send();
  }
  else {
    return resp.say("I'm sorry, I was unable to do that.");
  }

  return false;
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

module.exports = app;
