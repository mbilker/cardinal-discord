"use strict";

const Redis = require('redis');

const promisify = require('../promisify');

class RedisBrain {
  constructor(url) {
    if (!url) {
      throw new Error('Redis URL not provided');
    }

    const client = Redis.createClient(url, {
      retry_strategy: function retryConnection(options) {
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      console.log('redis error:', err);
    });

    promisify(client, 'del');
    promisify(client, 'set');
    promisify(client, 'get');
    promisify(client, 'hset');
    promisify(client, 'rpush');
    promisify(client, 'lpop');

    return client;
  }
}

module.exports = RedisBrain;
