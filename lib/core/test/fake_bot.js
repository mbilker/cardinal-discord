"use strict";

class FakeBot {
  constructor(container) {
    this.container = container;

    this.logger = this.container.get('logger');
  }

  start() {
    this.logger.info('FakeBot started');
  }

  stop() {
    this.logger.info('FakeBot stopped');
  }
}

module.exports = function createBot(container) {
  return new FakeBot(container);
};
