"use strict";

const path = require('path');

const debug = require('debug')('cardinal:mpd-status');
const mpd = require('mpd');
const cmd = mpd.cmd;

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const HOST = 'terminator.local';
const PORT = 6600;

function formatTime(seconds) {
  function zeroPad(n) {
    return n < 10 ? '0' + n : n;
  };
  return Math.floor(seconds / 60) + ':' + zeroPad(seconds % 60);
};

const ONE_MINUTE = 60;
const ONE_HOUR = ONE_MINUTE * 60;
const ONE_DAY = ONE_HOUR * 24;
const ONE_WEEK = ONE_DAY * 7;

function reallyLongTime(seconds) {
  const weeks = Math.floor(seconds / ONE_WEEK);
  seconds -= weeks * ONE_WEEK;
  const days = Math.floor(seconds / ONE_DAY);
  seconds -= days * ONE_DAY;
  const hours = Math.floor(seconds / ONE_HOUR);
  seconds -= hours * ONE_HOUR;
  const minutes = Math.floor(seconds / ONE_MINUTE);
  seconds -= minutes * ONE_MINUTE;
  const remainingSeconds = seconds % 60;

  let finalText = '';
  if (weeks !== 0) {
    finalText += `${weeks}wk `;
  }
  if (days !== 0) {
    finalText += `${days}d `;
  }
  if (hours !== 0) {
    finalText += `${hours}h `;
  }
  if (minutes !== 0) {
    finalText += `${minutes}m `;
  }
  if (seconds !== 0) {
    finalText += `${seconds}s`;
  }

  if (finalText === '') {
    // TODO: why would this ever happen?
    finalText += 'how did we get zero?';
  }

  // return `${weeks}${weekText} ${days}${dayText} ${hours}${hourText} ${seconds}${secondsText}`;
  return finalText;
}

function errorHandler(ev) {
  return function(err) {
    debug(`${ev} err`, err);
  };
};

class MpdManager {
  constructor() {
    this.mpd = mpd.connect({
      host: HOST,
      port: PORT,
    });

    Dispatcher.on(Actions.NOW_PLAYING_SONG, this.getNowPlaying.bind(this));
    Dispatcher.on(Actions.DISPLAY_PLAYLIST, this.displayPlaylist.bind(this));
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

    Promise.all(promises).then((values) => {
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
    }).catch(errorHandler('NOW_PLAYING_SONG'));
  }

  displayPlaylist(e) {
    debug('DISPLAY_PLAYLIST');
    const promises = [
      this.sendCommand('status', []),
      this.sendCommand('playlistinfo', []),
    ];

    Promise.all(promises).then((values) => {
      debug('DISPLAY_PLAYLIST cb');
      if (!values[1] || !values[1].length) {
        e.message.channel.sendMessage('No playlist to display');
        return;
      }

      const status = mpd.parseKeyValueMessage(values[0]);
      const songs = mpd.parseArrayMessage(values[1]);

      const currentIndex = parseInt(status.song) || 0;
      const songsFiltered = songs.filter(x => x.Time);
      const songSlice = songsFiltered.slice(currentIndex, currentIndex + 25);

      let totalTime = songsFiltered.reduce((p, v) => { return p + (parseInt(v.Time) || 0) }, 0);
      let msgToSend = songSlice.map((song) => {
        let name = '';
        if (song.Album && song.Title) {
          name = `${song.Album} - ${song.Title}`;
        } else {
          name = path.basename(song.file);
        }

        return `[${song.Id}] (${formatTime(song.Time)}) **${name}**`;
      }).join('\n');

      msgToSend += '\n\n';
      msgToSend += `Printed **${songSlice.length}** out of **${songsFiltered.length}**\n`;
      msgToSend += `**${reallyLongTime(totalTime)}** worth of audio queued total`;

      e.message.channel.sendMessage(msgToSend);
    }).catch(errorHandler('DISPLAY_PLAYLIST'));
  }
};

module.exports = new MpdManager();
