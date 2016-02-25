const stream = require('stream');
const util = require('util');

const debug = require('debug')('discord-icy');
const icy = require('icy');
const lame = require('lame');
//const Speaker = require('speaker');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const Discord = require('./bot');

const URL = 'http://172.16.21.4:8000';

var textChannel = 0;

Dispatcher.on(Actions.DISCORD_FOUND_TEXT_CHANNEL, (newTextChannel) => {
  textChannel = newTextChannel;
});

Dispatcher.on(Actions.DISCORD_JOINED_VOICE_CHANNEL, () => {
  icy.get(URL, (res) => {
    debug('received icy response', res.headers);

    res.on('metadata', (meta) => {
      const parsed = icy.parse(meta);
      debug('parsed metadata', parsed);

      if (parsed && parsed.StreamTitle) {
        Discord.bot.sendMessage(textChannel, parsed.StreamTitle).then(() => console.log(`reported song status to ${Settings.TEXT_CHANNEL}`));
        Discord.bot.setPlayingGame(parsed.StreamTitle).then(() => console.log(`set status to song`));
      }

      Dispatcher.emit(Actions.ICY_METADATA, meta);
    });

    //bot.voiceConnection.playRawStream(res.pipe(new lame.Decoder()));
    //bot.voiceConnection.playRawStream(res, { volume: 0.25 });

    setImmediate(() => Dispatcher.emit(Actions.ICY_CONNECTED, res));
  });
});

Dispatcher.on(Actions.ICY_CONNECTED, (res) => {
  const stream = new ReduceVolumeStream();
  const output = res.pipe(new lame.Decoder()).pipe(stream);
  //const output = res;

  output.once('readable', () => {
    Discord.bot.voiceConnection.instream = res;
    Discord.bot.voiceConnection.playStream(output, 2);

    //output.pipe(new Speaker({
    //  channels: 2,
    //  sampleRate: 48000,
    //  bitDepth: 16
    //}));
  });

  output.on('error', (err) => {
    console.error(err);
    Discord.bot.voiceConnection.stopPlaying();
  });
});

function ReduceVolumeStream() {
  stream.Transform.call(this);

  this.volume = 0.3;
  this.multiplier = Math.tan(this.volume);
};
util.inherits(ReduceVolumeStream, stream.Transform);

ReduceVolumeStream.prototype._transform = function _transform(chunk, encoding, cb) {
  "use strict";

  const out = new Buffer(chunk.length);

  for (var i = 0; i < chunk.length; i += 2) {
    var uint = Math.floor(this.multiplier * chunk.readInt16LE(i));

    uint = Math.min(32767, uint);
    uint = Math.max(-32767, uint);

    out.writeInt16LE(uint, i);
  }

  this.push(out);

  cb();
};
