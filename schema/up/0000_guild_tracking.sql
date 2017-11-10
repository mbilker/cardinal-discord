CREATE TABLE guilds (
  id		TEXT PRIMARY KEY,
  name		TEXT NOT NULL,
  owner_id	TEXT NOT NULL,
  icon		TEXT,
  splash	TEXT
);

CREATE TABLE guild_last_seen (
  guild_id	TEXT REFERENCES guilds (id),
  last_seen	TIMESTAMP NOT NULL,

  UNIQUE (guild_id)
);
