"use strict";

const Discordie = require('discordie');

const Module = require('../Core/API/Module');

const REGEX = /<@[!]?([0-9]+)>/;

class GuildManagement extends Module {
  constructor(container) {
    super(container);

    this.ids = this.container.get('ids');
    this.redisBrain = this.container.get('redisBrain');

    this.checkMethods = [
      this.checkAuthentication,
    ];

    this.hears(/admin/i, this.wrap(this.checkMethods, this.onAdminCommand));
    this.hears(/prune/i, this.wrap(this.checkMethods, this.onPruneCommand));
  }

  wrap(checkMethods, methodToInvoke) {
    return (m, args) => {
      const promises = checkMethods.map(method => method.call(this, m));

      return Promise.all(promises).then((results) => {
        if (results.some(res => !res)) {
          return m.reply('You are not authorized to use this command.');
        }
        return methodToInvoke.call(this, m, args);
      });
    };
  }

  checkAuthentication({guild, author}) {
    // Variable name that is more appropriate
    const user = author;

    // Shortcut for myself ( ͡° ͜ʖ ͡°)
    if (user.id === this.ids.owner) {
      return Promise.resolve(true);
    }

    const guildMember = user.memberOf(guild);
    if (!guildMember) {
      return Promise.resolve(false);
    }
    if (user.can(Discordie.Permissions.General.ADMINISTRATOR, guild)) {
      return Promise.resolve(true);
    }

    // The role here is done by name to account for the situation where the
    // role is deleted and recreated with the same name.
    const key = this.getRedisKey(guild.id, 'admin_role_name');
    return this.redisBrain.getAsync(key).then((roleName) => {
      if (roleName && guildMember.roles.every(role => role.name !== roleName)) {
        return false;
      }

      // At this point, the user is either part of the admin role or has the
      // "Administrator" permission
      return true;
    });
  }

  onAdminCommand(m, args) {
    return m.reply('This is just a placeholder.');
  }

  onPruneCommand(m, args) {
    if (args < 2) {
      return m.reply('I need the username and the number of messages by that user to prune.');
    }

    const user = REGEX.exec(args[0]);
    const numMessages = parseInt(args[1]);

    if (isNaN(numMessages) || numMessages <= 0) {
      return m.reply('Please supply a number of messages to prune that is greater than zero.');
    }
    if (user === null) {
      return m.reply('Please supply the user as a mention for the first argument.');
    }

    const client = this.container.get('bot').client;
    const userId = parseInt(user);

    return client.Users.fetchMembers(m.guild).then(() =>
      m.channel.fetchMessages()
    ).then(({messages}) => {
      const msgsByUser = messages.filter(msg => msg.author.id === userId);
      const toDelete = msgsByUser.slice(0, numMessages);
      return client.Messages.deleteMessages(toDelete, m.channel);
    });
  }
}

module.exports = GuildManagement;
