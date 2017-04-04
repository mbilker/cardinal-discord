"use strict";

const path = require('path');
const url = require('url');

const debug = require('debug')('cardinal:queued-media');
const https = require('follow-redirects').https;

const Types = require('./types');
const Utils = require('./utils');

const YOUTUBE_DL_STORAGE_DIRECTORY = process.env.YOUTUBE_DL_STORAGE_DIRECTORY || '/music';

let logger = null;

class QueuedMedia {
  constructor(musicPlayer, record) {
    this.musicPlayer = musicPlayer;
    this.type = record.type;
    this.ownerId = record.ownerId;
    this.guildId = record.guildId;

    this.id = record.id || '';
    this.title = record.title || '';
    this.url = record.url || '';
    this.encoding = record.encoding || '';
    this.duration = 0;
    this.stream = null;
    this.time = null;

    if (this.type === Types.YTDL) {
      // this.id = record.info.id;
      // this.duration = record.info.duration;
      // this.encoding = record.info.encoding;
      // this.url = record.info.url;

      /*
      // obsolete with new YTDL API
      this.formats = record.formats;
      this.formatIndex = 0;

      const format = this.formats[this.formatIndex];
      this.encoding = format.acodec;
      this.url = format.url;
      */
    } else if (this.type === Types.LOCAL) {
      // this.format = record.format;
      // this.encoding = record.encoding;
      // this.url = record.url;
    } else {
      throw new Error(`unknown type: ${this.type}`);
    }

    this.play = this.play.bind(this);
    this.stopPlaying = this.stopPlaying.bind(this);
    this.printString = this.printString.bind(this);
  }

  static initialize(container) {
    logger = container.get('logger');
  }

  hookEncoderEvents() {
    this.encoder.once('end', () => {
      logger.debug('encoder end', this.id || this.url, this.encoding);
      this.donePlaying();
    });
    this.encoder.once('unpipe', () => {
      logger.debug('encoder unpipe', this.id || this.url, this.encoding);
    });
    this.encoder.once('error', (err) => {
      logger.debug('encoder error', this.id || this.url, this.encoding, err);
    });
  }

  hookPlayEvents() {
    this.stream = this.encoder.play();

    this.stream.resetTimestamp();
    this.stream.removeAllListeners('timestamp');
    this.stream.on('timestamp', (time) => {
      // logger.debug('stream timestamp', this.id || this.url, this.encoding, time);
      this.time = time;
    });
    this.stream.once('end', () => {
      logger.debug('stream end', this.id || this.url, this.encoding);
    });
    this.stream.once('unpipe', () => {
      logger.debug('stream unpipe', this.id || this.url, this.encoding);
    });
  }

  play(voiceConnection) {
    if (this.type === Types.YTDL) {
      return this.playHTTPS(voiceConnection);
    } else if (this.type === Types.LOCAL) {
      return this.playLocal(voiceConnection);
    }
  }

  playHTTPS(voiceConnection, retry) {
/*
    if (this.encoding === 'opus') {
      this.playOpusHTTPS(voiceConnection);
    } else {
*/
      logger.debug(`playHTTPS: ${this.id} ${this.encoding}`);
      //logger.debug('audio is not opus, using ffmpeg');

      this.encoder = voiceConnection.createExternalEncoder({
        type: 'ffmpeg',
        source: this.url,
        format: 'opus',
        outputArgs: ['-ab', '64000'],
        debug: true,
      });

      this.hookEncoderEvents();
      this.hookPlayEvents();
/*
    }
*/
  }

  playLocal(voiceConnection) {
    logger.debug(`playLocal: ${this.url} ${this.encoding}`);
/*
    if (this.encoding === 'opus') {
      this.encoder = voiceConnection.createExternalEncoder({
        type: 'WebmOpusPlayer',
        source: this.url,
      });
    } else {
*/
      this.encoder = voiceConnection.createExternalEncoder({
        type: 'ffmpeg',
        source: this.url,
        format: 'opus',
        debug: true,
      });
/*
    }
*/

    this.hookEncoderEvents();
    this.hookPlayEvents();
  }

  playOpusHTTPS(voiceConnection, retry) {
    logger.debug(`playOpusHTTPS: ${this.id} ${this.encoding}`);

    const parsed = url.parse(this.url);
    //parsed.rejectUnauthorized = false;

    const req = https.get(parsed);

    req.once('response', (res) => {
      logger.debug(`have response: ${res.statusCode}`);

      if (res.statusCode === 302 && this.type === Types.YTDL && (this.formatIndex + 1) !== this.formats.length) {
        logger.debug(`damn youtube 302`);

        this.formatIndex++;

        const format = this.formats[this.formatIndex];
        this.encoding = format.audioEncoding;
        this.url = format.url;

        this.play(voiceConnection);
        return;
      } else if (res.statusCode === 302 && !retry) {
        logger.debug(`redirect playing ${this.id}: status code ${res.statusCode}`);
        setTimeout(() => this.playOpusHTTPS(voiceConnection, true), 1000);
        return;
      } else if (res.statusCode !== 200) {
        logger.debug(`error playing ${this.id}: status code ${res.statusCode}`);
        this.donePlaying();
        return;
      }

      this.encoder = voiceConnection.createExternalEncoder({
        type: 'WebmOpusPlayer',
        source: res,
        debug: true,
      });

      this.hookEncoderEvents();
      this.hookPlayEvents();
      this.stream.once('unpipe', () => res.destroy());
    });

    req.on('error', (err) => {
      logger.debug('request error', this.id, err);
      this.donePlaying();
    });
  }

  stopPlaying() {
    logger.debug('stopPlaying', this.id || this.url, this.encoding);

    if (this.stream) {
      this.stream.unpipeAll();
      this.stream = null;
    }

    if (this.encoder) {
      this.encoder.stop();
      this.encoder.destroy();
      this.encoder = null;
    }
  }

  donePlaying() {
    logger.debug('donePlaying', this.id || this.url, this.encoding);
    this.stopPlaying();
    this.musicPlayer.queuedDonePlaying(this);
  }

  printString() {
    return Utils.formatInfo(this);
  }
};

module.exports = QueuedMedia;
