"use strict";

const mpd = require('mpd');

class LocalMusicSearch {
  constructor(container) {
    this.container = container;
    this.logger = container.get('logger');
    this.options = container.get('options');

    if (!this.options.mpd) {
      throw new Error('options.mpd is null');
    }

    this.connectToMpd();
  }

  shutdown() {
    this.mpd.socket.end();
  }

  connectToMpd() {
    const { mpd } = this.options;

    this.mpd = mpd.connect({
      host: mpd.host,
      port: mpd.port
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
    }).then((arr) => {
      return arr.filter((element) => element.file);
    });
  }
}

module.exports = LocalMusicSearch;
