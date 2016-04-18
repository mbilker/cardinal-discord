"use strict";

const https = require('https');
const url = require('url');

const debug = require('debug')('cardinal-queue');
const keyMirror = require('keymirror');
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
    this.id = '';

    this.stream = null;

    this.title = info.title;

    if (this.type === Types.YTDL) {
      this.lengthSeconds = info.length_seconds;
      this.id = info.video_id;
      this.format = this.formats[0];
      this.encoding = this.format.audioEncoding;
      this.url = this.format.url;
    } else if (this.type === Types.LOCAL) {
      this.format = info.format;
      this.encoding = info.encoding;
      this.url = info.filePath;
    } else {
      throw new Error(`unknown type: ${this.type}`);
    }

    this.play = this.play.bind(this);
    this.printString = this.printString.bind(this);
  }

  play(voiceConnection) {
    if (this.type === Types.YTDL) {
      return this.playHTTPS(voiceConnection);
    }
  }

  playLocal(voiceConnection) {
    debug(`playLocal: ${this.url} ${this.encoding}`);

    const readStream = require('fs').createReadStream(this.url);

    if (this.format.audioEncoding === 'opus') {
      const encoder = voiceConnection.createExternalEncoder({
        type: 'WebmOpusPlayer',
        source: readStream,
      });

      encoder.once('end', () => debug('stream end', this.url, this.encoding));
      encoder.once('unpipe', () => readStream.destroy());

      this.stream = encoder.play();
    }
  }

  playHTTPS(voiceConnection) {
    debug(`playHTTPS: ${this.id} ${this.encoding}`);

    const parsed = url.parse(this.format.url);
    parsed.rejectUnauthorized = false;

    const req = https.get(parsed);

    req.on('response', (res) => {
      debug(`have response: ${res.statusCode}`);

      if (res.statusCode !== 200) {
        debug(`error playing ${this.id}: status code ${res.statusCode}`);
        this.donePlaying();
        return;
      }

      if (this.encoding === 'opus') {
        this.encoder = voiceConnection.createExternalEncoder({
          type: 'WebmOpusPlayer',
          source: res,
        });
      } else {
        debug('audio is not opus, using ffmpeg');

        this.encoder = voiceConnection.createExternalEncoder({
          type: 'ffmpeg',
          source: '-',
          format: 'opus',
        });

        res.pipe(this.encoder.stdin);
      }

      this.encoder.once('end', () => {
        debug('stream end', this.id, this.encoding);
        this.donePlaying();
      });
      this.encoder.once('unpipe', () => debug('strem unpipe', this.id, this.encoding));

      this.stream = this.encoder.play();
    });

    req.on('error', (err) => {
      debug('request error', this.id, err);
      this.donePlaying();
    });
  }

  stopPlaying() {
    if (this.stream) {
      this.stream.end();
    }
  }

  donePlaying() {
    Dispatcher.emit(Actions.QUEUE_DONE_ITEM, this);
  }

  printString() {
    if (this.type === Types.YTDL) {
      return `(${formatTime(this.lengthSeconds)}) \`[${this.encoding}]\` **${this.title}** (${this.id}) (<${this.ownerId}>)`;
    }
    return `NON-YTDL \`[${this.encoding}]\` **${this.title}** - ${this.url}`;
  }
}

class MusicPlayer {
  constructor() {
    this.queue = new Set();
    this.currentlyPlaying = null;
    this.voiceChannel = null;

    this.QueuedMedia = QueuedMedia;

    Dispatcher.on(Actions.QUEUE_DISPLAY_NOW_PLAYING, this.onNowPlaying.bind(this));
    Dispatcher.on(Actions.QUEUE_DISPLAY_PLAYLIST, this.onDisplayPlaylist.bind(this));
    Dispatcher.on(Actions.QUEUE_ITEM, this.queueItem.bind(this));
    Dispatcher.on(Actions.QUEUE_DONE_ITEM, this.queuedDonePlaying.bind(this));
  }

  onNowPlaying(m) {
    debug('QUEUE_DISPLAY_NOW_PLAYING');
    if (this.currentlyPlaying === null) {
      m.channel.sendMessage('No queued song');
      return;
    }
    m.channel.sendMessage(this.currentlyPlaying.printString());
  }

  onDisplayPlaylist(m) {
    debug('QUEUE_DISPLAY_PLAYLIST');
    let msg = '';

    msg += 'Playlist:\n';
    for (const item of this.queue) {
      msg += `${item.printString()}\n`;
    }

    if (!this.queue.size) {
      msg += '- Nothing!\n';
    }

    if (this.currentlyPlaying) {
      msg += '\n';
      msg += 'Currently Playing:\n';
      msg += this.currentlyPlaying.printString();
    }

    m.channel.sendMessage(msg);
  }

  queueItem(m, url) {
    debug('QUEUE_ITEM');
    ytdl.getInfo(url, { filter: 'audioonly' }, (err, info) => {
      if (err) {
        debug('error pulling youtube data', err.stack);
        return;
      }

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

      this.voiceChannel = getVoiceChannel();
      this.voiceChannel.join(false, false).then((info, err) => {
        debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`, err || 'no error');

        if (err) {
          Dispatcher.emit('error', err);
          return;
        }

        this.currentlyPlaying.play(info.voiceConnection);
      });
    } else if (this.currentlyPlaying && this.queue.size === 0 && this.voiceChannel) {
      const info = this.voiceChannel.getVoiceConnectionInfo();
      if (info && info.voiceConnection && !info.voiceConnection.disposed) {
        info.voiceConnection.disconnect();
        this.voiceChannel = null;
      }
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
