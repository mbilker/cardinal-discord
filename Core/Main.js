"use strict";

const path = require('path');

const chalk = require('chalk');

const CommandManager = require('./CommandManager.js');
const Module = require('./API/Module');

const packageOptions = require('../package.json');

class Main {
  constructor(opts) {
    process.on('unhandledRejection', function onError(err) {
      throw err;
    });

    this.packageOptions = packageOptions;
    this.options = opts;

    this.commandManager = null;
    this.loadedModules = null;

    this.buildContainer();
    this.run();
    this.buildRepl();
  }

  buildRepl() {
    this.repl = require('repl').start('> ');
    this.initializeReplContext(this.repl.context);

    this.repl.on('reset', this.initializeReplContext.bind(this));
    this.repl.on('exit', this.shutdown.bind(this));
  }

  initializeReplContext(context) {
    context.Module = Module;
    context.CommandManager = CommandManager;

    context.Utils = require('../queue/utils');

    context.main = this;
    context.container = this.container;
  }

  buildContainer() {
    this.container = new Map();

    this.container.set('shutdownMode', false);
    this.container.set('environment', this.options.environment);
    this.container.set('settings', this.options.settings);

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

    this.brain = new RedisBrain(this.options.redisUrl);
    this.container.set('redisBrain', this.brain);
  }

  loadClient() {
    this.logger.info('Main::loadClient()');

    this.bot = require('./Bot')(this.container);
    this.container.set('bot', this.bot);

    this.commandManager.botReady();
  }

  loadModules() {
    const modules = this.options.modules;

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

  shutdownModules() {
    this.logger.info('Main::shutdownModules()');

    for (const [name, module] of this.loadedModules) {
      if (module.shutdown && typeof(module.shutdown) === 'function') {
        this.logger.info(`Shutting down ${module.constructor.name}`);

        module.shutdown();

        this.logger.info(`Shut down ${module.constructor.name}`);
      }
    }
  }

  run() {
    console.log(chalk.blue(`\n\n\t${this.packageOptions.name} v${this.packageOptions.version} - by ${this.packageOptions.author}\n\n`));

    if (this.options.environment !== 'production') {
      console.log(chalk.yellow(`\tRunning in ${this.options.environment} mode. Not connecting to Discord.\n\n`));
    }

    if (this.options.prefix) {
      this.logger.info(`Set command prefix to '${this.options.prefix}'`);
      this.commandManager.setPrefix(this.options.prefix);
    }

    this.loadClient();
    this.loadModules();

    this.bot.start();
  }

  shutdown() {
    this.logger.info('Main::shutdown()');

    this.container.set('shutdownMode', true);
    this.shutdownModules();

    this.bot.client.disconnect();
    this.brain.quit();

    //process.exit();
  }
}

exports.initialize = function initialize(opts) {
  return new Main(opts);
};
