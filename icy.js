"use strict";

const stream = require('stream');
const util = require('util');

const debug = require('debug')('hubot-icy');
const icy = require('icy');
const lame = require('lame');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const bot = require('./bot');
const client = bot.client;
const getVoiceChannel = bot.getVoiceChannel;

const URL = 'http://127.0.0.1:8000';

class IcyManager {
  constructor() {
    this.textChannel = null;
    this.voiceChannel = null;
    this.voiceConnection = null;
    this.icyStream = null;
    this.isPlaying = false;
    this.lastStreamTitle = '';

    this.decoder = null;
    this.encoder = null;
    this.volumeTransformer = null;

    Dispatcher.on(Actions.DISCORD_FOUND_TEXT_CHANNEL, this.onFoundTextChannel.bind(this));
    Dispatcher.on(Actions.SET_AUDIO_VOLUME, this.onSetVolume.bind(this));
    Dispatcher.on(Actions.START_MUSIC_PLAYBACK, this.startPlayback.bind(this));
    Dispatcher.on(Actions.STOP_MUSIC_PLAYBACK, this.stopPlayback.bind(this));
  }

  onFoundTextChannel(newTextChannel) {
    debug('DISCORD_FOUND_TEXT_CHANNEL', newTextChannel.id);
    this.textChannel = newTextChannel;
  }

  onSetVolume(newVolume) {
    if (!this.volumeTransformer) {
      debug(`SET_AUDIO_VOLUME: no stream available`);
      return;
    }

    debug(`SET_AUDIO_VOLUME: setting stream volume to ${newVolume}`);

    let volume = newVolume;
    volume = Math.max(volume, 0);
    volume = Math.min(volume, 100);
    this.volumeTransformer.setVolume(volume / 100);
  }

  startPlayback(e) {
    debug('START_MUSIC_PLAYBACK');

    if (this.isPlaying) {
      e.message.channel.sendMessage('Already playing music');
      return;
    }

    const voiceChannel = getVoiceChannel();
    if (!voiceChannel) {
      e.message.channel.sendMessage('Unable to find appropriate voice channel');
      return;
    }

    this.voiceChannel = voiceChannel;
    this.voiceChannel.join(false, false).then((info, err) => {
      debug(`joined voice chat: ${info.voiceServerURL}@${info.mode}`, err);

      if (err) {
        Dispatcher.emit('error', err);
        return;
      }

      this.voiceConnection = info.voiceConnection;
      Dispatcher.emit(Actions.DISCORD_JOINED_VOICE_CHANNEL, info);

      icy.get(URL, (res) => {
        debug('received icy response', res.headers);

        this.icyStream = res;
        this.onIcyConnected(e);

        Dispatcher.emit(Actions.ICY_CONNECTED, res);
      });
    });

    e.message.channel.sendMessage('Starting playback');
  }

  stopPlayback(e) {
    debug('STOP_MUSIC_PLAYBACK');

    if (!this.isPlaying) {
      e.message.channel.sendMessage('Already stopped playback');
    }

    this.isPlaying = false;

    if (this.voiceConnection) {
      this.voiceConnection.disconnect();
      this.voiceConnection = null;
    }

    if (this.icyStream) {
      this.icyStream.end();
      this.icyStream = null;
    }

    e.message.channel.sendMessage('Stopped playback');
  }

  updateGameStatus(name) {
    debug(`updating game playing text: ${name}`);
    this.textChannel.sendMessage(name).then(() => debug(`reported song status to ${Settings.TEXT_CHANNEL}`));
    client.User.setGame({ name });
  }

  onIcyConnected(e) {
    if (!client.VoiceConnections.length) {
      this.textChannel.sendMessage('No voice conenction for sending audio');

      if (e && e.message && e.message.channel) {
        e.message.channel.sendMessage('No voice connection for sending audio');
      }

      this.stopPlayback();
    }

    this.isPlaying = true;

    this.icyStream.on('metadata', (meta) => {
      const parsed = icy.parse(meta);
      debug('parsed metadata', parsed);

      if (parsed && parsed.StreamTitle !== this.lastStreamTitle) {
        this.lastStreamTitle = parsed.StreamTitle;

        setTimeout(() => this.updateGameStatus(parsed.StreamTitle), Math.max(1000, Settings.STATUS_DELAY_TIME) - 1000);
      }

      Dispatcher.emit(Actions.ICY_METADATA, meta);
    });

    this.playToVoiceChannel();
  }

  playToVoiceChannel() {
    this.decoder = new lame.Decoder();
    this.volumeTransformer = new ReduceVolumeStream();

    this.encoder = null;
    this.decoder.on('format', (format) => {
      debug('received format:', format);

      const frameDuration = 20;
      const bitDepth = format.bitDepth;
      const sampleRate = format.sampleRate;
      const channels = format.channels;

      const options = { frameDuration, sampleRate, channels, float: false, engine: 'native' };
      const readSize = sampleRate / 1000 * frameDuration * bitDepth / 8 * channels;

      this.volumeTransformer.once('readable', () => setTimeout(() => {
        debug('reading from stream');

        const encoder = this.voiceConnection.getEncoder(options);
        this.encoder = encoder;

        const output = this.volumeTransformer;
        const needBuffer = () => this.encoder.onNeedBuffer();
        this.encoder.onNeedBuffer = function onNeedBuffer() {
          const chunk = output.read(readSize);

          if (!chunk) {
            debug('out of buffer');
            setTimeout(needBuffer, frameDuration);
            return;
          }

          const sampleCount = readSize / channels / (bitDepth / 8);
          encoder.enqueue(chunk, sampleCount);
        };
        needBuffer();
      }, Settings.STATUS_DELAY_TIME));
    });

    this.icyStream.pipe(this.decoder).pipe(this.volumeTransformer);
  }
}

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

module.exports = new IcyManager();
