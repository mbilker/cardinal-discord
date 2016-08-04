"use strict";

const winston = require('winston');

module.exports = function createLogger(logDir, name) {
  let transports = [
    new winston.transports.Console({
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: true,
      handleExceptions: true,
    }),
  ];

  if (logDir !== null) {
    transports.push(new winston.transports.File({
      filename: `${logDir}/${name}.log`,
      colorize: false,
      timestamp: true,
      json: true,
    }));
  }

  const logger = new winston.Logger({ transports });
  logger.cli();

  return logger;
};
