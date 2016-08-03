"use strict";

const Command = require('../Core/Command');
const Module = require('../Core/Module');

const bot = require('../bot');

class Ping extends Module {
  constructor() {
    super();

    this.registerCommands([
      new Command(this, 'ping', onPing),
      new Command(this, 'pong', onPong),
    ]);
  }

  onPing(m) {
    if (m.author.id !== bot.client.User.id) {
      return m.channel.sendMessage('pong');
    }

    return false;
  }

  onPong(m) {
    if (m.author.id !== bot.client.User.id) {
      return m.channel.sendMessage('ping');
    }

    return false;
  }
}

module.exports = new Ping();
