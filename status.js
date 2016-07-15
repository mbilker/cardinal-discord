"use strict";

const os = require('os');
const util = require('util');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');

class BotStatus {
  constructor() {
    Dispatcher.on(Actions.STATUS_SYS_INFO, this.sysInfo.bind(this));
    Dispatcher.on(Actions.STATUS_USER_INFO, this.userInfo.bind(this));
  }

  sysInfo(m) {
    const cpu = os.cpus()[0];
    const mem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(3);

    m.channel.sendMessage(`\`\`\`php
Cardinal System Info:
CPU:    | ${cpu.model}
SPEED:  | ${cpu.speed / 1000} GHz
MEMORY: | ${mem} GB
\`\`\``);
  }

  userInfo(m) {
    const u = m.author;
    const g = m.guild;

    m.channel.sendMessage(`\`\`\`
       ID: ${u.id} (disc: ${u.discriminator})
 USERNAME: ${u.username}
     GAME: ${u.game} (name: ${u.gameName})
 CREATION: ${u.createdAt}

    PERMS:
${JSON.stringify(u.permissionsFor(g), null, 2)}
\`\`\``);
  }
}

module.exports = new BotStatus();
