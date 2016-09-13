"use strict";

//const debug = require('debug')('cardinal:command-manager');

class CommandManager {
  constructor(container) {
    this.container = container;
    this.logger = container.get('logger');

    this._commands = {};
    this._prefix = null;
  }

  setPrefix(prefix) {
    this._prefix = prefix;
  }

  add(mod, cmd, func) {
    this._commands[cmd] = func;
  }

  /**
   * Precondition: msg != null, msg.content != null
   */
  handle(msg, errCb) {
    const content = msg.content.trim();

    if (!content.startsWith(this._prefix)) return false;

    this.logger.debug(`handling ${content}`);

    const fullCmd = content.slice(this._prefix.length);
    const args = fullCmd.split(' ').filter(x => x.length);
    const name = args[0].toLowerCase();

    this.logger.debug(`args: ${args}`);

    const func = this._commands[name];
    if (func) {
      let res = null;
      try {
        res = func(msg, args.slice(1));
      } catch (err) {
        errCb(err);
      }
    }

    return false;
  }
}

module.exports = CommandManager;
