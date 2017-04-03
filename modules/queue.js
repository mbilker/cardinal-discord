"use strict";

const fs = require('fs');
const path = require('path');
const util = require('util');

const Module = require('../Core/API/Module');

const Types = require('../queue/types');
const LocalMusicSearch = require('../queue/search');
const Utils = require('../queue/utils');
const QueuedMedia = require('../queue/queued-media');

class MusicPlayer extends Module {
  constructor(container) {
    super(container);

    this.bot = this.container.get('bot');
    this.redisClient = this.container.get('redisBrain');
    this.settings = this.container.get('settings');

    this.currentlyPlaying = null;
    this.voiceConnection = null;
    this.recordCache = new Map();

    this.QueuedMedia = QueuedMedia;

    this.hears(/np/i, this.onNowPlaying.bind(this));
    this.hears(/li/i, this.onDisplayPlaylist.bind(this));
    this.hears(/queue/i, this.queueItem.bind(this));
    this.hears(/next/i, this.skipSong.bind(this));
    this.hears(/yt/i, this.onYoutube.bind(this));
    this.hears(/sel/i, this.onSelectSearchResult.bind(this));

    if (MusicPlayer.useMPD) {
      this.search = new LocalMusicSearch(this.container);
      this.hears(/search/i, this.onSearch.bind(this));
    }

    QueuedMedia.initialize(this.container);
  }

  shutdown() {
    if (MusicPlayer.useMPD) {
      this.search.shutdown();
    }
  }

  getRedisKey(guildId, scope) {
    return `cardinal.${guildId}.${scope}`;
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
    const key = this.getRedisKey(m.guild.id, 'music_queue');
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
      return m.reply('Please give me a URL to play');
    }

    Utils.fetchYoutubeInfo(url).then((obj) => {
      this.logger.debug('fetchYoutubeInfo promise resolve');

      const fields = ['alt_title', 'display_id', 'duration'];
      const info = fields.reduce((obj, field) => {
        obj[field] = obj[field];
        return obj;
      }, {});
      const formats = [obj.formats.find(elem => elem.format_id === obj.format_id)];

      const record = {
        type: Types.YTDL,
        ownerId: m.author.id,
        guildId: m.guild.id,
        info,
        formats,
      };

      return this.queueSave(m.guild.id, record).then(this.afterRedisSave.bind(this, m));
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

          return this.queueSave(m.guild.id, record).then(this.afterRedisSave.bind(this, m));
        }

        this.logger.error('file access error', err2);
      });
    });
  }

  queueSave(guildId, record) {
    const redisKey = this.getRedisKey(guildId, 'music_queue');

    return this.redisClient.rpushAsync(redisKey, JSON.stringify(record)).then(() => {
      this.logger.debug('saved to redis');

      return record;
    });
  }

  onSearch(m, args) {
    const text = args.join(' ');

    return this.search.byAnyField(text).then((results) =>
      results.slice(0, 5).map((entry) => {
        const filePath = path.join(this.settings.mpd.baseDirectory, entry.file);
        return { id: filePath, title: entry.file };
      })
    ).then((entries) => {
      const redisKey = this.getRedisKey(m.guild.id, `${m.channel.id}.search`);
      this.redisClient.set(redisKey, JSON.stringify(entries));

      const response = entries.map((item, i) => `**${i + 1}:** ${item.title}`).join('\n');
      return m.channel.sendMessage(response);
    });
  }

  onYoutube(m, args) {
    const text = args.join(' ');

    return Utils.searchYoutube(text).then((results) => {
      const useful = results.items.map((item) => {
        return { id: item.id.videoId, title: item.snippet.title };
      });

      const redisKey = this.getRedisKey(m.guild.id, `${m.channel.id}.search`);
      this.redisClient.set(redisKey, JSON.stringify(useful));

      const response = useful.map((item, i) => `**${i + 1}:** ${item.title}`).join('\n');
      return m.channel.sendMessage(response);
    });
  }

  onSelectSearchResult(m, args) {
    if (args < 1) {
      return m.reply('Please supply an index to play from search results');
    }

    const index = parseInt(args[0]);

    if (isNaN(index) || index < 1) {
      return m.reply('Please supply a valid index');
    }

    const position = index - 1;
    const redisKey = this.getRedisKey(m.guild.id, `${m.channel.id}.search`);

    return this.redisClient.getAsync(redisKey).then(([ result ]) => {
      if (!result) {
        return m.reply('There is no previous search query');
      }
      const entries = JSON.parse(result);

      return this.queueItem(m, [entries[position].id]);
    });
  }

  afterRedisSave(m, record) {
    return this.handleQueued(m.guild, m.author, m.channel).then((printString) => {
      this.logger.debug('queueSave promise resolve', !!printString);
      if (printString) {
        m.channel.sendMessage(`Added ${printString}`);
      } else {
        const tempQueued = new QueuedMedia(this, record);
        m.channel.sendMessage(`Added ${tempQueued.printString()}`);
      }
    });
  }

  skipSong(m) {
    if (m.author.id !== '142098955818369024') {
      return m.reply(`You are not authorized to perform this action.`);
    }

    if (!this.currentlyPlaying) {
      return m.channel.sendMessage('No currently playing song');
    } else if (!this.currentlyPlaying.stream) {
      return m.channel.sendMessage('For some reason this song does not have a stream associated with it');
    }

    this.currentlyPlaying.stopPlaying();
    this.currentlyPlaying = null;
    return this.handleQueued(m.guild);
  }

  playNext(guild, author, channel) {
    this.logger.debug('playNext');

    const authorVoiceChannel = (guild && author) ? author.getVoiceChannel(guild) : null;
    const redisKey = this.getRedisKey(guild.id, 'music_queue');

    return this.redisClient.lpopAsync(redisKey).then(JSON.parse).then((record) => {
      const next = new QueuedMedia(this, record || {});
      this.currentlyPlaying = next;

      if (!authorVoiceChannel && channel) {
        channel.sendMessage(`${author.mention} Can you please join a voice channel I can play to?`);

        this.queuedDonePlaying(this.currentlyPlaying);

        return false;
      } else if (this.voiceConnection && !this.voiceConnection.disposed && this.voiceConnection.canStream) {
        this.currentlyPlaying.play(this.voiceConnection);
      } else {
        return authorVoiceChannel.join(false, false).then((info) => {
          this.logger.debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`);

          this.voiceConnection = info.voiceConnection;

          this.currentlyPlaying.play(this.voiceConnection);

          return this.currentlyPlaying.printString();
        }).catch((err) => {
          this.logger.debug('failed to join voice chat', err, err.stack);

          if (err.message === 'Missing permission' && authorVoiceChannel) {
            channel.sendMessage(`${author.mention} I do not have permission to join the '${authorVoiceChannel.name}' voice channel`);
          }

          return this.queuedDonePlaying(this.currentlyPlaying);
        });
      }

      return this.currentlyPlaying.printString();
    }).catch((err) => {
      if (err) {
        this.logger.debug('error getting next item from redis', err.stack);
      }
      throw err;
    });
  }

  handleQueued(guild, author, channel) {
    this.logger.debug('handleQueued');

    if (!guild) {
      this.logger.debug('no guild provided');
      return;
    }

    const redisKey = this.getRedisKey(guild.id, 'music_queue');

    return new Promise((resolve, reject) => {
      this.redisClient.llen(redisKey, (err, len) => {
        this.logger.debug(`redis ${redisKey}`, len, err);

        if (this.currentlyPlaying === null && len > 0) {
          return this.playNext(guild, author, channel).then(resolve, reject);
        } else if (len === 0 && this.voiceConnection && !this.voiceConnection.disposed) {
          this.logger.debug('handleQueued disconnect');

          this.voiceConnection.disconnect();
          this.voiceConnection = null;
        }

        return resolve();
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
