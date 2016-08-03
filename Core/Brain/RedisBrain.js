"use strict";

const Redis = require('redis');

class RedisBrain {
  constructor(url) {
    if (!url) {
      throw new Error('Redis URL not provided');
    }

    const client = Redis.createClient(url);

    client.on('error', (err) => {
      console.log('redis error:', err);
    });

    return client;
  }
}

module.exports = RedisBrain;
