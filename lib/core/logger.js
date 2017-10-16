"use strict";

const tracer = require('tracer');

module.exports = function createLogger(logDir, name) {
  const logger = tracer.colorConsole();

  return logger;
};
