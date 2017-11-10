"use strict";

const pg = require('pg');

const SqlQueries = require('./sql_queries');

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
    return this._client.connect().then(() => this.setup());
  }

  stop() {
    return this._client.end();
  }

  setup() {
    const tables = [
      'guilds',
      'guild_last_seen'
    ];

    const promises = tables.map((tableName) =>
      this._client.query(SqlQueries.CHECK_IF_TABLE_EXISTS, [tableName])
        .then(res => [tableName, res.rows[0].table_exists])
    );

    return Promise.all(promises).then((tablesArray) => {
      const missingTables = tablesArray.filter(x => !x[1]);
      console.log(missingTables);

      if (missingTables.length > 1) {
        throw new Error("Not all SQL tables exist");
      }
    });
  }

  addGuild(guild) {
    const { id, name, owner_id, icon, splash } = guild;

    return this._client.query(SqlQueries.INSERT_GUILD_DETAILS, [id, name, owner_id, icon, splash])
      .then(() => this.markGuildAsActive(id))
      .catch(err => {
        console.log(err);
        throw err;
      });
  }

  markGuildAsActive(guildId) {
    // PostgreSQL Timestamp is in seconds, while JavaScript's `Date.now()`
    // provides the epoch in milliseconds
    const currentTimestamp = Date.now() / 1000;

    return this._client.query(SqlQueries.UPDATE_GUILD_LAST_SEEN, [guildId, currentTimestamp]);
  }
}

module.exports = PostgresBrain;
