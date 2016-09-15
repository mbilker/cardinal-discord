"use strict";

const os = require('os');
const util = require('util');

const Module = require('../Core/API/Module');

class BotStatus extends Module {
  constructor(container) {
    super(container);

    this.hears(/sysinfo/i, this.onSysinfo.bind(this));
    this.hears(/userinfo/i, this.onUserinfo.bind(this));
  }

  onSysinfo(m) {
    const cpu = os.cpus()[0];
    const mem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(3);

    return m.channel.sendMessage(`\`\`\`php
Cardinal System Info:
CPU:    | ${cpu.model}
SPEED:  | ${cpu.speed / 1000} GHz
MEMORY: | ${mem} GB

Node.js Version: ${process.version}
\`\`\``);
  }

  onUserinfo(m) {
    const u = m.author;
    const g = m.guild;

    return m.channel.sendMessage(`\`\`\`
       ID: ${u.id} (disc: ${u.discriminator})
 USERNAME: ${u.username}
     GAME: ${u.game} (name: ${u.gameName})
 CREATION: ${u.createdAt}

    PERMS:
${JSON.stringify(u.permissionsFor(g), null, 2)}
\`\`\``);
  }
}

module.exports = BotStatus;
