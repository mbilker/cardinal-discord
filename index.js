const debug = require('debug');

debug.enable('hubot*');

require('./icy.js');
require('./mpd.js');
require('./web.js');
require('./bot.js');
