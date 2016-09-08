"use strict";

const Command = require('./Command');

class Module {
  constructor(container) {
    this.container = container;

    this.logger = container.get('logger');
    this.commandManager = container.get('commandManager');
  }

  registerCommand(cmd) {
    if (!(cmd instanceof Command)) {
      throw new Error('registerCommand(cmd): cmd not instance of Command');
    }

    return this.commandManager.add(this, cmd);
  }

  registerCommands(cmds) {
    for (const cmd of cmds) {
      this.registerCommand(cmd);
    }
  }
}

module.exports = Module;
