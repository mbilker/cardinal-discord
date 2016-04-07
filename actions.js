const keyMirror = require('keymirror');

const Actions = keyMirror({
  DISCORD_READY: null,
  DISCORD_FOUND_CORRECT_SERVER: null,
  DISCORD_FOUND_TEXT_CHANNEL: null,
  DISCORD_FOUND_VOICE_CHANNEL: null,
  DISCORD_JOINED_VOICE_CHANNEL: null,

  START_MUSIC_PLAYBACK: null,
  ICY_CONNECTED: null,
  ICY_METADATA: null,

  SET_AUDIO_VOLUME: null,

  PAUSE_SONG: null,
  NEXT_SONG: null,
  PREVIOUS_SONG: null,
});

module.exports = Actions;
