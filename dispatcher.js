const EventEmitter = require('events').EventEmitter;

const dispatcher = new EventEmitter();

process.on('SIGINT', function() {
  dispatcher.emit('ctrlc');
});

module.exports = dispatcher;
