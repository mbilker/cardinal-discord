"use strict";

const stream = require('stream');
const util = require('util');

const debug = require('debug')('hubot-icy');
const icy = require('icy');
const lame = require('lame');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const client = require('./bot').client;

const URL = 'http://127.0.0.1:8000';

var textChannel = null;
var voiceConnection = null;
var lastStreamTitle = null;

Dispatcher.on(Actions.DISCORD_FOUND_TEXT_CHANNEL, (newTextChannel) => {
  textChannel = newTextChannel;
});

Dispatcher.on(Actions.DISCORD_JOINED_VOICE_CHANNEL, (newVoiceConnectionInfo) => {
  voiceConnection = newVoiceConnectionInfo.voiceConnection;

  icy.get(URL, (res) => {
    debug('received icy response', res.headers);

    res.on('metadata', (meta) => {
      const parsed = icy.parse(meta);
      debug('parsed metadata', parsed);

      if (parsed && parsed.StreamTitle !== lastStreamTitle) {
        lastStreamTitle = parsed.StreamTitle;

        setTimeout(() => {
          //textChannel.sendMessage(parsed.StreamTitle).then(() => console.log(`reported song status to ${Settings.TEXT_CHANNEL}`));
          client.User.setGame({ name: parsed.StreamTitle });
          console.log('set status to song');
        }, Math.max(1000, Settings.STATUS_DELAY_TIME) - 1000);
      }

      Dispatcher.emit(Actions.ICY_METADATA, meta);
    });

    Dispatcher.emit(Actions.ICY_CONNECTED, res);
  });
});

function discordPlayStream(output) {
  return new Promise((resolve, reject) => {
    var intent = Discord.bot.voiceConnection.playStream(output, 2);

    //intent.on('time', (time) => debug('intent time', time));

    intent.on('end', () => {
      debug('stream end reported');

      //Dispatcher.emit(Actions.DISCORD_JOINED_VOICE_CHANNEL);
      resolve(true);
    });
  });
}

Dispatcher.on(Actions.ICY_CONNECTED, (res) => {
  const decode = res.pipe(new lame.Decoder());
  const output = decode.pipe(new ReduceVolumeStream());

  function volumeListener(volume) {
    debug('setting stream volume to ' + volume);
    output.setVolume(volume / 100);
  };
  Dispatcher.on(Actions.SET_AUDIO_VOLUME, volumeListener);

  decode.on('format', (format) => {
    const frameDuration = 20;
    const bitDepth = format.bitDepth;
    const sampleRate = format.sampleRate;
    const channels = format.channels;

    const options = { frameDuration, sampleRate, channels, float: false, engine: 'native' };
    const readSize = sampleRate / 1000 * frameDuration * bitDepth / 8 * channels;

    output.once('readable', () => {
      const encoder = voiceConnection.getEncoder(options)
      const needBuffer = () => encoder.onNeedBuffer();
      encoder.onNeedBuffer = function() {
        const chunk = output.read(readSize);

        if (!chunk) {
          setTimeout(needBuffer, frameDuration);
          return;
        }

        const sampleCount = readSize / channels / (bitDepth / 8);
        encoder.enqueue(chunk, sampleCount);
      };
      needBuffer();
    });
  });

  output.on('error', (err) => {
    console.error(err);
    //Discord.bot.voiceConnection.stopPlaying();
  });
});

function ReduceVolumeStream() {
  stream.Transform.call(this);

  this.setVolume(Settings.STREAM_VOLUME);
};
util.inherits(ReduceVolumeStream, stream.Transform);

ReduceVolumeStream.prototype.setVolume = function setVolume(volume) {
  this.volume = volume;
};

ReduceVolumeStream.prototype._transform = function _transform(chunk, encoding, cb) {
  const out = new Buffer(chunk.length);

  for (var i = 0; i < chunk.length; i += 2) {
    var uint = Math.floor(this.volume * chunk.readInt16LE(i));

    uint = Math.min(32767, uint);
    uint = Math.max(-32767, uint);

    out.writeInt16LE(uint, i);
  }

  this.push(out);

  cb();
};
