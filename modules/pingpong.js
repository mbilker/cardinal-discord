"use strict";

const Module = require('../Core/API/Module');

class PingPong extends Module {
  constructor(container) {
    super(container);

    this.bot = container.get('bot');

    this.listens(/ping/i, this.onPing.bind(this));
    this.listens(/pong/i, this.onPong.bind(this));
  }

  onPing(m) {
    return m.channel.sendMessage('pong');
  }

  onPong(m) {
    return m.channel.sendMessage('ping');
  }
}

module.exports = PingPong;
