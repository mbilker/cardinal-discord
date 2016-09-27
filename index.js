const debug = require('debug');

debug.enable('hubot*,cardinal*');

const Main = require('./Core/Main');

const EvalCommand = require('./modules/eval');
const HelpCommand = require('./modules/help');
const MathCommand = require('./modules/math');
const Nicehash = require('./modules/nicehash');
const PingPong = require('./modules/pingpong');
const Queue = require('./modules/queue');
const BotStatus = require('./modules/status');

Main.initialize({
  prefix: '`',
  modules: [EvalCommand, HelpCommand, MathCommand, Nicehash, PingPong, Queue, BotStatus ]
});

//require('./icy.js');
//require('./mpd.js');
//const status = require('./status.js');
//require('./web.js');
