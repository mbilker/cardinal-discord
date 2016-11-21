"use strict";

const Redis = require('redis');

const promisify = require('../promisify');

class RedisBrain {
  constructor(url) {
    //if (!url) {
    //  throw new Error('Redis URL not provided');
    //}

    const client = Redis.createClient(url);

    client.on('error', (err) => {
      console.log('redis error:', err);
    });

    promisify(client, 'exists');
    promisify(client, 'set');
    promisify(client, 'get');
    promisify(client, 'rpush');
    promisify(client, 'lpop');

    return client;
  }
}

module.exports = RedisBrain;
