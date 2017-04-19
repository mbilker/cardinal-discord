"use strict";

const https = require('https');
const url = require('url');

const Module = require('../Core/API/Module');

class Nicehash extends Module {
  constructor(container) {
    super(container);

    this.nicehashAddress = container.get('settings').nicehashAddress;

    this.hears(/nice/i, this.display.bind(this));
  }

  fetchApi() {
    return new Promise((resolve, reject) => {
      const reqUrl = `https://www.nicehash.com/api?method=stats.provider&location=1&addr=${this.nicehashAddress}`;
      const parsed = url.parse(reqUrl);
      const req = https.get(parsed);

      const chunks = [];

      req.on('error', (err) => {
        reject(err);
      });

      req.on('response', (res) => {
        this.logger.debug(`have response: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          reject(new Error(`Status code ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          resolve(buf);
        });
      });
    });
  }

  display(m) {
    this.logger.debug('NICEHASH_DISPLAY');

    return this.fetchApi().then((buf) => {
      const text = buf.toString();
      let data = null;

      try {
        data = JSON.parse(text);
      } catch (e) {
        this.logger.debug('error decoding json', e);
        m.reply('There was an error decoding the JSON payload');
        return;
      }

      if (!data.result.stats.length) {
        m.reply(`No data found for ${this.nicehashAddress}`);
        return;
      }

      const stats = data.result.stats;
      const speed = stats.reduce(((total, stats) => total + parseFloat(stats.accepted_speed) * 1000), 0);
      const balance = stats.reduce(((total, stats) => total + parseFloat(stats.balance)), 0);

      m.channel.sendMessage(`:pick: ${this.nicehashAddress}
:zap: ${speed} MH/s
:moneybag: ${balance} BTC`);
      for (let i = 0; i <= 2; i++) {
        const payment = data.result.payments[i];
        if (!payment) continue;

        m.channel.sendMessage(`${i} _${payment.time}_\t :id: ${payment.TXID.slice(0, 10)}\t :money_with_wings: ${payment.amount}\t :arrow_down: ${payment.fee}`);
      }
    });
  }
}

module.exports = Nicehash;
