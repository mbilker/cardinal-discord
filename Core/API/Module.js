"use strict";

class Module {
  constructor(container) {
    this.container = container;

    this.logger = container.get('logger');
    this.commandManager = container.get('commandManager');
  }

  hears(cmd, func) {
    this.logger.debug(`${this.constructor.name} registered ${cmd} with ${func.name}`);

    this.commandManager.add(this, cmd.toString().split('/')[1], func);
  }
}

module.exports = Module;
