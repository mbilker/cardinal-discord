const debug = require('debug');

debug.enable('hubot*,cardinal*');

const Main = require('./Core/Main');

const EvalCommand = require('./modules/eval');
const Queue = require('./modules/queue');

Main.initialize({
  prefix: '`',
  modules: [Queue, EvalCommand /* , Nicehash, Status */ ]
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
