"use strict";

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
    this.commandManager = container.get('commandManager');
  }

  register() {
    throw new Error('Command must override register()');
  }

  hears(regex, cb) {
    return this.commandManager.register(this, regex, cb);
  }
}

module.exports = Command;
