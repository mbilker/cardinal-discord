"use strict";

const Command = require('./Command');
const CommandManager = require('./CommandManager');

class Module {
  registerCommand(cmd) {
    if (!(cmd instanceof Command)) {
      throw new Error('registerCommand(cmd): cmd not instance of Command');
    }

    return CommandManager.add(this, cmd);
  }

  registerCommands(cmds) {
    for (const cmd of cmds) {
      this.registerCommand(cmd);
    }
  }
}

module.exports = Module;
