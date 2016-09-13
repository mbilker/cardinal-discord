"use strict";

const path = require('path');

const chalk = require('chalk');

const Command = require('./API/Command');
const CommandManager = require('./CommandManager.js');
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
    this.run();
  }

  buildRepl() {
    this.repl = require('repl').start('> ');
    this.repl.context.Module = Module;
    this.repl.context.Command = Command;
    this.repl.context.CommandManager = CommandManager;
  }

  buildContainer() {
    this.container = new Map();

    this.setupLogger();
    this.setupBrain();

    this.commandManager = new CommandManager(this.container);
    this.container.set('commandManager', this.commandManager);

    this.loadedModules = new Map();
    this.container.set('loadedModules', this.loadedModules);
  }

  setupLogger() {
    this.logger = require('./Logger')(path.join(__dirname, '..', 'logs'), 'cardinal');
    this.container.set('logger', this.logger);
  }

  setupBrain() {
    const RedisBrain = require('./Brain/Redis');

    this.brain = new RedisBrain();
    this.container.set('redisBrain', this.brain);
  }

  loadClient() {
    this.logger.info('Main::loadClient()');

    this.bot = require('./Bot')(this.container);
    this.container.set('bot', this.bot);
  }

  loadModules() {
    const { modules } = this.options;

    this.logger.info('Main::loadModules()');

    for (const module of modules) {
      if (!(module.prototype instanceof Module)) {
        this.logger.warn(`${module.name} does not inherit from the Module class`);
        continue;
      }

      this.logger.info(`Initializing ${module.name}`);

      const moduleInstance = new (module)(this.container);
      this.loadedModules.set(module.name, moduleInstance);

      this.logger.info(`Initialized ${module.name}`);
    }
  }

  run() {
    console.log(chalk.blue(`\n\n\t${this.packageOptions.name} v${this.packageOptions.version} - by ${this.packageOptions.author}\n\n`));

    if (this.options.prefix) {
      this.logger.info(`Set command prefix to '${this.options.prefix}'`);
      this.commandManager.setPrefix(this.options.prefix);
    }

    this.loadClient();
    this.loadModules();

    this.bot.start();
  }
}

exports.initialize = function initialize(opts) {
  return new Main(opts);
};
