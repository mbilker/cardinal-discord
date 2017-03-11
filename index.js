const debug = require('debug');

debug.enable('hubot*,cardinal*');

const Main = require('./Core/Main');

const BackupCommand = require('./modules/dump');
const EvalCommand = require('./modules/eval');
const HelpCommand = require('./modules/help');
const MathCommand = require('./modules/math');
const Nicehash = require('./modules/nicehash');
const PingPong = require('./modules/pingpong');
const Queue = require('./modules/queue');
const BotStatus = require('./modules/status');

Queue.useMPD = false;

Main.initialize({
  prefix: '`',
  modules: [BackupCommand, EvalCommand, HelpCommand, MathCommand, Nicehash, PingPong, Queue, BotStatus],

  redisUrl: process.env.REDIS_URL || 'redis://localhost',

  settings: {
    nicehashAddress: '1KiMjCRxfUcwydcUo77gqTDh4sQzGVJ3P5',

    mpd: {
      host: 'turret.lab.mbilker.us',
      port: 6600,
      baseDirectory: '/storage/media/mpd'
    }
  }
});
