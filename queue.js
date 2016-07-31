"use strict";

const fs = require('fs');

const debug = require('debug')('cardinal:queue');
const redis = require('redis');

const Command = require('./Core/Command');
const Module = require('./Core/Module');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');

const Types = require('./queue/types');
const Utils = require('./queue/utils');
const QueuedMedia = require('./queue/queued-media');

const client = require('./bot').client;

const redisClient = redis.createClient();

class MusicPlayer extends Module {
  constructor() {
    super();

    this.currentlyPlaying = null;
    this.voiceConnection = null;

    this.QueuedMedia = QueuedMedia;

    this.registerCommands([
      new Command(this, 'np', this.onNowPlaying),
      new Command(this, 'li', this.onDisplayPlaylist),
    ]);

    //Dispatcher.on(Actions.QUEUE_DISPLAY_NOW_PLAYING, this.onNowPlaying.bind(this));
    //Dispatcher.on(Actions.QUEUE_DISPLAY_PLAYLIST, this.onDisplayPlaylist.bind(this));
    Dispatcher.on(Actions.QUEUE_ITEM, this.queueItem.bind(this));
    Dispatcher.on(Actions.QUEUE_SKIP, this.skipSong.bind(this));
    Dispatcher.on(Actions.QUEUE_DONE_ITEM, this.queuedDonePlaying.bind(this));
  }

  getRedisKey(guildId) {
    return `cardinal.${guildId}:music_queue`;
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
    const key = this.getRedisKey(m.guild.id);
    let msg = '';

    redisClient.llen(key, (err, len) => {
      if (err) {
        debug('error reading list length from redis', err, err.stack);
        m.channel.sendMessage('Error reading queue list from Redis');
        return;
      }

      if (this.currentlyPlaying) {
        msg += 'Currently Playing:\n';
        msg += this.currentlyPlaying.printString();
        msg += '\n\n';
      }

      msg += 'Playlist:\n';
      if (!len) {
        msg += '- Nothing!\n';
        m.channel.sendMessage(msg);
      } else {
        redisClient.lrange(key, 0, len, (err, list) => {
          if (err) {
            debug('error redis lrange', err, err.stack);
            m.channel.sendMessage('Error getting queue playlist from Redis');
            return;
          }

          for (const item of list) {
            // TODO: cache these values earlier
            const a = new QueuedMedia(this, JSON.parse(item));
            msg += `${a.printString()}\n`;
          }

          m.channel.sendMessage(msg);
        });
      }
    });
  }

  queueItem(m, url) {
    debug('QUEUE_ITEM', url);
    if (!url) {
      debug('no valid url');
      m.channel.sendMessage(`${m.author.mention} Please give me a URL to play`);
      return;
    }

    Utils.fetchYoutubeInfo(url).then((arr) => {
      debug('fetchYoutubeInfo promise resolve');

      const fields = ['title', 'video_id', 'length_seconds'];
      const info = fields.reduce((obj, field) => {
        obj[field] = arr[0][field];
        return obj;
      }, {});
      const formats = arr[1];

      const record = {
        type: Types.YTDL,
        ownerId: m.author.id,
        guildId: m.guild.id,
        info,
        formats,
      };

      this.queueSave(m.guild.id, record, this.afterRedisSave.bind(this, m));
    }).catch((err) => {
      if (err) {
        debug('error pulling youtube data', err.stack);
      }

      fs.access(url, fs.R_OK, (err2) => {
        debug('file access', err2);

        if (!err2) {
          const info = {
            title: 'ffmpeg',
            format: 'ffmpeg',
            encoding: 'ffmpeg',
            url,
          };

          const record = {
            type: Types.LOCAL,
            ownerId: m.author.id,
            guildId: m.guild.id,
            info,
          };

          this.queueSave(m.guild.id, record, this.afterRedisSave.bind(this, m));
        }
      });
    });
  }

  queueSave(guildId, record, cb) {
    redisClient.rpush(`cardinal.${guildId}:music_queue`, JSON.stringify(record), (err) => {
      if (err) {
        debug('error saving to redis', err, err.stack);
        m.channel.sendMessage('An error occurred saving the queue request to Redis');
        return;
      }

      debug('saved to redis');

      cb(record);
    });
  }

  afterRedisSave(m) {
    this.handleQueued(m.guild, m.author, m.channel).then((printString) => {
      debug('queueSave promise resolve', !!printString);
      if (printString) m.channel.sendMessage(`Added ${printString}`);
    }).catch((err) => {
      debug('queueSave promise reject', err);
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
    this.handleQueued(m.guild);
  }

  playNext(guild, author, channel) {
    debug('playNext');

    const authorVoiceChannel = (guild && author) ? author.getVoiceChannel(guild) : null;

    return new Promise((resolve, reject) => {
      redisClient.lpop(`cardinal.${guild.id}:music_queue`, (err, reply) => {
        if (err) {
          debug('error getting next item from redis', err.stack);
          return;
        }

        let record = null;
        try {
          record = JSON.parse(reply);
        } catch (err) {
          debug('error parsing Redis response', err, reply);
          return;
        }

        const next = new QueuedMedia(this, record || {});
        this.currentlyPlaying = next;

        if (!authorVoiceChannel && channel) {
          channel.sendMessage(`${author.mention} Can you please join a voice channel I can play to?`);

          this.queuedDonePlaying(this.currentlyPlaying);

          return resolve(false);
        } else if (this.voiceConnection && !this.voiceConnection.disposed && this.voiceConnection.canStream) {
          this.currentlyPlaying.play(this.voiceConnection);
        } else {
          return authorVoiceChannel.join(false, false).then((info) => {
            debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`);

            this.voiceConnection = info.voiceConnection;

            this.currentlyPlaying.play(this.voiceConnection);

            resolve(this.currentlyPlaying.printString());
          }).catch((err) => {
            debug('failed to join voice chat', err, err.stack);

            if (err.message === 'Missing permission' && authorVoiceChannel) {
              channel.sendMessage(`${author.mention} I do not have permission to join the '${authorVoiceChannel.name}' voice channel`);
            }

            this.queuedDonePlaying(this.currentlyPlaying);

            resolve(false);
          });
        }

        return resolve(this.currentlyPlaying.printString());
      });
    });
  }

  handleQueued(guild, author, channel) {
    debug('handleQueued');

    if (!guild) {
      debug('no guild provided');
      return;
    }

    const key = `cardinal.${guild.id}:music_queue`;

    return new Promise((resolve, reject) => {
      redisClient.llen(key, (err, len) => {
        debug(`redis ${key}`, len, err);

        if (this.currentlyPlaying === null && len > 0) {
          return this.playNext(guild, author, channel).then(resolve, reject);
        } else if (len === 0 && this.voiceConnection && !this.voiceConnection.disposed) {
          debug('handleQueued disconnect');

          this.voiceConnection.disconnect();
          this.voiceConnection = null;
        }

        return resolve(true);
      });
    });
  }

  queuedDonePlaying(queued) {
    if (queued === this.currentlyPlaying) {
      const guild = client.Guilds.get(queued.guildId);

      this.currentlyPlaying = null;
      this.handleQueued(guild);
    }
  }
}

module.exports = new MusicPlayer();
