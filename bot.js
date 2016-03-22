const debug = require('debug')('hubot-discord');
const Discord = require('discord.js');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const bot = new Discord.Client();

bot.on('debug', (msg) => {
  debug(msg);
});
bot.on('error', (err) => {
  console.log(err && err.stack);

  try {
    bot.logout();
  } finally {
    return process.exit(1);
  }
});

//const SERVER_NAME = 'Obsidian Bears';
//const TEXT_CHANNEL = 'song-of-the-week';
//const TEXT_CHANNEL = 'hubot-songlist';
//const VOICE_CHANNEL = 'General Chat';
//const VOICE_CHANNEL = 'Hubot\'s DJ Booth';

bot.on('ready', () => setImmediate(() => Dispatcher.emit(Actions.DISCORD_READY, bot)));

Dispatcher.on(Actions.DISCORD_READY, (bot) => {
  const servers = bot.servers;
  const names = bot.servers.map(server => server.name);
  console.log(names);

  const serverIndex = names.indexOf(Settings.SERVER_NAME);
  if (serverIndex === -1) {
    throw new Error('Cannot find server');
  }
  const server = servers[serverIndex];

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

bot.login('services@mbilker.us', 'thisismyhubot').then(() => {
  console.log('logged in');
});

module.exports = {
  bot
};
