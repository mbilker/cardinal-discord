"use strict";

const util = require('util');

const debug = require('debug')('cardinal:discord');
const Discordie = require('discordie');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const client = new Discordie();
const oath = require('./hubot_oath.json');

let guild = null;

// bot.on('debug', (msg) => {
//   debug(msg);
// });
function shutdownCb(err) {
  console.log(err && err.stack);

  try {
    bot.logout();
  } finally {
    return process.exit(1);
  }
}
Dispatcher.on('ctrlc', shutdownCb);

function start() {
  client.connect({
    token: oath.response.token
  });
}

client.Dispatcher.on(Discordie.Events.GATEWAY_READY, (e) => {
  debug(`Connected as: ${client.User.username}`);

  guild = client.Guilds.getBy('name', Settings.SERVER_NAME);

  if (guild) {
    debug('Found correct server!');
    Dispatcher.emit(Actions.DISCORD_FOUND_CORRECT_SERVER, guild);
  } else {
    debug('Guild not found!');
    shutdownCb();
  }
});

client.Dispatcher.on(Discordie.Events.DISCONNECTED, (e) => {
  const delay = 5000;
  const sdelay = Math.floor(delay / 100) / 10;

  if (e.error.message.indexOf('gateway') !== -1) {
    debug(`Disconnected from gw, resuming in ${sdelay} seconds`);
  } else {
    debug(`Failed to log in or get gateway, reconnecting in ${sdelay} seconds`);
  }
  setTimeout(start, delay);
});

const helpText = `This is *Cardinal*. A general purpose robot.

\`\`\`
Commands:
- ping|pong
  Simple ping and pong to see if bot is responding
- \`play
  Resume and play a song in the playlist.
- \`pause
  Pause the music until reenabling.
- \`next
  Play the next song in the playlist.
  If the song is the last song in the playlist, then Cardinal will wrap around to the beginning of the playlist.
- \`np
  Displays information about the currently playing song.
- \`li
  Displays 25 entries from current playlist from the current song.
\`\`\``;

client.Dispatcher.on(Discordie.Events.MESSAGE_CREATE, (e) => {
  if (!e.message.content) return;

  const m = e.message;
  const content = m.content;
  const c = content.toLowerCase();
  const args = content.split(' ').filter(x => x.length);

  if (c === 'ping' && m.author.id !== client.User.id) {
    e.message.channel.sendMessage('pong');
  } else if (c === 'pong' && m.author.id !== client.User.id) {
    e.message.channel.sendMessage('ping');
  } else if (c === '`help') {
    e.message.channel.sendMessage(helpText);
  } else if (c === '`userinfo') {
    e.message.channel.sendMessage(userInfo(e.message.author, e.message.guild));
  //} else if (c === '`summon') {
  //  Dispatcher.emit(Actions.START_MUSIC_PLAYBACK, e);
  //} else if (c === '`leave') {
  //  Dispatcher.emit(Actions.STOP_MUSIC_PLAYBACK, e);
  } else if (c === '`np') {
    Dispatcher.emit(Actions.QUEUE_DISPLAY_NOW_PLAYING, m);
  } else if (c === '`li') {
    Dispatcher.emit(Actions.QUEUE_DISPLAY_PLAYLIST, m);
  } else if (c === '`next') {
    Dispatcher.emit(Actions.QUEUE_SKIP, m);
  } else if (args[0].toLowerCase() === '`queue') {
    Dispatcher.emit(Actions.QUEUE_ITEM, m, args[1]);
  } else if (e.message.author.id === '142098955818369024' && args[0].toLowerCase() === '`eval') {
    executeJS(m, args);
  }
});

function userInfo(u, g) {
  return `\`\`\`
       ID: ${u.id} (disc: ${u.discriminator})
 USERNAME: ${u.username}
     GAME: ${u.game} (name: ${u.gameName})
 CREATION: ${u.createdAt}

    PERMS:
${JSON.stringify(u.permissionsFor(g), null, 2)}
\`\`\``;
};

function executeJS(m, args) {
  debug('EXECUTE_JS', args);

  const prefix = 'Result:\n```javascript\n';
  const suffix = '\n```';
  const noSpace = 'This response is too long. Shortening to ~2000 characters:\n```javascript';

  let res = null;
  const text = args.slice(1).join(' ');

  debug('EXECUTE_JS 2', text);

  try {
    res = eval(text);
    debug('EXECUTE_JS res', res);

    const inspect = util.inspect(res);
    let string = `${prefix}${inspect}${suffix}`;
    debug('EXECUTE_JS length', string.length);
    if (string.length > 2000) { // max length of message is 2000 characters
      const stringTwo = `${prefix}${inspect.substring(0, 2000 - prefix.length - suffix.length - 3)}...${suffix}`;
      m.channel.sendMessage(stringTwo);
    } else {
      m.channel.sendMessage(string);
    }
  } catch (err) {
    const errMsg = err && err.stack || 'no error message';
    m.channel.sendMessage('Something went wrong:\n```\n' + errMsg + '\n```');
  }
}

Dispatcher.on(Actions.DISCORD_FOUND_CORRECT_SERVER, () => {
  const textChannel = guild.textChannels.filter(c => c.name === Settings.TEXT_CHANNEL)[0];
  if (!textChannel) {
    Dispatcher.emit('error', new Error('Cannot find text channel'));
    return;
  }
  Dispatcher.emit(Actions.DISCORD_FOUND_TEXT_CHANNEL, textChannel);

  getVoiceChannel();
});

/*
Dispatcher.on(Actions.DISCORD_FOUND_VOICE_CHANNEL, (voiceChannel) => {
  voiceChannel.join(false, false).then((info, err) => {
    debug('joined voice chat');
    Dispatcher.emit(Actions.DISCORD_JOINED_VOICE_CHANNEL, info);
  });
});
*/

function getVoiceChannel() {
  const voiceChannel = guild.voiceChannels.filter(c => c.name === Settings.VOICE_CHANNEL)[0];
  if (!voiceChannel) {
    Dispatcher.emit('error', new Error('Cannot find voice channel'));
    return null;
  }
  Dispatcher.emit(Actions.DISCORD_FOUND_VOICE_CHANNEL, voiceChannel);

  return voiceChannel;
};

module.exports = {
  client,
  getVoiceChannel,
  start,
};
