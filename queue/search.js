"use strict";

const mpd = require('mpd');

const Settings = require('../settings');

class LocalMusicSearch {
  constructor(container) {
    this.container = container;
    this.logger = container.get('logger');

    this.connectToMpd();
  }

  shutdown() {
    this.mpd.socket.end();
  }

  connectToMpd() {
    this.mpd = mpd.connect({
      host: Settings.MPD_HOST,
      port: Settings.MPD_PORT,
    });

    this.mpd.on('ready', () => {
      this.logger.info('MPD connection ready');
    });
  }

  byAnyField(text) {
    return new Promise((resolve, reject) => {
      this.mpd.sendCommand(mpd.cmd('search', ['any', text]), (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    }).then((result) => {
      return mpd.parseArrayMessage(result);
    });
  }
}

module.exports = LocalMusicSearch;
