const Actions = require('./actions');
const Dispatcher = require('./dispatcher');

require('./icy.js');

Dispatcher.emit(Actions.DISCORD_JOINED_VOICE_CHANNEL);
