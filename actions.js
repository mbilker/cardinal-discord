const keyMirror = require('keymirror');

const Actions = keyMirror({
  DISCORD_READY: null,
  DISCORD_FOUND_CORRECT_SERVER: null,
  DISCORD_FOUND_VOICE_CHANNEL: null,
  DISCORD_JOINED_VOICE_CHANNEL: null,

  START_MUSIC_PLAYBACK: null,
  ICY_CONNECTED: null,
  ICY_METADATA: null,

  STATUS_SYS_INFO: null,
  STATUS_USER_INFO: null,
});

module.exports = Actions;
