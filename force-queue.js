#!/usr/bin/node

const fs = require('fs');
const path = require('path');

const MusicPlayer = require('./modules/queue');
const Logger = require('./Core/Logger');
const RedisBrain = require('./Core/Brain/Redis');
const Types = require('./queue/types');

const oath = require('./hubot_oath.json');

const redisBrain = new RedisBrain();

const container = new Map();
container.set('commandManager', { add: function() {} });
container.set('logger', new Logger());
container.set('redisBrain', redisBrain);
const musicPlayer = new MusicPlayer(container);

const files = process.argv.slice(2).map(url => path.resolve(url));

//const flac = files.filter(file => file.endsWith('.flac'));
//console.log(flac);

//const promise = Promise.all(flac.map(url => {
const promise = Promise.all(files.map(url => {
  const info = {
    title: 'ffmpeg',
    format: 'ffmpeg',
    encoding: 'ffmpeg',
    url,
  };

  const record = {
    type: Types.LOCAL,
    ownerId: oath.mbilkerId,
    guildId: oath.mainGuildId,
    info,
  };

  return musicPlayer.queueSave(oath.mainGuildId, record);
}));

console.log(promise);

promise.then(() => {
  console.log('all done');

  redisBrain.quit();

  // Search starts up shortly after this callback, schedule shutdown
  // so there is no "write after end" error
  setTimeout(() => musicPlayer.shutdown(), 500);
}).catch((err) => {
  console.log(err);
});
