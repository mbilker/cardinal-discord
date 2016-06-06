const debug = require('debug');

debug.enable('hubot*,cardinal*');

//require('./icy.js');
//require('./mpd.js');
require('./queue.js');
require('./nicehash.js');
//require('./web.js');

const bot = require('./bot.js');
bot.start();
