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
    const osRelease = os.release();

    return m.channel.sendMessage("", false, {
      color: 0xe2d324,
      title: 'Cardinal System Information',
      fields: [
        { name: 'CPU', value: `${cpus.length} x ${cpuModel}` },
        { name: 'Memory', value: `${mem} GB` },
        { name: 'System Release', value: osRelease },
        { name: 'Node.js Version', value: process.version }
      ]
    });
  }

  onUserinfo(m) {
    const u = m.author;
    const g = m.guild;

    const fields = [
      { name: 'ID', value: `\`${u.id}\` (disc: \`${u.discriminator}\`)` },
      { name: 'Username', value: u.username }
    ];

    if (u.game) {
      fields.push({ name: 'Game', value: `${u.game} (name: ${u.gameName})` });
    }

    return m.channel.sendMessage("", false, {
      color: 0xe2d324,
      title: 'User Info',
      fields: fields
    });

    //${JSON.stringify(u.permissionsFor(g), null, 2)}
  }
}

module.exports = BotStatus;
