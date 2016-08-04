"use strict";

const path = require('path');

const chalk = require('chalk');

class Main {
  constructor() {
    console.log('initializing Main');

    process.on('unhandledRejection', function onError(err) {
      throw err;
    });

    this.options = require('../package.json');

    this.buildContainer();
    this.setupLogger();
  }

  buildRepl() {
    this.repl = require('repl').start('> ');
    this.repl.context.Module = require('./API/Module');
    this.repl.context.Command = require('./API/Command');
    this.repl.context.CommandManager = require('./API/CommandManager');
  }

  buildContainer() {
    this.container = new Map();
  }

  setupLogger() {
    this.logger = require('./Logger')(path.join(__dirname, '..', 'logs'), 'cardinal');
    this.logger.level = 'debug';
    this.logger.exitOnError = true;

    this.container.set('logger', this.logger);

    console.log(chalk.blue(`\n\n\t${this.options.name} v${this.options.version} - by ${this.options.author}\n\n`));
  }
}

module.exports = Main;
