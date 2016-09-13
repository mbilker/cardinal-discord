const debug = require('debug')('cardinal:dispatcher');
const EventEmitter = require('events').EventEmitter;

const dispatcher = new EventEmitter();

debug('loaded');

// const _emit = dispatcher.emit;
// dispatcher.emit = function emit(ev) {
//   debug.apply(null, arguments);
//   return _emit.apply(dispatcher, arguments);
// };

//process.on('SIGINT', function() {
//  dispatcher.emit('ctrlc');
//});

module.exports = dispatcher;
