"use strict";

const path = require('path');

const chalk = require('chalk');

const Module = require('./API/Module');

class Main {
  constructor(opts) {
    process.on('unhandledRejection', function onError(err) {
      throw err;
    });

    this.packageOptions = require('../package.json');
    this.options = opts;

    this.commandManager = null;
    this.loadedModules = null;

    this.buildContainer();
    this.setupLogger();
    this.run();
  }

  buildRepl() {
    this.repl = require('repl').start('> ');
    this.repl.context.Module = Module;
    this.repl.context.Command = require('./API/Command');
    this.repl.context.CommandManager = require('./CommandManager');
  }

  buildContainer() {
    this.container = new Map();

    this.commandManager = require('./CommandManager')(this.container);
    this.container.set('commandManager', this.commandManager);

    this.loadedModules = new Map();
    this.container.set('loadedModules', this.loadedModules);
  }

  setupLogger() {
    this.logger = require('./Logger')(path.join(__dirname, '..', 'logs'), 'cardinal');   this.logger.level = 'debug';
    this.logger.exitOnError = true;

    this.container.set('logger', this.logger);
  }

  run() {
    console.log(chalk.blue(`\n\n\t${this.packageOptions.name} v${this.packageOptions.version} - by ${this.packageOptions.author}\n\n`));

    const { modules } = this.options;

    for (const module of modules) {
      if (!(module.prototype instanceof Module)) {
        this.logger.warn(`${module.name} does not inherit from the Module class`);
        continue;
      }

      this.logger.info(`Initializing ${module.name}`);

      const moduleInstance = new (module)(this.container);
      this.loadedModules.set(module.name, moduleInstance);
    }
  }
}

exports.initialize = function initialize(opts) {
  return new Main(opts);
};
