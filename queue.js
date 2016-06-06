"use strict";

const fs = require('fs');

const debug = require('debug')('cardinal:queue');
const ytdl = require('ytdl-core');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');

const Types = require('./queue/types');
const Utils = require('./queue/utils');
const QueuedMedia = require('./queue/queued-media');

const bot = require('./bot');
const client = bot.client;

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

        const formats = info.formats
          .filter(x => x.audioEncoding)
          .sort(Utils.sortFormats)
          .map(x => (
            {
              container: x.container,
              url: x.url,
              audioEncoding: x.audioEncoding,
              audioBitrate: x.audioBitrate,
            }
          ));

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
      this.handleQueued(m.guild, m.author, m.channel).then((ok) => {
        if (ok) m.channel.sendMessage(`Added ${queued.printString()}`);
      });
    }).catch((err) => {
      if (err) {
        debug('error pulling youtube data', err.stack);
      }

      fs.access(url, fs.R_OK, (err2) => {
        debug('file access', err2);

        if (!err2) {
          const queued = new QueuedMedia(this, Types.LOCAL, m.author.id, {
            format: 'ffmpeg',
            encoding: 'ffmpeg',
            url,
          });
          this.queue.add(queued);
          this.handleQueued(m.guild, m.author, m.channel).then((ok) => {
            if (ok) m.channel.sendMessage(`Added ${queued.printString()}`);
          });
        }
      });
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

    this.currentlyPlaying.stopPlaying();
    this.currentlyPlaying = null;
    this.handleQueued();
  }

  handleQueued(guild, author, channel) {
    debug('handleQueued');

    const authorVoiceChannel = (guild && author) ? author.getVoiceChannel(guild) : null;

    if (this.currentlyPlaying === null && this.queue.size > 0) {
      const next = Array.from(this.queue)[0];
      this.currentlyPlaying = next;
      this.queue.delete(next);

      if (!authorVoiceChannel && channel) {
        channel.sendMessage(`${author.mention} Can you please join a voice channel I can play to?`);

        this.queuedDonePlaying(this.currentlyPlaying);

        return Promise.resolve(false);
      } else if (this.voiceConnection && !this.voiceConnection.disposed && this.voiceConnection.canStream) {
        this.currentlyPlaying.play(this.voiceConnection);
      } else {
        return authorVoiceChannel.join(false, false).then((info) => {
          debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`);

          this.voiceConnection = info.voiceConnection;

          this.currentlyPlaying.play(this.voiceConnection);

          return true;
        }).catch((err) => {
          debug('failed to join voice chat', err);
          console.log(err, err.stack);

          if (err.message === 'Missing permission' && authorVoiceChannel) {
            channel.sendMessage(`${author.mention} I do not have permission to join the '${authorVoiceChannel.name}' voice channel`);
          }

          this.queuedDonePlaying(this.currentlyPlaying);

          return false;
        });
      }
    } else if (this.queue.size === 0 && this.voiceConnection && !this.voiceConnection.disposed) {
      debug('handleQueued disconnect');

      this.voiceConnection.disconnect();
      this.voiceConnection = null;
    }

    return Promise.resolve(true);
  }

  queuedDonePlaying(queued) {
    if (queued === this.currentlyPlaying) {
      this.currentlyPlaying = null;
      this.handleQueued();
    }
  }
}

module.exports = new MusicPlayer();
