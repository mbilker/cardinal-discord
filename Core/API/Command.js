"use strict";

const CommandManager = require('./CommandManager');

class Command {
  static get name() {
    throw new Error('Command must override get name()');
  }

  static get description() {
    throw new Error('Command must override get description()');
  }

  constructor(container) {
    if (this.constructor === Command) {
      throw new Error('Cannot instantiate command class');
    }

    this.container = container;

    this.client = container.get('client');
  }

  register() {
    throw new Error('Command must override register()');
  }

  hears(regex, cb) {
    return CommandManager.register(this, regex, cb);
  }
}

module.exports = Command;
