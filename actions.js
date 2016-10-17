const keyMirror = require('keymirror');

const Actions = keyMirror({
  START_MUSIC_PLAYBACK: null,
  ICY_CONNECTED: null,
  ICY_METADATA: null,
});

module.exports = Actions;
