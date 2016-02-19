const _ = require('lodash');
const Discord = require('discord.js');

const bot = new Discord.Client();

bot.on('debug', console.log.bind(console, 'debug:'));
bot.on('error', (err) => {
  console.log(err && err.stack);

  try {
    bot.logout();
  } finally {
    return process.exit(1);
  }
});

const SERVER_NAME = 'Obsidian Bears ';
const TEXT_CHANNEL = 'general';
const VOICE_CHANNEL = 'General Chat';
//const VOICE_CHANNEL = 'Hubot\'s DJ Booth';

bot.on('ready', () => setImmediate(() => {
  const servers = bot.servers;
  const names = bot.servers.map(server => server.name);
  console.log(names);

  const serverIndex = names.indexOf(SERVER_NAME);
  if (serverIndex === -1) {
    throw new Error('Cannot find server');
  }
  const server = servers[serverIndex];

  const channelNames = server.channels.map(channel => channel.name);
  console.log(channelNames);

  const voiceChannelIndex = channelNames.indexOf(VOICE_CHANNEL);
  if (voiceChannelIndex === -1) {
    throw new Error('Cannot find voice channel');
  }
  const voiceChannel = server.channels[voiceChannelIndex];
  console.log(voiceChannel);

  bot.joinVoiceChannel(voiceChannel).then(() => {
    console.log('joined voice chat');

    //bot.voiceConnection.playFile();
    bot.voiceConnection.playArbitraryFFmpeg(['-i', 'rtmp://mbilker.us/live/music']);
  });
}));

bot.login('services@mbilker.us', 'thisismyhubot').then(() => {
  console.log('logged in');
});
