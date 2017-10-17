"use strict";

const path = require('path');

const chalk = require('chalk');

const CommandManager = require('./command_manager');
const Module = require('./api/module');
const RemoteManagement = require('./remote_management');
const Secrets = require('./secrets');

const packageOptions = require('../../package.json');
const oauth = require('../../oauth_token.json');
const ids = require('../../ids.json');

class Main {
  constructor(opts) {
    process.on('unhandledRejection', function onError(err) {
      throw err;
    });

    this.packageOptions = packageOptions;
    this.options = opts;

    this.commandManager = null;
    this.loadedModules = null;

    this.readyPromises = [];

    this.printStartupMessage();
    this.buildContainer();
    this.run();

    process.on('SIGTERM', () => this.shutdown());
  }

  buildContainer() {
    this.container = new Map();

    this.container.set('shutdownMode', false);
    this.container.set('environment', this.options.environment);
    this.container.set('settings', this.options.settings);
    this.container.set('ids', ids);

    this.setupLogger();
    this.setupBrain();

    this.commandManager = new CommandManager(this.container);
    this.container.set('commandManager', this.commandManager);

    this.loadedModules = new Map();
    this.container.set('loadedModules', this.loadedModules);

    this.secrets = Secrets;
    this.secrets.set('oauth', oauth);
    this.container.set('secrets', this.secrets);
  }

  setupRemoteManagement() {
    this.remoteManagement = new RemoteManagement(this.container);
    this.remoteManagement.setShutdownCallback(() => this.shutdown());
    this.remoteManagement.start();
  }

  setupLogger() {
    this.logger = require('./logger')(path.join(__dirname, '..', 'logs'), 'cardinal');
    this.container.set('logger', this.logger);
  }

  setupBrain() {
    const RedisBrain = require('./brain/redis');

    this.brain = new RedisBrain(this.options.redisUrl);
    this.container.set('redisBrain', this.brain);

    const promise = new Promise((resolve, reject) => {
      this.logger.info('Waiting for Redis conncetion...');

      this.brain.once('ready', () => {
        this.logger.info('Redis connection established');

        resolve();
      });
    });

    this.readyPromises.push(promise);
  }

  loadClient() {
    this.logger.info('Main::loadClient()');

    this.bot = require('./bot')(this.container);
    this.container.set('bot', this.bot);

    this.commandManager.botReady();
  }

  loadModules() {
    const modules = this.options.modules;

    this.logger.info('Main::loadModules()');

    for (const moduleName of modules) {
      const module = require(`../modules/${moduleName}`);

      if (!(module.prototype instanceof Module)) {
        this.logger.error(`${module.name} does not inherit from the Module class`);
        continue;
      }

      this.logger.info(`Initializing ${module.name}`);

      const moduleInstance = new (module)(this.container);
      this.loadedModules.set(module.name, moduleInstance);

      this.logger.info(`Initialized ${module.name}`);
    }
  }

  printStartupMessage() {
    console.log(chalk.blue(`\n\n\t${this.packageOptions.name} v${this.packageOptions.version} - by ${this.packageOptions.author}\n\n`));

    if (this.options.environment !== 'production') {
      console.log(chalk.yellow(`\tRunning in ${this.options.environment} mode. Not connecting to Discord.\n\n`));
    }
  }

  run() {
    Promise.all(this.readyPromises).then(() => {
      this.logger.info('Ready to start');

      if (this.options.prefix) {
        this.commandManager.setPrefix(this.options.prefix);
      }

      this.loadClient();
      this.loadModules();

      this.setupRemoteManagement();

      this.bot.start();
    });
  }

  shutdown() {
    if (this.container.get('shutdownMode')) {
      return;
    }

    this.logger.info('Main::shutdown()');

    this.container.set('shutdownMode', true);
    this.remoteManagement.close();

    this.shutdownModules();

    if (this.bot) {
      this.bot.client.disconnect();
    }
    this.brain.quit();
  }

  shutdownModules() {
    this.logger.info('Main::shutdownModules()');

    for (const [name, module] of this.loadedModules) {
      if (module.shutdown && typeof(module.shutdown) === 'function') {
        const name = module.constructor.name;

        this.logger.info(`Shutting down ${name}`);

        module.shutdown();
      }
    }
  }
}

exports.initialize = function initialize(opts) {
  return new Main(opts);
};
