const debug = require('debug');

debug.enable('hubot*');

require('./icy.js');
require('./web.js');
require('./bot.js');
