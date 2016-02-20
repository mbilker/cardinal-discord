const _ = require('lodash');
const Discord = require('discord.js');
const icy = require('icy');
//const lame = require('lame');

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

const URL = 'http://172.16.21.4:8000';

const SERVER_NAME = 'Obsidian Bears ';
const TEXT_CHANNEL = 'general';
//const VOICE_CHANNEL = 'General Chat';
const VOICE_CHANNEL = 'Hubot\'s DJ Booth';
//const VOICE_CHANNEL = 'Minecraft Chat';

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

  const textChannelIndex = channelNames.indexOf(TEXT_CHANNEL);
  if (textChannelIndex === -1) {
    throw new Error('Cannot find text channel');
  }
  const textChannel = server.channels[textChannelIndex];

  const voiceChannelIndex = channelNames.indexOf(VOICE_CHANNEL);
  if (voiceChannelIndex === -1) {
    throw new Error('Cannot find voice channel');
  }
  const voiceChannel = server.channels[voiceChannelIndex];

  bot.joinVoiceChannel(voiceChannel).then(() => {
    console.log('joined voice chat');

    icy.get(URL, (res) => {
      console.error(res.headers);

      res.on('metadata', (meta) => {
        const parsed = icy.parse(meta);
        console.error(parsed);

        if (parsed && parsed.StreamTitle) {
          bot.sendMessage(textChannel, parsed.StreamTitle).then(() => console.log(`reported song status to ${TEXT_CHANNEL}`));
          bot.setPlayingGame(parsed.StreamTitle).then(() => console.log(`set status to song`));
        }
      });

      //bot.voiceConnection.playRawStream(res.pipe(new lame.Decoder()));
      bot.voiceConnection.playRawStream(res, { volume: 0.25 });
    });
    //bot.voiceConnection.playArbitraryFFmpeg(['-i', 'rtmp://mbilker.us/live/music']);
  });
}));

bot.login('services@mbilker.us', 'thisismyhubot').then(() => {
  console.log('logged in');
});
