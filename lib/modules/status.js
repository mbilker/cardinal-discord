"use strict";

const os = require('os');
const util = require('util');

const Module = require('../core/api/module');

class BotStatus extends Module {
  constructor(container) {
    super(container);

    this.hears(/sysinfo/i, this.onSysinfo.bind(this));
    this.hears(/userinfo/i, this.onUserinfo.bind(this));
  }

  onSysinfo(m) {
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const mem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(3);

    return m.channel.sendMessage("", false, {
      color: 0xe2d324,
      title: 'Cardinal System Information',
      fields: [
        { name: 'CPU', value: `${cpus.length} x ${cpuModel}` },
        { name: 'Memory', value: `${mem} GB` },
        { name: 'Node.js Version', value: process.version }
      ]
    });
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
