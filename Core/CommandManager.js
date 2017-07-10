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

  handleCommands(msg) {
    const content = msg.content.trim();

    if (!content.startsWith(this._prefix)) {
      return Promise.resolve();
    }

    this.logger.debug(`Handling commands for ${content}`);

    const fullCmd = content.slice(this._prefix.length);
    const args = fullCmd.split(' ').filter((x, i) => x.length && i == 0);
    const name = args[0].toLowerCase();

    this.logger.debug(`args: ${args}`);

    const func = this._commands[name];
    if (func) {
      this.logger.debug(`Found registered command for ${name}`);

      const res = func(msg, args.slice(1));
      const promise = Promise.resolve(res).then((ret) => {
        this.logger.debug(`${name} ret`, ret);
      }).catch((err) => {
        this.logger.error(`${name} threw error ${err.stack}`);
        throw err;
      });

      return promise;
    }
  }

  handleListeners(msg) {
    const content = msg.content.trim();
    let promises = [];

    this.logger.debug(`Handling listeners for ${util.format(content)}`);

    for (const arr of this._listeners) {
      const cmd = arr[0];
      const func = arr[1];
      const contentMatches = cmd.test(content);

      if (contentMatches) {
        this.logger.debug(`${cmd} matches content`);

        const res = func(msg);
        const promise = Promise.resolve(res).then((ret) => {
          this.logger.debug(`${cmd} ret ${ret}`);
        }).catch((err) => {
          this.logger.error(`${cmd} threw error ${err.stack}`);
          throw err;
        });

        promises.push(promise);
      }
    }

    return Promise.all(promises);
  }

  handle(msg) {
    if (!msg.content) {
      return Promise.resolve();
    } else if (msg.author.id === this.bot.client.User.id) {
      return Promise.resolve();
    }

    return Promise.resolve().then(() =>
      this.handleListeners(msg)
    ).then(() =>
      this.handleCommands(msg)
    );
  }
}

module.exports = CommandManager;
