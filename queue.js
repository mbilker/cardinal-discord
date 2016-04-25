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
  constructor(musicPlayer, type, id, info, formats) {
    this.musicPlayer = musicPlayer;
    this.type = type;
    this.ownerId = id;
    this.title = '';
    this.url = '';
    this.id = '';

    this.stream = null;

    this.title = info.title;

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
    this.printString = this.printString.bind(this);
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

    this.encoder.once('end', () => {
      debug('stream end', this.url, this.encoding);
      this.donePlaying();
    });
    this.encoder.once('unpipe', () => readStream.destroy());

    this.stream = this.encoder.play();
  }

  playHTTPS(voiceConnection, retry) {
    debug(`playHTTPS: ${this.id} ${this.encoding}`);

    const parsed = url.parse(this.url);
    parsed.rejectUnauthorized = false;

    const req = https.get(parsed);

    req.on('response', (res) => {
      debug(`have response: ${res.statusCode}`);

      if (res.statusCode === 302 && this.type === YTDL && retry) {
        debug(`damn youtube 302`);
        this.musicPlayer.fetchYoutubeInfo(`http://www.youtube.com/watch?v=${this.video_id}`).then((info, formats) => {
          this.lengthSeconds = info.length_seconds;
          this.id = info.video_id;

          const format = formats[0];
          this.encoding = format.audioEncoding;
          this.url = format.url;

          this.playHTTPS(voiceConnection);
        });
      } else if (res.statusCode === 302) {
        debug(`redirect playing ${this.id}: status code ${res.statusCode}`);
        setTimeout(() => this.playHTTPS(voiceConnection, true), 1000);
        return;
      } else if (res.statusCode !== 200) {
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
      return `(${formatTime(this.lengthSeconds)}) \`[${this.encoding}]\` **${this.title}** (${this.id}) (<@${this.ownerId}>)`;
    }
    return `NON-YTDL \`[${this.encoding}]\` **${this.title}** - ${this.url}`;
  }
}

class MusicPlayer {
  constructor() {
    this.queue = new Set();
    this.currentlyPlaying = null;
    this.voiceConnection = null;

    this.QueuedMedia = QueuedMedia;

    Dispatcher.on(Actions.QUEUE_DISPLAY_NOW_PLAYING, this.onNowPlaying.bind(this));
    Dispatcher.on(Actions.QUEUE_DISPLAY_PLAYLIST, this.onDisplayPlaylist.bind(this));
    Dispatcher.on(Actions.QUEUE_ITEM, this.queueItem.bind(this));
    Dispatcher.on(Actions.QUEUE_SKIP, this.skipSong.bind(this));
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

  fetchYoutubeInfo(url) {
    return new Promise((resolve, reject) => {
      ytdl.getInfo(url, { filter: 'audioonly' }, (err, info) => {
        if (err) {
          reject(err);
          return;
        }

        const formats = info.formats.filter(x => x.audioEncoding).sort(sortFormats);
        resolve([info, formats]);
      });
    });
  }

  queueItem(m, url) {
    debug('QUEUE_ITEM', url);
    if (!url) {
      debug('no valid url');
      m.channel.sendMessage(`${m.author.mention} Please give me a URL to play`);
      return;
    }

    this.fetchYoutubeInfo(url).then((arr) => {
      debug('fetchYoutubeInfo promise resolve');

      const queued = new QueuedMedia(this, Types.YTDL, m.author.id, ...arr);
      this.queue.add(queued);
      this.handleQueued();
    }).catch((err) => {
      if (err) {
        debug('error pulling youtube data', err.stack);
      }
    });
  }

  skipSong(m) {
    if (!this.currentlyPlaying) {
      m.channel.sendMessage('No currently playing song');
      return;
    } else if (!this.currentlyPlaying.stream) {
      m.channel.sendMessage('For some reason this song does not have a stream associated with it');
      return;
    }

    this.currentlyPlaying.stream.unpipeAll();
    this.currentlyPlaying = null;
    this.handleQueued();
  }

  handleQueued() {
    debug('handleQueued');

    if (this.currentlyPlaying === null && this.queue.size > 0) {
      const next = Array.from(this.queue)[0];
      this.currentlyPlaying = next;
      this.queue.delete(next);

      if (this.voiceConnection && !this.voiceConnection.disposed && this.voiceConnection.canStream) {
        this.currentlyPlaying.play(this.voiceConnection);
      } else {
        getVoiceChannel().join(false, false).then((info, err) => {
          debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`, err || 'no error');

          this.voiceConnection = info.voiceConnection;

          if (err) {
            Dispatcher.emit('error', err);
            return;
          }

          this.currentlyPlaying.play(this.voiceConnection);
        });
      }
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
