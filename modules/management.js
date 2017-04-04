"use strict";

const Discordie = require('discordie');

const Module = require('../Core/API/Module');

const REGEX = /<@([0-9]+)>/;

class GuildManagement extends Module {
  constructor(container) {
    super(container);

    this.redisBrain = this.container.get('redisBrain');

    this.hears(/admin/i, this.onAdminCommand.bind(this));
    this.hears(/prune/i, this.onPruneCommand.bind(this));
  }

  wrap(checkMethods, methodToInvoke) {
    return (m, args) => {
      const results = Promise.all(checkMethods);
      console.log(results);
    };
  }

  checkAuthentication({guild, author}) {
    // Variable name that is more appropriate
    const user = author;

    const guildMember = user.memberOf(guild);
    if (!guildMember) {
      return Promise.resolve(false);
    }
    if (user.can(Discordie.Permissions.General.ADMINISTRATOR, guild)) {
      return Promise.resolve(true);
    }

    // The role here is done by name to account for the situation where the
    // role is deleted and recreated with the same name.
    const key = this.getRedisKey(m.guild.id, 'admin_role_name');
    return this.redisBrain.getAsync(key).then((roleName) => {
      if (group && guildMember.roles.some(role => role.name === roleName)) {
        return true;
      }
    });
  }

  onAdminCommand(m, args) {
    return checkAuthentication(m.guild, m.author).then((authorized) => {
      if (!authorized) {
        return m.reply('You are unauthorized to use this command.');
      }
    });
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
