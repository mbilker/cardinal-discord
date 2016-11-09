"use strict";

const followRedirects = require('follow-redirects');
const { http, https } = followRedirects;
const url = require('url');

const Module = require('../Core/API/Module');

const REGEX = /<#([0-9]+)>/;

class BackupCommand extends Module {
  constructor(container) {
    super(container);

    this.redisClient = this.container.get('redisBrain');

    this._inProgress = new Map();
    this._avatarCache = {};
    this._messages = {};

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
    const options = url.parse(imageURL);
    const httpObject = options.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
      httpObject.get(imageURL, (res) => {
        this.logger.debug(`fetchImage res ${imageURL}`);

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
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  fetchAvatar(user) {
    if (this._avatarCache[user.id]) {
      return this._avatarCache[user.id];
    }

    const promise = this.fetchImage(user.avatarURL).then((base64) => {
      this.logger.debug(`avatar retrieved ${user.id}`);
      return base64;
    });
    this._avatarCache[user.id] = promise;

    return promise;
  }

  /**
   *  Format:
   *  {
   *    avatars: {Object} object where the key is the user id and the value is the data base64 encoded image
   *    messages: {Array} array of messages in ascending time order
   *  }
   */
  onCompletion(textChannel) {
    const messages = this._messages[textChannel.id];
    const info = textChannel.toJSON();

    const avatars = {};
    const finalized = messages.map((message) => {
      const plain = message.toJSON();
      const resolvedContent = message.resolveContent();
      plain.content = resolvedContent;

      const promises = [this.fetchAvatar(message.author)];

      for (const embed of message.embeds) {
        promises.push(this.fetchImage(embed.thumbnail.url));
      }

      return Promise.all(promises).then((values) => {
        avatars[message.author.id] = values.shift();

        for (const [i, base64] of values.entries()) {
          plain.embeds[i].proxy_url = base64;
        }

        return plain;
      });
    });

    return Promise.all(finalized).then((messages) => {
      const obj = { avatars, messages, info };
      return this.saveToRedis(textChannel, obj);
    });
  }

  storeMessages(id, messages) {
    this._messages[id] = this._messages[id].concat(messages.reverse());
  }

  onFetch(e, textChannel) {
    if (!e.messages.length) {
      this.logger.debug('reached the end of the history');

      this._inProgress.delete(textChannel.id);
      return this.onCompletion(textChannel);
    }

    this.storeMessages(textChannel.id, e.messages);

    const before = e.messages[0];
    return textChannel.fetchMessages(100, before).then(e => this.onFetch(e, textChannel));
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
    this._messages[textChannel.id] = [];

    this.logger.info(`starting backup of ${textChannel.name} (${textChannel.id})`);
    m.channel.sendMessage(`Starting backup of ${textChannel.mention}`);
    return textChannel.fetchMessages(null, null, null).then(e => this.onFetch(e, textChannel)).then(() => {
      this.logger.info('all done');
      m.channel.sendMessage(`Backup finished (${this._messages[textChannel.id].length} message(s))`);
    }).catch((err) => {
      this.logger.error('error with channel backup', err);
      return m.reply('Failed to complete channel backup, consult console for more information');
    });
  }
}

module.exports = BackupCommand;
