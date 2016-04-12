"use strict";

const https = require('https');
const url = require('url');

const debug = require('debug')('cardinal-queue');
const keyMirror = require('keymirror');
const WebMByteStream = require('webm-byte-stream');
const ytdl = require('ytdl-core');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');

const bot = require('./bot');
const client = bot.client;
const getVoiceChannel = bot.getVoiceChannel;

const Types = keyMirror({
  LOCAL: null,
  YTDL: null,
});

const sortFormats = (a, b) => {
  // anything towards the beginning of the array is -1, 1 to move it to the end
  if (a.audioEncoding === 'opus' && b.audioEncoding !== 'opus') {
    return -1;
  } else if (a.audioEncoding !== 'opus' && b.audioEncoding === 'opus') {
    return 1;
  }

  if (a.audioEncoding === 'vorbis' && b.audioEncoding !== 'vorbis') {
    return -1;
  } else if (a.audioEncoding !== 'vorbis' && b.audioEncoding === 'vorbis') {
    return 1;
  }

  if (a.audioBitrate < b.audioBitrate) {
    return 1;
  } else if (a.audioBitrate > b.audioBitrate) {
    return -1;
  }

  return 0;
};

function formatTime(seconds) {
  function zeroPad(n) {
    return n < 10 ? '0' + n : n;
  };
  return Math.floor(seconds / 60) + ':' + zeroPad(seconds % 60);
};


class QueuedMedia {
  constructor(type, id, info, formats) {
    this.type = type;
    this.ownerId = id;
    this.info = info;
    this.formats = formats;
    this.title = '';
    this.url = '';

    this.title = info.title;

    if (this.type === Types.YTDL) {
      this.lengthSeconds = info.length_seconds;
      this.format = this.formats[0];
      this.encoding = this.format.audioEncoding;
      this.url = this.format.url;
    } else {
      this.format = info.format;
      this.encoding = info.encoding;
      this.url = info.filePath;
    }

    this.play = this.play.bind(this);
    this.printString = this.printString.bind(this);
    debug('format', this.format);
  }

  play(voiceConnection) {
    if (this.type === Types.YTDL && false) {
      return this.playYTDL(voiceConnection);
    }
  }

  playLocal(voiceConnection) {
    debug(`playLocal: ${this.url} ${this.encoding}`);

    const readStream = require('fs').createReadStream(this.url);

    if (this.format.audioEncoding === 'opus') {
      const encoder = voiceConnection.createExternalEncoder({
        type: 'WebmOpusPlayer',
        source: readStream
      });

      encoder.once('end', () => debug('stream end', this.url, this.encoding));
      encoder.once('unpipe', () => readStream.destroy());

      const stream = encoder.play();
    }
  }

  playYTDL(voiceConnection) {
    debug(`playYTDL: ${this.format.url} ${this.format.audioEncoding}`);

    const parsed = url.parse(this.format.url);
    const req = https.get(parsed);
    const frameDuration = 60;

    if (this.format.audioEncoding === 'opus') {
      const encoder = voiceConnection.getEncoder({ proxy: true });
      const webmStream = new WebMByteStream({ durations: true });

      req.on('response', (res) => {
        debug(`have response: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          debug(`error playing ${this.format.url}: status code ${res.statusCode}`);
          return;
        }

        webm.on('Media Segment', (data) => {
        });

        const frameTime = 48000 * frameDuration;
        function sendPacket() {
          const chunk = res.read(readSize);

          if (!chunk) {
            debug('no chunk');
            return setTimeout(sendPacket, frameDuration);
          }

          const sampleCount = getSampleCountInPacket(chunk);
          debug(`sending samples: ${sampleCount}`);
          encoder.enqueue(chunk, sampleCount);
          setTimeout(sendPacket, frameDuration);
        };
        sendPacket();
      });
    }
  }

  printString() {
    if (this.type === Types.YTDL) {
      return `(${formatTime(this.lengthSeconds)}) \`[${this.encoding}]\` **${this.title}** (${this.info.video_id}) (<${this.ownerId}>)`;
    }
    return `NON-YTDL \`[${this.encoding}]\` **${this.title}** - ${this.url}`;
  }
}

class MusicPlayer {
  constructor() {
    this.queue = new Set();
    this.currentlyPlaying = null;

    this.QueuedMedia = QueuedMedia;

    Dispatcher.on(Actions.DISPLAY_NOW_PLAYING, this.onNowPlaying.bind(this));
    Dispatcher.on(Actions.QUEUE_ITEM, this.queueItem.bind(this));
  }

  onNowPlaying(m) {
    debug('DISPLAY_NOW_PLAYING');
    if (this.currentlyPlaying === null) {
      m.channel.sendMessage('No queued song');
      return;
    }
    m.channel.sendMessage(this.currentlyPlaying.printString());
  }

  queueItem(m, url) {
    debug('QUEUE_ITEM');
    ytdl.getInfo(url, { filter: 'audioonly' }, (err, info) => {
      const formats = info.formats
        .filter(x => x.audioEncoding)
        .sort(sortFormats);

      const queued = new QueuedMedia(Types.YTDL, m.author.id, info, formats);
      this.queue.add(queued);
      this.handleQueued();
    });
  }

  handleQueued() {
    debug('handleQueued');
    if (this.currentlyPlaying === null && this.queue.size > 0) {
      const next = Array.from(this.queue)[0];
      this.currentlyPlaying = next;
      this.queue.delete(next);

      const voiceChannel = getVoiceChannel();
      voiceChannel.join(false, false).then((info, err) => {
        debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`, err);

        if (err) {
          Dispatcher.emit('error', err);
          return;
        }

        this.currentlyPlaying.play(info.voiceConnection);
      });
    }
  }

  queuedDonePlaying(queued) {
    if (queued === this.currentlyPlaying) {
      this.currentlyPlaying = null;
      this.handleQueued();
    }
  }
}

module.exports = new MusicPlayer();
