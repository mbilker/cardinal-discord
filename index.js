const debug = require('debug');

debug.enable('hubot*,cardinal*');

const Main = require('./Core/Main');

const EvalCommand = require('./modules/eval');
const HelpCommand = require('./modules/help');
const Nicehash = require('./modules/nicehash');
const Queue = require('./modules/queue');

Main.initialize({
  prefix: '`',
  modules: [EvalCommand, HelpCommand, Nicehash, Queue /* , Status */ ]
});

//require('./icy.js');
//require('./mpd.js');
//const queue = require('./queue.js');
//const nicehash = require('./nicehash.js');
//const status = require('./status.js');
//require('./web.js');

//const bot = require('./bot.js');
//bot.start();

// Old REPL Start
//repl.context.queue = queue;
//repl.context.nicehash = nicehash;
//repl.context.status = status;
// Old REPL End
