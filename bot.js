"use strict";

const os = require('os');
const util = require('util');

const debug = require('debug')('cardinal:discord');
const Discordie = require('discordie');

const CommandManager = require('./Core/CommandManager');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const client = new Discordie();
const oath = require('./hubot_oath.json');

let guild = null;

CommandManager.setPrefix('`');

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

function reconnect(channel) {
  var channelName = channel.name;
  channel.join()
  .then(info => onConnected(info))
  .catch(err => console.log("Failed to connect to " + channelName));
  // this example will stop reconnecting after 1 attempt
  // you can continue trying to reconnect
}

client.Dispatcher.on(Discordie.Events.VOICE_DISCONNECTED, (e) => {
  debug('Disconnected from voice server', e.error);

  if (e.endpointAwait) {
    // handle reconnect instantly if it's a server-switch disconnect
    // transparently creates same promise as `oldChannel.join()`
    // see the `reconnect` function below

    // Note: During Discord outages it will act like the official client
    //       and wait for an endpoint. Sometimes this can take a very
    //       long time. To cancel pending reconnect just call leave on
    //       the voice channel. Pending promise will reject with
    //       `Error` message "Cancelled".


    e.endpointAwait.catch((err) => {
      // server switching failed, do a regular backoff
      setTimeout(() => reconnect(channel), 5000);
    });
    return;
  }

  // normal disconnect
  if (!e.manual) {
    setTimeout(() => reconnect(channel), 5000);
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
  } else if (c === '`sys' || c === '`sysinfo') {
    Dispatcher.emit(Actions.STATUS_SYS_INFO, m);
  } else if (c === '`user' || c === '`userinfo') {
    Dispatcher.emit(Actions.STATUS_USER_INFO, m);
  } else if (c === '`nicehash') {
    Dispatcher.emit(Actions.NICEHASH_DISPLAY, m);
  //} else if (c === '`summon') {
  //  Dispatcher.emit(Actions.START_MUSIC_PLAYBACK, e);
  //} else if (c === '`leave') {
  //  Dispatcher.emit(Actions.STOP_MUSIC_PLAYBACK, e);
  } else if (e.message.author.id === '142098955818369024' && c === '`next') {
    Dispatcher.emit(Actions.QUEUE_SKIP, m);
  } else if (args[0].toLowerCase() === '`queue') {
    Dispatcher.emit(Actions.QUEUE_ITEM, m, args.slice(1).join(' '));
  } else if (e.message.author.id === '142098955818369024' && args[0].toLowerCase() === '`eval') {
    executeJS(m, args);
  }
  //console.log(e && e.stack);
  //e.message.channel.sendMessage(`Oops. An error occurred handling that command.\n\`\`\`${e.stack}\`\`\``);

  CommandManager.handle(m);
});

/*
client.Dispatcher.onAny((type, args) => {
  console.log("\nevent "+type);

  if (args.type == "READY" || args.type == "READY" ||
      type == "GATEWAY_READY" || type == "ANY_GATEWAY_READY" ||
      type == "GATEWAY_DISPATCH") {
    return console.log("e " + (args.type || type));
  }

  console.log("args " + JSON.stringify(args));
});
*/

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

module.exports = {
  client,
  start,
};
