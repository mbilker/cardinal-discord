"use strict";

const fs = require('fs');

const Module = require('../Core/API/Module');

const Types = require('../queue/types');
const Utils = require('../queue/utils');
const QueuedMedia = require('../queue/queued-media');

class MusicPlayer extends Module {
  constructor(container) {
    super(container);

    this.bot = this.container.get('bot');
    this.redisClient = this.container.get('redisBrain');

    this.currentlyPlaying = null;
    this.voiceConnection = null;

    this.QueuedMedia = QueuedMedia;

    this.hears(/np/i, this.onNowPlaying.bind(this));
    this.hears(/li/i, this.onDisplayPlaylist.bind(this));
    this.hears(/queue/i, this.queueItem.bind(this));
    this.hears(/next/i, this.skipSong.bind(this));

    QueuedMedia.initialize(this.container);
  }

  getRedisKey(guildId) {
    return `cardinal.${guildId}:music_queue`;
  }

  onNowPlaying(m) {
    this.logger.debug('QUEUE_DISPLAY_NOW_PLAYING');
    if (this.currentlyPlaying === null) {
      m.channel.sendMessage('No queued song');
      return;
    }
    m.channel.sendMessage(this.currentlyPlaying.printString());
  }

  onDisplayPlaylist(m) {
    this.logger.debug('QUEUE_DISPLAY_PLAYLIST');
    const key = this.getRedisKey(m.guild.id);
    let msg = '';

    this.redisClient.llen(key, (err, len) => {
      if (err) {
        this.logger.debug('error reading list length from redis', err, err.stack);
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
        this.redisClient.lrange(key, 0, len, (err, list) => {
          if (err) {
            this.logger.debug('error redis lrange', err, err.stack);
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

  queueItem(m, args) {
    const url = args.join(' ');

    this.logger.debug('QUEUE_ITEM', url);
    if (!url) {
      this.logger.debug('no valid url');
      m.channel.sendMessage(`${m.author.mention} Please give me a URL to play`);
      return;
    }

    Utils.fetchYoutubeInfo(url).then((arr) => {
      this.logger.debug('fetchYoutubeInfo promise resolve');

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
        this.logger.debug('error pulling youtube data', err.stack);
      }

      fs.access(url, fs.R_OK, (err2) => {
        this.logger.debug('file access', err2);

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
    this.redisClient.rpush(`cardinal.${guildId}:music_queue`, JSON.stringify(record), (err) => {
      if (err) {
        this.logger.debug('error saving to redis', err, err.stack);
        m.channel.sendMessage('An error occurred saving the queue request to Redis');
        return;
      }

      this.logger.debug('saved to redis');

      cb(record);
    });
  }

  afterRedisSave(m) {
    this.handleQueued(m.guild, m.author, m.channel).then((printString) => {
      this.logger.debug('queueSave promise resolve', !!printString);
      if (printString) m.channel.sendMessage(`Added ${printString}`);
    }).catch((err) => {
      this.logger.debug('queueSave promise reject', err);
    });
  }

  skipSong(m) {
    if (m.author.id !== '142098955818369024') {
      m.reply(`You are not authorized to perform this action.`);
      return;
    }

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
    this.logger.debug('playNext');

    const authorVoiceChannel = (guild && author) ? author.getVoiceChannel(guild) : null;

    return new Promise((resolve, reject) => {
      this.redisClient.lpop(`cardinal.${guild.id}:music_queue`, (err, reply) => {
        if (err) {
          this.logger.debug('error getting next item from redis', err.stack);
          return;
        }

        let record = null;
        try {
          record = JSON.parse(reply);
        } catch (err) {
          this.logger.debug('error parsing Redis response', err, reply);
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
            this.logger.debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`);

            this.voiceConnection = info.voiceConnection;

            this.currentlyPlaying.play(this.voiceConnection);

            resolve(this.currentlyPlaying.printString());
          }).catch((err) => {
            this.logger.debug('failed to join voice chat', err, err.stack);

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
    this.logger.debug('handleQueued');

    if (!guild) {
      this.logger.debug('no guild provided');
      return;
    }

    const key = `cardinal.${guild.id}:music_queue`;

    return new Promise((resolve, reject) => {
      this.redisClient.llen(key, (err, len) => {
        this.logger.debug(`redis ${key}`, len, err);

        if (this.currentlyPlaying === null && len > 0) {
          return this.playNext(guild, author, channel).then(resolve, reject);
        } else if (len === 0 && this.voiceConnection && !this.voiceConnection.disposed) {
          this.logger.debug('handleQueued disconnect');

          this.voiceConnection.disconnect();
          this.voiceConnection = null;
        }

        return resolve(true);
      });
    });
  }

  queuedDonePlaying(queued) {
    if (queued === this.currentlyPlaying) {
      const guild = this.bot.client.Guilds.get(queued.guildId);

      this.currentlyPlaying = null;
      this.handleQueued(guild);
    }
  }
}

module.exports = MusicPlayer;
