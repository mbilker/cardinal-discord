"use strict";

const fs = require('fs');
const path = require('path');
const url = require('url');
const util = require('util');

const Module = require('../core/api/module');

const GuildMusicPlayer = require('../queue/guild');
const LocalMusicSearch = require('../queue/search');
const QueuedMedia = require('../queue/queued-media');
const Types = require('../queue/types');
const Utils = require('../queue/utils');

const YOUTUBE_PREFIX = 'https://www.youtube.com/watch?v=';

class MusicPlayer extends Module {
  constructor(container) {
    super(container);

    this.bot = this.container.get('bot');
    this.redisClient = this.container.get('redisBrain');
    this.settings = this.container.get('settings');

    this.utils = new Utils(container);

    this.guildInstances = new Map();

    this.hears(/np/i, this.onNowPlaying.bind(this));
    this.hears(/li/i, this.onDisplayPlaylist.bind(this));
    this.hears(/q/i, this.queueItem.bind(this));
    this.hears(/queue/i, this.queueItem.bind(this));
    this.hears(/next/i, this.skipSong.bind(this));
    this.hears(/pause/i, this.onPauseCommand.bind(this));
    this.hears(/yt/i, this.onYoutube.bind(this));
    this.hears(/sel/i, this.onSelectSearchResult.bind(this));

    if (this.settings.elasticsearch.enable) {
      this.search = new LocalMusicSearch(this.container);
      this.hears(/search/i, this.onSearch.bind(this));
    }

    this.container.get('events').on('ADD_GUILD', (guild) => {
      if (!this.guildInstances.has(guild.id)) {
        this.logger.debug(`initializing guild music player for guild: ${guild.id}`);

        const guildInstance = new GuildMusicPlayer(this.container, guild.id);
        this.guildInstances.set(guild.id, guildInstance);
      }
    });

    QueuedMedia.initialize(this.container);
  }

  shutdown() {
    if (this.settings.elasticsearch.enable) {
      this.search.shutdown();
    }
  }

  onNowPlaying(m) {
    const player = this.guildInstances.get(m.guild.id);

    if (player) {
      return player.getCurrentlyPlayingMessage().then((entry) => {
        return m.channel.sendMessage("", false, {
          color: 0xe2d324,
          fields: [
            { name: "__Now Playing__", value: entry }
          ]
        });
      }).catch((e) => {
        this.logger.error(`Guild ${m.guild.id} get currently playing song error:`, e);
      });
    }
  }

  onDisplayPlaylist(m) {
    const key = this.getRedisKey(m.guild.id, 'music_queue');
    const player = this.guildInstances.get(m.guild.id);

    const nowPlaying = player.getCurrentlyPlayingMessage().catch(() => 'Nothing!');
    const listPromise = this.redisClient.lrange(key, 0, 10).then(([list]) => {
      let msg = '';

      if (list.length == 0) {
        msg = 'Nothing!';
        return msg;
      }

      const promises = list.map((entry) => player.formatMessage(JSON.parse(entry)));
      return Promise.all(promises).then((messages) => {
        for (const entry of messages) {
          msg += entry + '\n\n';
        }
        return msg;
      });
    });
    const lengthPromise = this.redisClient.llen(key).then(([len]) => len);

    const promises = [nowPlaying, listPromise, lengthPromise];
    return Promise.all(promises).then(([entry, msg, len]) => {
      const plural = len == 1 ? '' : 's';
      const footerText = `${len} song${plural} in queue`;

      return m.channel.sendMessage("", false, {
        color: 0xe2d324,
        title: 'Playlist Statistics',
        fields: [
          { name: "__Now Playing__", value: entry },
          { name: "__Queue__", value: msg },
        ],
        footer: {
          text: footerText,
        }
      });
    }).catch((err) => {
      if (err) {
        this.logger.error('error redis lrange', err);
        return m.reply('I could not get the queue playlist from Redis.');
      }
    });
  }

  printItems(entries) {
    const msgs = [];
    let currentMsg = '';

    for (const text of entries) {
      if (currentMsg.length + text.length >= 1024) {
        msgs.push(currentMsg);
        currentMsg = '';
      }
      currentMsg += `${text}\n`;
    }

    if (currentMsg.length > 0) {
      msgs.push(currentMsg);
    }

    return msgs;
  }

  queueItems(m, args) {
    const promises = [];

    for (const url of args) {
      promises.push(this.queueItem(m, url));
    }

    return Promise.all(promises);
  }

  queueItem(m, args) {
    this.logger.debug('QUEUE_ITEM', args);

    if (!args) {
      this.logger.debug('no valid url');
      return m.reply('Please give me a URL to play');
    }

    const guildId = m.guild.id;
    const filePath = Array.isArray(args) ? args.join(' ') : args;
    const parsedUrl = url.parse(filePath);

    let promise = null;

    if (parsedUrl.protocol === 'file:' || parsedUrl.protocol === null) {
      const record = {
        type: Types.LOCAL,
        ownerId: m.author.id,
        guildId: m.guild.id,
        url: filePath,
        path: filePath
      };

      promise = this.queueSave(m.guild.id, record)
        .then((record) => this.queuePostAddItem(m, [record]));
    } else {
      promise = this.utils.fetchYoutubeInfo(filePath).then((obj) => {
        this.logger.debug('fetchYoutubeInfo promise resolve');

        const promises = [];

        if (obj['_type'] === 'playlist') {
          for (const entry of obj.entries) {
            promises.push(this.queueAddItem(m, entry));
          }
        } else {
          promises.push(this.queueAddItem(m, obj));
        }

        return Promise.all(promises).then((records) => this.queuePostAddItem(m, records));
      });
    }

    return promise.catch((err) => {
      if (err) {
        this.logger.debug('queueItem error', err.stack);
      }

      return m.reply('Sorry, I was not able to queue that song.');
    });
  }

  queueAddItem(m, obj) {
    const fields = [
      { from: 'title' },
      { from: 'display_id', to: 'id' },
      { from: 'duration' },
      { from: 'acodec', to: 'encoding' },
      { from: 'webpage_url', to: 'url' },
      { from: 'path' },
    ];
    const info = fields.reduce((info, field) => {
      info[field.to || field.from] = obj[field.from];
      return info;
    }, {});
    // const formats = [obj.formats.find(elem => elem.format_id === obj.format_id)];

    // TODO: Use "Object Spread" when it is implemented
    const record = Object.assign({
      type: Types.YTDL,
      ownerId: m.author.id,
      guildId: m.guild.id,
    }, info /* , formats */);

    return this.queueSave(m.guild.id, record);
  }

  queueSave(guildId, record) {
    const redisKey = this.getRedisKey(guildId, 'music_queue');

    return this.redisClient.rpush(redisKey, JSON.stringify(record)).then(() => {
      this.logger.debug('saved to redis');

      return record;
    });
  }

  queuePostAddItem(m, records) {
    console.log(records);

    const player = this.guildInstances.get(m.guild.id);

    const promises = records.map((entry) => player.formatMessage(entry));
    const promise = Promise.all(promises).then((messages) => {
      const entries = messages.map((msg) => `Added ${msg}`);
      const msgs = this.printItems(entries);

      let promise = Promise.resolve();
      msgs.forEach((msg) => {
        promise = promise.then(() => m.channel.sendMessage("", false, {
          fields: [
            { name: "Queued Songs", value: msg }
          ]
        }));
      });
    });

    return promise.then(() => this.handleQueued(m.guild, m.author, m.channel)).then((res) => {
      this.logger.debug('queueSave promise resolve', res)
    });
  }

  onSearch(m, args) {
    const text = args.join(' ');

    return this.search.byAnyField(text).then((results) =>
      results.map((entry) => {
        return { id: entry.path, title: entry.title };
      })
    ).then((entries) => {
      let promises = [];

      const redisKey = this.getRedisKey(m.guild.id, m.channel.id, 'search');
      const stringified = JSON.stringify(entries);
      promises.push(this.redisClient.set(redisKey, stringified));

      if (entries.length > 0) {
        const response = entries.map((item, i) => `**${i + 1}:** ${item.title}`).join('\n');
        promises.push(m.channel.sendMessage(response));
      } else {
        promises.push(m.reply('No results found.'));
      }

      return Promise.all(promises);
    });
  }

  onYoutube(m, args) {
    const text = args.join(' ');

    return this.utils.searchYoutube(text).then((results) => {
      let promises = [];

      const useful = results.items.map((item) => {
        const id = YOUTUBE_PREFIX + item.id.videoId;
        return { id, title: item.snippet.title };
      });

      const redisKey = this.getRedisKey(m.guild.id, m.channel.id, 'search');
      const stringified = JSON.stringify(useful);
      promises.push(this.redisClient.set(redisKey, stringified));

      const response = useful.map((item, i) => `**${i + 1}:** ${item.title}`).join('\n');
      promises.push(m.channel.sendMessage(response));

      return Promise.all(promises);
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
    const redisKey = this.getRedisKey(m.guild.id, m.channel.id, 'search');

    return this.redisClient.get(redisKey).then(([ result ]) => {
      if (!result) {
        return m.reply('There is no previous search query');
      }
      const entries = JSON.parse(result);

      return this.queueItem(m, entries[position].id);
    });
  }

  skipSong(m) {
    if (m.author.id !== '142098955818369024') {
      return m.reply('You are not authorized to perform this action.');
    }

    const key = this.getRedisKey(m.guild.id, 'music_queue');
    const player = this.guildInstances.get(m.guild.id);

    return this.redisClient.llen(key).then(([len]) => {
      const currentlyPlaying = player.getCurrentlyPlaying();

      let author = m.author;

      if (len === 0) {
        if (!currentlyPlaying) {
          return m.reply('No currently playing song');
        }
        // player.currentlyPlaying can be assumed to be true since the previous test
        // failed
        else if (!currentlyPlaying.stream) {
          return m.reply('For some reason this song does not have a stream associated with it');
        }

        author = null;
      }

      if (currentlyPlaying) {
        currentlyPlaying.stopPlaying();
        player.setCurrentlyPlaying(null);
      }

      return this.handleQueued(m.guild, author);
    });
  }

  onPauseCommand(m) {
    const player = this.guildInstances.get(m.guild.id);

    if (player) {
      const currentlyPlaying = player.getCurrentlyPlaying();

      if (currentlyPlaying) {
        currentlyPlaying.pause();
      }
    }
  }

  playNext(guild, author, channel) {
    this.logger.debug('playNext');

    const authorVoiceChannel = (guild && author) ? author.getVoiceChannel(guild) : null;
    const redisKey = this.getRedisKey(guild.id, 'music_queue');

    const player = this.guildInstances.get(guild.id);

    // Play logic
    // 1. Fetch next song in queue
    // 2. Play to an existing voice connection else join the author's voice channel
    // 2. If the author is not in a voice channel, then tell the author to join one

    return this.redisClient.lpop(redisKey).then(JSON.parse).then((record) => {
      const next = new QueuedMedia(this, record || {});
      player.setCurrentlyPlaying(next);

      if (!authorVoiceChannel && channel) {
        channel.sendMessage(`${author.mention}, Can you please join a voice channel I can play to?`);

        this.queuedDonePlaying(player.getCurrentlyPlaying());

        return false;
      } else if (this.voiceConnection && !this.voiceConnection.disposed && this.voiceConnection.canStream) {
        player.getCurrentlyPlaying().play(this.voiceConnection);

        return true;
      } else if (authorVoiceChannel) {
        return authorVoiceChannel.join(false, false).then((info) => {
          this.logger.debug(`joined voice chat: ${info.voiceSocket.voiceServerURL}@${info.voiceSocket.mode}`);

          this.voiceConnection = info.voiceConnection;

          player.getCurrentlyPlaying().play(this.voiceConnection);

          return true;
        }).catch((err) => {
          this.logger.debug('failed to join voice chat', err);

          if (err.message === 'Missing permission' && authorVoiceChannel) {
            channel.sendMessage(`${author.mention}, I do not have permission to join the '${authorVoiceChannel.name}' voice channel`);
          }

          return this.queuedDonePlaying(player.getCurrentlyPlaying());
        });
      }

      return false;
    }).catch((err) => {
      if (err) {
        this.logger.debug('error getting next item from redis', err);
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
    const player = this.guildInstances.get(guild.id);

    return this.redisClient.llen(redisKey).then(([len]) => {
      this.logger.debug(`redis ${redisKey}`, len);

      if (player.getCurrentlyPlaying() === null && len > 0) {
        return this.playNext(guild, author, channel);
      } else if (len === 0 && this.voiceConnection && !this.voiceConnection.disposed) {
        this.logger.debug('handleQueued disconnect');

        this.voiceConnection.disconnect();
        this.voiceConnection = null;
      }
    });
  }

  queuedDonePlaying(queued) {
    const player = this.guildInstances.get(queued.guildId);
    if (queued === player.getCurrentlyPlaying()) {
      const guild = this.bot.client.Guilds.get(queued.guildId);

      player.setCurrentlyPlaying(null);
      this.handleQueued(guild);
    }
  }
}

module.exports = MusicPlayer;
