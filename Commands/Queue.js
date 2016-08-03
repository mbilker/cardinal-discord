"use strict";

const Command = require('../Core/Command');

const RedisBrain = require('../Core/Brain/Redis');

const QueuedMedia = require('../queue/queued-media');

class Queue extends Command {
  static get name() {
    return 'queue';
  }

  static get description() {
    return 'Queue up music to play in the server.';
  }

  constructor() {
    super();

    this.currentlyPlaying = null;
    this.voiceConnection = null;

    this.QueuedMedia = QueuedMedia;
  }

  getRedisKey(guildId) {
    return `cardinal.${guildId}:music_queue`;
  }

  handle() {
    this.responds(/^np$/g, (m) => {
      if (this.currentlyPlaying === null) {
        m.channel.sendMessage('No queued song');
        return;
      }

      m.channel.sendMessage(this.currentlyPlaying.printString());
    });
  }
}
