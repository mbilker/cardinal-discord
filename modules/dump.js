"use strict";

const crypto = require('crypto');

const followRedirects = require('follow-redirects');
const { http, https } = followRedirects;
const url = require('url');

const Module = require('../Core/API/Module');

const REGEX = /<#([0-9]+)>/;
const EMPTY_IMAGE = '';

class BackupCommand extends Module {
  constructor(container) {
    super(container);

    this.redisClient = this.container.get('redisBrain');

    this._inProgress = new Map();
    this._avatarCache = {};

    this._agent = new http.Agent({ keepAlive: false, maxSockets: 500 });
    this._secureAgent = new https.Agent({ keepAlive: false, maxSockets : 500 });

    this.hears(/backup/i, this.onBackupCommand.bind(this));
  }

  getRedisKey(guildId, scope) {
    return `cardinal.${guildId}.channelbackup.${scope}`;
  }

  extractId(mention) {
    const result = REGEX.exec(mention);
    return result === null ? null : result[1];
  }

  saveToRedis(textChannel, obj) {
    const redisKey = this.getRedisKey(textChannel.guild.id, textChannel.id);

    return this.redisClient.setAsync(redisKey, JSON.stringify(obj)).then(() => {
      this.logger.info('saved to redis');
    });
  }

  fetchImage(imageURL) {
    if (!imageURL) {
      return Promise.reject('imageURL cannot be null');
    }

    const options = url.parse(imageURL);
    const httpObject = options.protocol === 'http:' ? http : https;

    options.agent = options.protocol === 'http:' ? this._agent : this._secureAgent;

    return new Promise((resolve, reject) => {
      const req = httpObject.request(options, (res) => {
        //this.logger.debug(`fetchImage res ${imageURL}`);

        const buffers = [];
        res.on('data', (chunk) => {
          buffers.push(chunk);
        });
        res.on('end', () => {
          const buf = Buffer.concat(buffers);
          const base64 = `data:image/jpeg;base64,${buf.toString('base64')}`;
          resolve(base64);
        });
        res.on('error', (err) => {
          reject(err);
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  fetchAvatar({ avatarURL, id }) {
    if (this._avatarCache[id]) {
      return this._avatarCache[id];
    } else if (!avatarURL) {
      return Promise.resolve(EMPTY_IMAGE);
    }

    const redisKey = this.getRedisKey('avatar', id);

    const promise = this.redisClient.getAsync(redisKey).then(([ avatar ]) => {
      if (avatar) {
        this.logger.debug(`avatar redis exists ${id}`);
        return avatar;
      }
      return this.fetchImage(avatarURL);
    }).then((base64) => {
      this.logger.debug(`avatar retrieved ${id}`);
      if (base64) {
        return this.redisClient.setAsync(redisKey, base64).then(() => base64);
      }
      return base64;
    }, (err) => {
      this.logger.error(`avatar fetch failed ${id} ${avatarURL}`);
      return EMPTY_IMAGE;
    });
    this._avatarCache[id] = promise;

    return promise;
  }

  fetchOtherImage(imageURL) {
    const redisKey = this.getRedisKey('image', crypto.createHash('sha256').update(imageURL).digest('hex'));

    return this.redisClient.getAsync(redisKey).then(([ image ]) => {
      if (image) {
        this.logger.warn(`other image redis exists ${imageURL}`);
        return image;
      }
      return this.fetchImage(imageURL);
    }).then((base64) => {
      this.logger.debug(`other image retrieved ${imageURL}`);
      if (base64) {
        return this.redisClient.setAsync(redisKey, base64).then(() => base64);
      }
      return base64;
    }, (err) => {
      this.logger.warn(`other image failed ${imageURL}`);
      this.logger.error(`other image error ${err}`);
      return EMPTY_IMAGE;
    });
  }

  /**
   *  Format:
   *  {
   *    avatars: {Object} object where the key is the user id and the value is the data base64 encoded image
   *    messages: {Array} array of messages in ascending time order
   *  }
   */
  onPartCompletion(ctx, messages) {
    const finalized = messages.map((message) => {
      const plain = message.toJSON();
      const resolvedContent = message.resolveContent();
      plain.content = resolvedContent;

      if (!ctx.avatars[message.author.id]) {
        ctx.avatars.push(this.fetchAvatar(message.author).then((res) => [message.author.id, res]));
      }

      const promises = message.embeds.map((embed) => {
        if (embed && embed.thumbnail) {
          return this.fetchOtherImage(embed.thumbnail.url);
        } else if (embed) {
          if (embed && (embed.type === 'video' || embed.type === 'article' || embed.type === 'tweet' || embed.type === 'image')) {
            //this.logger.error(`no thumbnail for embed ${JSON.stringify(embed)}`);
          } else if (embed && embed.type === 'link') {
            //this.logger.debug('link embed found');
          } else {
            this.logger.error(`embed is something else ${JSON.stringify(embed)}`);
          }
          //return Promise.resolve(EMPTY_IMAGE);
        }
      });

      return Promise.all(promises).then((values) => {
        for (const [i, base64] of values.entries()) {
          if (base64) {
            plain.embeds[i].proxy_url = base64;
          }
        }

        return plain;
      });
    });

    return finalized;
  }

  onCompletion(ctx, textChannel) {
    const { info } = ctx;

    const allPromises = [
      Promise.all(ctx.avatars),
      Promise.all(ctx.messages)
    ];

    return Promise.all(allPromises).then(([ zipAvatars, messages ]) => {
      const avatars = {};
      for (const zip of zipAvatars) {
        avatars[zip[0]] = zip[1];
      }

      const obj = { avatars, messages, info };
      return this.saveToRedis(textChannel, obj);
    });
  }

  storeMessages(ctx, id, messages) {
    const reversed = messages.reverse();
    const part = this.onPartCompletion(ctx, reversed);
    ctx.messages = ctx.messages.concat(part);
  }

  onFetch(ctx, e, textChannel) {
    if (!e.messages.length) {
      this.logger.debug('reached the end of the history');

      this._inProgress.delete(textChannel.id);
      return this.onCompletion(ctx, textChannel);
    }

    this.storeMessages(ctx, textChannel.id, e.messages);

    const before = e.messages[0];
    return textChannel.fetchMessages(100, before).then(e => this.onFetch(ctx, e, textChannel));
  }

  onBackupCommand(m, args) {
    if (!m.guild) {
      return m.reply('No guild applicable to this message');
    } else if (args.length < 1) {
      return m.reply('Please provide a channel to backup');
    }

    const targetChannel = this.extractId(args[0]);
    if (!targetChannel) {
      return m.reply('Please provide a valid channel');
    }
    this.logger.debug(`targetChannel: ${targetChannel}`);
    const textChannel = m.guild.textChannels.find((channel) => channel.id.toString() === targetChannel);
    if (!textChannel) {
      return m.reply('No matching text channel found');
    }

    if (this._inProgress[textChannel.id]) {
      return m.reply('Already backing up channel');
    }
    this._inProgress.set(textChannel.id, true);

    const ctx = {
      avatars: [],
      messages: [],
      info: textChannel.toJSON()
    };

    this.logger.info(`starting backup of ${textChannel.name} (${textChannel.id})`);
    m.channel.sendMessage(`Starting backup of ${textChannel.mention}`);
    return textChannel.fetchMessages(null, null, null).then(e => this.onFetch(ctx, e, textChannel)).then(() => {
      this.logger.info('all done');
      return m.channel.sendMessage(`Backup finished (${ctx.messages.length} message(s))`);
    }).catch((err) => {
      this.logger.error('error with channel backup', err);
      return m.reply('Failed to complete channel backup, consult console for more information');
    });
  }
}

module.exports = BackupCommand;
