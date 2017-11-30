#!/usr/bin/env node

const Main = require('./lib/core/main');

let environment = process.env.NODE_ENV || 'production';
if (process.argv.length > 2) {
  if (process.argv[2] === '--testing') {
    environment = 'testing';
  }
}

Main.initialize({
  environment: environment,

  prefix: '`',
  modules: [
    'dump',
    'eval',
    'help',
    'management',
    'math',
    'nicehash',
    'pingpong',
    'queue',
    'status'
  ],

  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    user: process.env.POSTGRES_USER || 'cardinal',
    password: process.env.POSTGRES_PASSWORD || 'cardinal',
    database: process.env.POSTGRES_DATABASE || 'cardinal',
  },

  redisUrl: process.env.REDIS_URL || 'redis://localhost',

  settings: {
    nicehashAddress: '1KiMjCRxfUcwydcUo77gqTDh4sQzGVJ3P5',

    elasticsearch: {
      enable: true,
      host: 'localhost:9200'
    }
  }
});
