"use strict";

const debug = require('debug')('hubot-mpd');
const mpd = require('mpd');
const cmd = mpd.cmd;

const Actions = require('./Actions');
const Dispatcher = require('./Dispatcher');
const Settings = require('./Settings');

const HOST = '127.0.0.1';
const PORT = 6600;

class MpdManager {
  constructor() {
    this.mpd = mpd.connect({
      host: HOST,
      port: PORT,
    });

    Dispatcher.on(Actions.NEXT_SONG, this.nextSong.bind(this));
    Dispatcher.on(Actions.PREVIOUS_SONG, this.previousSong.bind(this));
  }

  sendCommand(command, args) {
    const processCmd = cmd(command, args);

    return new Promise((resolve, reject) => {
      this.mpd.sendCommand(processCmd, (err, res) => {
        if (err) {
          return reject(err);
        }
        return resolve(res);
      });
    });
  }

  getNowPlaying() {
    return this.sendCommand('');
  }

  nextSong() {
    return this.sendCommand('next', []);
  }

  previousSong() {
    return this.sendCommand('previous', []);
  }
};

module.exports = new MpdManager();
