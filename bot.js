const debug = require('debug')('hubot-discord');
const Discordie = require('discordie');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const client = new Discordie();
const oath = require('./hubot_oath.json');

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
// bot.on('error', shutdownCb);
Dispatcher.on('ctrlc', shutdownCb);

client.Dispatcher.on(Discordie.Events.GATEWAY_READY, (e) => {
  console.log(`Connected as: ${client.User.username}`);

  const guild = client.Guilds.getBy('name', Settings.SERVER_NAME);

  if (guild) {
    console.log('Found correct server!');
    Dispatcher.emit(Actions.DISCORD_FOUND_CORRECT_SERVER, guild);
  }
});

client.Dispatcher.on(Discordie.Events.DISCONNECTED, (e) => {
  const delay = 5000;
  const sdelay = Math.floor(delay / 100) / 10;

  if (e.error.message.indexOf('gateway') !== -1) {
    console.log(`Disconnected from gw, resuming in ${sdelay} seconds`);
  } else {
    console.log(`Failed to log in or get gateway, reconnecting in ${sdelay} seconds`);
  }
  setTimeout(connect, delay);
});

client.Dispatcher.on(Discordie.Events.MESSAGE_CREATE, (e) => {
  if (e.message.content === 'ping') {
    e.message.channel.sendMessage('pong');
  }
});

Dispatcher.on(Actions.DISCORD_FOUND_CORRECT_SERVER, (guild) => {
  const textChannel = guild.textChannels.filter(c => c.name === Settings.TEXT_CHANNEL)[0];
  if (!textChannel) {
    Dispatcher.emit('error', new Error('Cannot find text channel'));
    return;
  }
  Dispatcher.emit(Actions.DISCORD_FOUND_TEXT_CHANNEL, textChannel);

  const voiceChannel = guild.voiceChannels.filter(c => c.name === Settings.VOICE_CHANNEL)[0];
  if (!voiceChannel) {
    Dispatcher.emit('error', new Error('Cannot find voice channel'));
    return;
  }
  Dispatcher.emit(Actions.DISCORD_FOUND_VOICE_CHANNEL, voiceChannel);
});

Dispatcher.on(Actions.DISCORD_FOUND_VOICE_CHANNEL, (voiceChannel) => {
  voiceChannel.join(false, false).then((info, err) => {
    debug('joined voice chat');
    Dispatcher.emit(Actions.DISCORD_JOINED_VOICE_CHANNEL, info);
  });
});

client.connect({
  token: oath.response.token
});

module.exports = {
  client
};
