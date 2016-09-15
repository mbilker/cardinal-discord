"use strict";

const Module = require('../Core/API/Module');

const helpCommandMap = require('../helpText.json');

class HelpCommand extends Module {
  constructor(container) {
    super(container);

    this.hears(/help/i, this.onHelpCommand.bind(this));
  }

  onHelpCommand(m) {
    const prefix = this.commandManager._prefix;

    // TODO: add API to get commands from command manager
    const lines = Object.keys(this.commandManager._commands).map((cmd) =>
      `- ${prefix}${cmd}\n  ${helpCommandMap[cmd] || 'no text available'}`
    ).join('\n');

    m.channel.sendMessage('```' + lines + '```');
  }
}

module.exports = HelpCommand;