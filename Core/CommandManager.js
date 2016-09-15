"use strict";

const util = require('util');

class CommandManager {
  constructor(container) {
    this.container = container;

    this.bot = null;
    this.logger = container.get('logger');

    this._commands = {};
    this._listeners = new Map();
    this._prefix = null;
  }

  botReady() {
    this.bot = this.container.get('bot');
  }

  setPrefix(prefix) {
    this._prefix = prefix;
  }

  add(mod, cmd, func, withNoPrefix) {
    if (withNoPrefix) {
      this._listeners.set(cmd, func);
    } else {
      this._commands[cmd] = func;
    }
  }

  handleCommands(msg, errCb) {
    const content = msg.content.trim();

    if (!content.startsWith(this._prefix)) {
      return false;
    }

    this.logger.debug(`handling ${content}`);

    const fullCmd = content.slice(this._prefix.length);
    const args = fullCmd.split(' ').filter(x => x.length);
    const name = args[0].toLowerCase();

    this.logger.debug(`args: ${args}`);

    const func = this._commands[name];
    if (func) {
      this.logger.debug(`found registered command for ${name}`);

      let res = null;
      try {
        res = func(msg, args.slice(1));
      } catch (err) {
        errCb(err);
      }

      return res;
    }

    return false;
  }

  handleListeners(msg, errCb) {
    const content = msg.content.trim();

    this.logger.debug(`Handling ${util.format(content)}`);

    for (const arr of this._listeners) {
      const cmd = arr[0];
      const func = arr[1];
      const contentMatches = cmd.test(content);

      if (contentMatches) {
        this.logger.debug(`${cmd} matches content`);

        try {
          func(msg);
        } catch (err) {
          errCb(err);
        }
      }
    }
  }

  handle(msg, errCb) {
    if (msg.author.id === this.bot.client.User.id) {
      return false;
    }

    this.handleListeners(msg, errCb);
    return this.handleCommands(msg, errCb);
  }
}

module.exports = CommandManager;
