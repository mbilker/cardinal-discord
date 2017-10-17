"use strict";

const EventEmitter = require('events').EventEmitter;

const Redis = require('redis');

const promisify = require('../promisify');

class RedisBrain extends EventEmitter {
  constructor(url) {
    super();

    if (!url) {
      throw new Error('Redis URL not provided');
    }

    this._client = Redis.createClient(url, {
      retry_strategy: function retryConnection(options) {
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
      }
    });

    this._client.on('error', this.onError.bind(this));
    this._client.on('ready', this.onReady.bind(this));

    this.bindMethods();
  }

  stop() {
    this.quit();
  }

  onError(err) {
    console.error('Redis Error:', err);
  }

  onReady() {
    this.emit('ready');
  }

  bindMethods() {
    const promiseMethods = [
      'del',
      'set',
      'get',
      'hset',
      'rpush',
      'llen',
      'lpop',
      'lrange'
    ];
    const passthroughMethods = [
      'quit'
    ];

    for (const method of promiseMethods) {
      this[method] = promisify(this._client, method);
    }
    for (const method of passthroughMethods) {
      this[method] = this._client[method].bind(this._client);
    }
  }
}

module.exports = RedisBrain;
