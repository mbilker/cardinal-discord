"use strict";

const Command = require('../Core/Command');

const QueueServer = require('../queue/instance');

class Queue extends Command {
  static get name() {
    return 'queue';
  }

  static get description() {
    return 'Queue up music to play in the server.';
  }

  constructor(container) {
    super(container);
  }

  getRedisKey(guildId) {
    return `cardinal.${guildId}:music_queue`;
  }

  register() {
    this.hears(/^np$/g, (m) => {
      if (QueueServer.currentlyPlaying === null) {
        m.channel.sendMessage('No queued song');
        return;
      }

      m.channel.sendMessage(QueueServer.currentlyPlaying.printString());
    });
  }
}
