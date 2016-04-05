const debug = require('debug')('hubot-discord');
const Discord = require('discord.js');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const bot = new Discord.Client();

const oath = require('./hubot_oath.json');

bot.on('debug', (msg) => {
  debug(msg);
});
function shutdownCb(err) {
  console.log(err && err.stack);

  try {
    bot.logout();
  } finally {
    return process.exit(1);
  }
}
bot.on('error', shutdownCb);
Dispatcher.on('ctrlc', shutdownCb);

//bot.on('ready', () => setImmediate(() => Dispatcher.emit(Actions.DISCORD_READY, bot)));
bot.on('ready', () => console.log('bot ready'));

bot.on('serverCreated', (server) => {
  const name = server.name;

  if (name === Settings.SERVER_NAME) {
    console.log('Found correct server!');
    Dispatcher.emit(Actions.DISCORD_FOUND_CORRECT_SERVER, server);
  }
});

Dispatcher.on(Actions.DISCORD_FOUND_CORRECT_SERVER, (server) => {
  const channelNames = server.channels.map(channel => channel.name);
  console.log(channelNames);

  const textChannelIndex = channelNames.indexOf(Settings.TEXT_CHANNEL);
  if (textChannelIndex === -1) {
    Dispatcher.emit('error', new Error('Cannot find text channel'));
  }
  const textChannel = server.channels[textChannelIndex];
  Dispatcher.emit(Actions.DISCORD_FOUND_TEXT_CHANNEL, textChannel);

  const voiceChannelIndex = channelNames.indexOf(Settings.VOICE_CHANNEL);
  if (voiceChannelIndex === -1) {
    Dispatcher.emit('error', new Error('Cannot find voice channel'));
  }
  const voiceChannel = server.channels[voiceChannelIndex];
  Dispatcher.emit(Actions.DISCORD_FOUND_VOICE_CHANNEL, voiceChannel);
});

Dispatcher.on(Actions.DISCORD_FOUND_VOICE_CHANNEL, (voiceChannel) => {
  bot.joinVoiceChannel(voiceChannel).then(() => {
    debug('joined voice chat');
    Dispatcher.emit(Actions.DISCORD_JOINED_VOICE_CHANNEL);
  });
});

bot.loginWithToken(oath.response.token).then(() => {
  console.log('logged in');
});

module.exports = {
  bot
};
