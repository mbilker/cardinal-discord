"use strict";

const repl = require('repl');

const CommandManager = require('./command_manager');
const Module = require('./api/module');

class RemoteManagement {
  constructor(container) {
    this.container = container;

    this.shutdownCallback = null;
  }

  start() {
    this.repl = require('repl').start('> ');
    this.initializeReplContext(this.repl.context);

    this.repl.on('reset', this.initializeReplContext.bind(this));
    this.repl.on('exit', this.shutdown.bind(this));
  }

  shutdown() {
    if (this.shutdownCallback) {
      this.shutdownCallback();
    }
  }

  close() {
    if (this.repl) {
      this.repl.close();
    }
  }

  initializeReplContext(context) {
    context.Module = Module;
    context.CommandManager = CommandManager;

    context.QueueUtils = require('../queue/utils');

    context.main = this;
    context.container = this.container;
  }

  setShutdownCallback(cb) {
    this.shutdownCallback = cb;
  }
}

module.exports = RemoteManagement;
