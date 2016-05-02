"use strict";

const https = require('https');
const url = require('url');

const debug = require('debug')('cardinal:queued-media');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');

const Types = require('./queue/types');
const Utils = require('./queue/utils');

class QueuedMedia {
  constructor(musicPlayer, type, id, info, formats) {
    this.musicPlayer = musicPlayer;
    this.type = type;
    this.ownerId = id;

    this.title = info.title || '';
    this.url = '';
    this.id = '';
    this.stream = null;
    this.time = null;

    if (this.type === Types.YTDL) {
      this.lengthSeconds = info.length_seconds;
      this.id = info.video_id;

      const format = formats[0];
      this.encoding = format.audioEncoding;
      this.url = format.url;
    } else if (this.type === Types.LOCAL) {
      this.format = info.format;
      this.encoding = info.encoding;
      this.url = info.filePath;
    } else {
      throw new Error(`unknown type: ${this.type}`);
    }

    this.play = this.play.bind(this);
    this.stopPlaying = this.stopPlaying.bind(this);
    this.printString = this.printString.bind(this);
  }

  hookEncoderEvents() {
    this.encoder.once('end', () => {
      debug('stream end', this.id || this.url, this.encoding);
      this.donePlaying();
    });
    this.encoder.once('unpipe', () => {
      debug('strem unpipe', this.id || this.url, this.encoding);
    });
  }

  hookPlayEvents() {
    this.stream = this.encoder.play();

    this.stream.resetTimestamp();
    this.stream.removeAllListeners('timestamp');
    this.stream.on('timestamp', (time) => {
      this.time = time;
    });
  }

  play(voiceConnection) {
    if (this.type === Types.YTDL) {
      return this.playHTTPS(voiceConnection);
    } else if (this.type === Types.LOCAL) {
      return this.playLocal(voiceConnection);
    }
  }

  playLocal(voiceConnection) {
    debug(`playLocal: ${this.url} ${this.encoding}`);

    const readStream = require('fs').createReadStream(this.url);

    if (this.encoding === 'opus') {
      this.encoder = voiceConnection.createExternalEncoder({
        type: 'WebmOpusPlayer',
        source: readStream,
      });
    } else {
      this.encoder = voiceConnection.createExternalEncoder({
        type: 'ffmpeg',
        source: '-',
        format: 'opus',
      });
    }

    readStream.pipe(this.encoder.stdin);

    this.hookEncoderEvents();
    this.encoder.once('unpipe', () => readStream.destroy());
    this.hookPlayEvents();
  }

  playOpusHTTPS(voiceConnection, retry) {
    debug(`playOpusHTTPS: ${this.id} ${this.encoding}`);

    const parsed = url.parse(this.url);
    parsed.rejectUnauthorized = false;

    const req = https.get(parsed);

    req.on('response', (res) => {
      debug(`have response: ${res.statusCode}`);

      if (res.statusCode === 302 && this.type === Types.YTDL && retry) {
        debug(`damn youtube 302`);
        this.musicPlayer.fetchYoutubeInfo(`http://www.youtube.com/watch?v=${this.video_id}`).then((arr) => {
          this.lengthSeconds = arr[0].length_seconds;
          this.id = arr[0].video_id;

          const format = arr[1][0];
          this.encoding = format.audioEncoding;
          this.url = format.url;

          this.playOpusHTTPS(voiceConnection);
        });
      } else if (res.statusCode === 302) {
        debug(`redirect playing ${this.id}: status code ${res.statusCode}`);
        setTimeout(() => this.playOpusHTTPS(voiceConnection, true), 1000);
        return;
      } else if (res.statusCode !== 200) {
        debug(`error playing ${this.id}: status code ${res.statusCode}`);
        this.donePlaying();
        return;
      }

      this.encoder = voiceConnection.createExternalEncoder({
        type: 'WebmOpusPlayer',
        source: res,
      });

      this.hookEncoderEvents();
      this.hookPlayEvents();
    });

    req.on('error', (err) => {
      debug('request error', this.id, err);
      this.donePlaying();
    });
  }

  playHTTPS(voiceConnection, retry) {
    if (this.encoding === 'opus') {
      this.playOpusHTTPS(voiceConnection);
    } else {
      debug(`playHTTPS: ${this.id} ${this.encoding}`);
      debug('audio is not opus, using ffmpeg');

      this.encoder = voiceConnection.createExternalEncoder({
        type: 'ffmpeg',
        source: this.url,
        format: 'opus',
      });

      this.hookEncoderEvents();
      this.hookPlayEvents();
    }
  }

  stopPlaying() {
    if (this.stream) {
      this.stream.unpipeAll();
    }
  }

  donePlaying() {
    Dispatcher.emit(Actions.QUEUE_DONE_ITEM, this);
  }

  printString() {
    const time = this.time ? (Utils.formatTime(this.time | 0) + '/') : '';

    if (this.type === Types.YTDL) {
      const length = Utils.formatTime(this.lengthSeconds);

      return `(${time}${length}) \`[${this.encoding}]\` **${this.title}** (${this.id}) (<@${this.ownerId}>)`;
    }
    return `NON-YTDL \`[${this.encoding}]\` **${this.title}** - ${this.url}`;
  }
};

module.exports = QueuedMedia;
