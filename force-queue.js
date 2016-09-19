#!/usr/bin/node

const fs = require('fs');

const MusicPlayer = require('./modules/queue');
const Logger = require('./Core/Logger');
const RedisBrain = require('./Core/Brain/Redis');
const Types = require('./queue/types');

const oath = require('./hubot_oath.json');

const container = new Map();
container.set('commandManager', { add: function() {} });
container.set('logger', new Logger());
container.set('redisBrain', new RedisBrain());
const musicPlayer = new MusicPlayer(container);

const files = process.argv.slice(2);

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

  return new Promise((resolve, reject) => {
    musicPlayer.queueSave(oath.mainGuildId, record, resolve);
  });
}));

promise.then(() => {
  console.log('all done');

  container.get('redisBrain').quit();
}).catch((err) => {
  console.log(err);
});;
