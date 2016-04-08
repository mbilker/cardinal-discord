"use strict";

const path = require('path');

const debug = require('debug')('hubot-mpd');
const mpd = require('mpd');
const cmd = mpd.cmd;

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const HOST = '127.0.0.1';
const PORT = 6600;

function formatTime(seconds) {
  function zeroPad(n) {
    return n < 10 ? '0' + n : n;
  }
  return Math.floor(seconds / 60) + ':' + zeroPad(seconds % 60);
}

class MpdManager {
  constructor() {
    this.mpd = mpd.connect({
      host: HOST,
      port: PORT,
    });

    Dispatcher.on(Actions.NOW_PLAYING_SONG, this.getNowPlaying.bind(this));
    Dispatcher.on(Actions.NEXT_SONG, this.next.bind(this));
    Dispatcher.on(Actions.PREVIOUS_SONG, this.previous.bind(this));
    Dispatcher.on(Actions.PAUSE_SONG, this.pause.bind(this));
    Dispatcher.on(Actions.RESUME_SONG, this.play.bind(this));
    Dispatcher.on(Actions.PLAY_PLAYLIST_POSITION, this.playlistPos.bind(this));
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

  getNowPlaying(e) {
    debug('NOW_PLAYING_SONG');
    const promises = [
      this.sendCommand('currentsong', []),
      this.sendCommand('status', []),
    ];

    return Promise.all(promises).then((values) => {
      debug('NOW_PLAYING_SONG cb');
      if (!values[0] || !values[0].length) {
        return e.message.channel.sendMessage('No current song');
      }

      const currentSong = mpd.parseKeyValueMessage(values[0]);
      const stats = mpd.parseKeyValueMessage(values[1]);

      const id = currentSong.Id;

      const times = stats.time.split(':');
      const currentTime = formatTime(times[0]);
      const totalTime = formatTime(times[1]);
      const remainingTime = `-${formatTime(Math.abs(times[0] - times[1]))}`;

      let name = null;
      if (currentSong.Album && currentSong.Title) {
        name = `${currentSong.Album} - ${currentSong.Title}`;
      } else {
        name = path.basename(currentSong.file);
      }

      e.message.channel.sendMessage(`Now Playing:\n[${id}] (${totalTime}) **${name}**\n[${currentTime} / ${totalTime}] (${remainingTime})`);
    }).catch((err) => {
      if (err) {
        console.log(err.stack);
      }
    });
  }

  next(e) {
    debug('NEXT_SONG');
    return this.sendCommand('next', []).then(() => this.getNowPlaying(e));
  }

  previous(e) {
    debug('PREVIOUS_SONG');
    return this.sendCommand('previous', []).then(() => this.getNowPlaying(e));
  }

  pause() {
    debug('PAUSE_SONG');
    return this.sendCommand('pause', [1]);
  }

  play() {
    debug('RESUME_SONG');
    return this.sendCommand('pause', [0]);
  }

  playlistPos(pos) {
    debug('PLAY_PLAYLIST_POSITION');
    return this.sendCommand('play', [pos]);
  }
};

module.exports = new MpdManager();
