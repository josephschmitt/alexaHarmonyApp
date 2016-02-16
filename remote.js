'use strict';

let alexa = require('alexa-app'),
    _ = require('underscore'),
    HarmonyUtils = require('harmony-hub-util'),
    dotenv = require('dotenv').config(),
    co = require('co'),
    Promise = require('node-promise'),

    harmony_clients = {},
    hub_ip = dotenv.HUB_IP,
    app_id = dotenv.SKILL_APP_ID,
    interval = 5 * 60 * 1000,

    app = new alexa.app('remote'),
    resetInterval = setInterval(cacheHarmonyUtils, interval),
    harmony;

cacheHarmonyUtils();

app.launch(function(req, res) {
  console.log("Launching the application");
});

app.intent('IncreaseVolume', co.wrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();

  let amt = parseInt(req.slot('AMOUNT'), 10);
  if (isNaN(amt)) {
    amt = 1;
  }

  hutils.executeCommand(false, curActivity, 'Volume,Volume Up', amt).then(function () {
    console.log('Volume increased');
  });
}));

app.intent('DecreaseVolume', co.wrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();

  let amt = parseInt(req.slot('AMOUNT'), 10);
  if (isNaN(amt)) {
    amt = 1;
  }

  hutils.executeCommand(false, curActivity, 'Volume,Volume Down', amt).then(function () {
    console.log('Volume decreased');
  });
}));

app.intent('MuteVolume', co.wrap(function* (req, res) {
  let hutils = yield getHarmonyHub();
  let curActivity = yield hutils.readCurrentActivity();

  hutils.executeCommand(false, curActivity, 'Volume,Mute', 1).then(function () {
    console.log('Volume muted');
  });
}));

app.intent('StartActivity', co.wrap(function* (req, resp) {
  let hutils = yield getHarmonyHub();
  let activities = yield hutils.readActivities();
  let reqName = req.slot('activityName');
  let activityName = reqName === 'power off' ? 'PowerOff' : activities.filter(function (act) {
    return act.toLowerCase().indexOf(reqName) >= 0;
  })[0];

  if (activityName) {
    console.log('Executing activity ' + activityName);
    hutils.executeActivity(activityName);
    resp.say('Starting ' + activityName).send();
  }
  else {
    console.log('Unable to find activity ' + activityName);
    resp.say('I was unable to find an activity named ' + reqName).send();
  }

  return false;
}));

app.intent('CommandActivity', co.wrap(function* (req, resp) {
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
      resp.send();
    });
  } else {
    resp.say('Sorry, I couldn\'t do that').send();
  }

  return false;
}));

app.intent('ToggleActivity', co.wrap(function* (req, resp) {
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
