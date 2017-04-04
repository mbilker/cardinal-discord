"use strict";

class Module {
  constructor(container) {
    this.container = container;

    this.logger = container.get('logger');
    this.commandManager = container.get('commandManager');
  }

  getRedisKey(guildId, ...scopes) {
    const scope = (scopes.length > 0 ? '.' : '') + scopes.join('.');
    return `cardinal.${guildId}${scope}`;
  }

  hears(cmd, func) {
    this.logger.debug(`${this.constructor.name} registered ${cmd} with ${func.name}`);

    this.commandManager.add(this, cmd.toString().split('/')[1], func.bind(this));
  }

  listens(cmd, func) {
    this.logger.debug(`${this.constructor.name} registered ${cmd} with ${func.name}`);

    this.commandManager.add(this, cmd, func.bind(this), true);
  }
}

module.exports = Module;
