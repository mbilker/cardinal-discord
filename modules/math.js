"use strict";

const mathjs = require('mathjs');

const Module = require('../Core/API/Module');

class MathCommand extends Module {
  constructor(container) {
    super(container);

    this.hears(/math/i, this.onMathCommand.bind(this));
  }

  onMathCommand(m, args) {
    let result = null;
    const text = args.join(' ');

    try {
      result = mathjs.eval(text);

      m.reply(result);
    } catch (err) {
      const errMsg = err ? err.stack : 'no error message';
      m.reply('Something went wrong:\n```\n' + errMsg + '\n```');
    }
  }
}

module.exports = MathCommand;
