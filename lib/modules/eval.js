"use strict";

const util = require('util');

const Module = require('../core/api/module');

const PREFIX = 'Result:\n```javascript\n';
const SUFFIX = '\n```';
const NO_SPACE = 'This response is too long. Shortening to ~2000 characters:\n```javascript';

class EvalCommand extends Module {
  constructor(container) {
    super(container);

    this.hears(/eval/i, this.onEvalCommand);
  }

  onEvalCommand(m, args) {
    if (m.author.id !== '142098955818369024') {
      this.logger.info(`User ${m.author.username} (${m.author.id}) tried to eval ${args}`);
      m.channel.sendMessage(`${m.author.mention} You are not authorized to perform this action.`);
      return;
    }

    this.logger.debug(`EXECUTE_JS ${args}`);

    let promise = null;
    const text = args.join(' ');

    this.logger.debug(`EXECUTE_JS 2 ${text}`);

    return new Promise((resolve, reject) => {
      resolve(eval(text));
    }).then((res) => {
      //this.logger.debug('EXECUTE_JS res', res);

      const inspect = util.inspect(res);
      let string = `${PREFIX}${inspect}${SUFFIX}`;
      this.logger.debug(`EXECUTE_JS length ${string.length}`);

      // max length of message is 2000 characters
      if (string.length > 2000) {
        const stringTwo = `${PREFIX}${inspect.substring(0, 2000 - PREFIX.length - SUFFIX.length - 3)}...${SUFFIX}`;
        m.channel.sendMessage(stringTwo);
      } else {
        m.channel.sendMessage(string);
      }
    }, (err) => {
      const errMsg = err ? err.stack : 'no error message';
      m.reply('Something went wrong:\n```\n' + errMsg + '\n```');
    });
  }
}

module.exports = EvalCommand;
