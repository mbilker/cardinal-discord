"use strict";

const pg = require('pg');

class PostgresBrain {
  constructor(options) {
    this.options = options;

    this._client = new pg.Client({
      host: this.options.host,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
      port: this.options.port || 5432,
    });
  }

  connect() {
    return this._client.connect();
  }

  stop() {
    return this._client.end();
  }
}

module.exports = PostgresBrain;
