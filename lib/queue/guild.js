"use strict";

const fs = require('fs');
const path = require('path');
const url = require('url');
const util = require('util');

const Module = require('../core/api/module');

const Types = require('../queue/types');
const LocalMusicSearch = require('../queue/search');
const Utils = require('../queue/utils');
const QueuedMedia = require('../queue/queued-media');

const YOUTUBE_PREFIX = 'https://www.youtube.com/watch?v=';

class GuildMusicPlayer {
  constructor(container, guildId) {
    this.container = container;
    this.guildId = guildId;

    this.bot = this.container.get('bot');
    this.redisClient = this.container.get('redisBrain');
    this.settings = this.container.get('settings');

    this.utils = new Utils(container);

    this.currentlyPlaying = null;
    this.voiceConnection = null;

    this.QueuedMedia = QueuedMedia;
  }

  getCurrentlyPlaying() {
    return this.currentlyPlaying;
  }

  setCurrentlyPlaying(currentlyPlaying) {
    this.currentlyPlaying = currentlyPlaying;
  }

  getCurrentlyPlayingMessage() {
    if (!this.currentlyPlaying) {
      return Promise.reject('No currently playing song');
    }

    return this.formatMessage(this.currentlyPlaying);
  }

  formatMessage(entry) {
    return new Promise((resolve, reject) => {
      const {
        title,
        url,
        time,
        duration,
        encoding,
        ownerId
      } = entry;;

      // Line format
      // "[Track Name](link to source) | `[format][0:50 / 1:20, 44%][Requested by: Felix]`"

      let timeStatus = `${this.utils.formatTime(time | 0)}`;
      if (duration > 0) {
        const percentage = ((time / duration) * 100) | 0;

        timeStatus += ` / ${this.utils.formatTime(duration)}, ${percentage}%`;
      }

      const username = this.bot.client.Users.get(ownerId).username;

      const output = `[${title}](${url}) | ` + "`" + `[${encoding}][${timeStatus}][Requested by: ${username}]` + "`";
      resolve(output);
    });
  }
}

module.exports = GuildMusicPlayer;
