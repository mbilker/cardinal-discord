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

  NOW_PLAYING_SONG: null,
  NEXT_SONG: null,
  PREVIOUS_SONG: null,
  PAUSE_SONG: null,
  RESUME_SONG: null,
  PLAY_PLAYLIST_POSITION: null,
  DISPLAY_PLAYLIST: null,

  QUEUE_DISPLAY_NOW_PLAYING: null,
  QUEUE_DISPLAY_PLAYLIST: null,
  QUEUE_ITEM: null,
  QUEUE_SKIP: null,
  QUEUE_DONE_ITEM: null,
});

module.exports = Actions;
