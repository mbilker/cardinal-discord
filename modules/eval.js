"use strict";

const Module = require('../Core/API/Module');

const PREFIX = 'Result:\n```javascript\n';
const SUFFIX = '\n```';
const NO_SPACE = 'This response is too long. Shortening to ~2000 characters:\n```javascript';

class EvalCommand extends Module {
  constructor(container) {
    super(container);

    this.hears(/^eval/i, this.onEvalCommand.bind(this));
  }

  onEvalCommand(m) {
    const args = [];

    if (m.author.id !== '142098955818369024') {
      this.logger.info(`User ${m.author.username} (${m.author.id}) tried to eval ${args}`);
      m.channel.sendMessage(`${m.author.mention} You are not authorized to perform this action.`);
      return;
    }

    this.logger.debug(`EXECUTE_JS ${args}`);

    let res = null;
    const text = args.slice(1).join(' ');

    this.logger.debug(`EXECUTE_JS 2 ${text}`);

    try {
      res = eval(text);
      this.logger.debug('EXECUTE_JS res', res);

      const inspect = util.inspect(res);
      let string = `${prefix}${inspect}${suffix}`;
      this.logger.debug(`EXECUTE_JS length ${string.length}`);

      // max length of message is 2000 characters
      if (string.length > 2000) {
        const stringTwo = `${prefix}${inspect.substring(0, 2000 - prefix.length - suffix.length - 3)}...${suffix}`;
        m.channel.sendMessage(stringTwo);
      } else {
        m.channel.sendMessage(string);
      }
    } catch (errr) {
      const errMsg = err ? err.stack : 'no error message';
      m.channel.sendMessage('Something went wrong:\n```\n' + errMsg + '\n```');
    }
  }
}

module.exports = EvalCommand;
