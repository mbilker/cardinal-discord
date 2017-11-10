"use strict";

const CHECK_IF_TABLE_EXISTS = 'SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = $1::text) AS table_exists';

const INSERT_GUILD_DETAILS = `
INSERT INTO guilds (id, name, owner_id, icon, splash)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
  SET name = excluded.name,
      owner_id = excluded.owner_id,
      icon = excluded.icon,
      splash = excluded.splash;
`;

const UPDATE_GUILD_LAST_SEEN = `
INSERT INTO guild_last_seen (guild_id, last_seen)
VALUES ($1, to_timestamp($2))
ON CONFLICT (guild_id) DO UPDATE
  SET last_seen = excluded.last_seen
`;

module.exports = {
  CHECK_IF_TABLE_EXISTS,
  INSERT_GUILD_DETAILS,
  UPDATE_GUILD_LAST_SEEN,
};
