"use strict";

const util = require('util');

class CommandManager {
  constructor(container) {
    this.container = container;

    this.bot = null;
    this.logger = container.get('logger');

    this.commandRegex = '^${prefix}(\\S+)';

    this._commands = {};
    this._listeners = new Map();
    this._commandRegex = null;
    this._prefix = null;
  }

  botReady() {
    this.bot = this.container.get('bot');
  }

  setPrefix(prefix) {
    const regexString = this.commandRegex.replace('${prefix}', prefix);

    this._commandRegex = new RegExp(regexString);
    this._prefix = prefix;

    this.logger.info(`Set command prefix to '${prefix}' (commandRegex: ${this._commandRegex})`);
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

    const args = content.split(' ').filter(x => x.length);
    if (args.length < 1) {
      return Promise.resolve();
    }

    const firstArg = args.shift().toLowerCase();
    const nameMatch = this._commandRegex.exec(firstArg);
    if (!nameMatch || !nameMatch[1]) {
      this.logger.error(`No command name found (firstArg: ${firstArg})`);
      return Promise.resolve();
    }
    const name = nameMatch[1];

    this.logger.debug(`name: ${name}, args: ${args}`);

    const func = this._commands[name];
    if (func) {
      this.logger.debug(`Found registered command for ${name}`);

      const res = func(msg, args);
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
