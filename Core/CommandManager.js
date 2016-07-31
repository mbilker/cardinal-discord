"use strict";

const debug = require('debug')('cardinal:command-manager');

class CommandManager {
  constructor() {
    this._commands = {};
    this._prefix = null;
  }

  setPrefix(prefix) {
    debug(`set prefix to ${prefix}`);
    this._prefix = prefix;
  }

  add(mod, cmd) {
    this._commands[cmd.name] = cmd;
  }

  /**
   * Precondition: msg != null, msg.content != null
   */
  handle(msg) {
    const content = msg.content.trim();

    if (!content.startsWith(this._prefix)) return false;

    debug(`handling ${content}`);

    const fullCmd = content.slice(this._prefix.length);
    const args = fullCmd.split(' ').filter(x => x.length);
    const name = args[0].toLowerCase();

    debug(`args: ${args}`);

    const cmd = this._commands[name];
    if (cmd) {
      return cmd.handle(msg);
    }

    return false;
  }
}

module.exports = new CommandManager();
