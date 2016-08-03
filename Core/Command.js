"use strict";

class Command {
  constructor(mod, commandName, handler) {
    this.parent = mod;
    this._commandName = commandName;
    this.handler = handler.bind(mod);

    console.log(`registered ${commandName}`);
  }

  get name() {
    return this._commandName;
  }

  handle(msg, args) {
    return this.handler(msg, args);
  }
}

module.exports = Command;
