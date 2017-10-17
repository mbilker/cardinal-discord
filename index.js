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

  redisUrl: process.env.REDIS_URL || 'redis://localhost',

  queue: {
    useMpd: false
  },

  settings: {
    nicehashAddress: '1KiMjCRxfUcwydcUo77gqTDh4sQzGVJ3P5',

    mpd: {
      host: 'turret.lab.mbilker.us',
      port: 6600,
      baseDirectory: '/storage/media/mpd'
    }
  }
});
