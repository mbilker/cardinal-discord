"use strict";

const _ = require('lodash');
const debug = require('debug')('hubot-web');
const express = require('express');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const app = express();

app.get('/set-volume', (req, res) => {
  if (typeof(req.query.value) !== 'undefined') {
    let volume = parseInt(req.query.value) || Settings.STREAM_VOLUME;
    volume = Math.max(volume, 0);
    volume = Math.min(volume, 100);

    debug(`Setting stream volume to ${volume}`);
    Dispatcher.emit(Actions.SET_AUDIO_VOLUME, volume);

    return res.sendStatus(200);
  }
  res.sendStatus(500);
});

app.listen(8456, function() {
  debug('listening on port 8456');
});
