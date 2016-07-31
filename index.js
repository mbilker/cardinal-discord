const debug = require('debug');

debug.enable('hubot*,cardinal*');

//require('./icy.js');
//require('./mpd.js');
const queue = require('./queue.js');
const nicehash = require('./nicehash.js');
const status = require('./status.js');
//require('./web.js');

const bot = require('./bot.js');
bot.start();

const repl = require('repl').start('> ');
repl.context.Module = require('./Core/Module');
repl.context.Command = require('./Core/Command');
repl.context.CommandManager = require('./Core/CommandManager');

repl.context.queue = queue;
repl.context.nicehash = nicehash;
repl.context.status = status;
