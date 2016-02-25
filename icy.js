const stream = require('stream');
const util = require('util');

const icy = require('icy');
const lame = require('lame');

const Actions = require('./actions');
const Dispatcher = require('./dispatcher');
const Settings = require('./settings');

const Discord = require('./bot');

const URL = 'http://172.16.21.4:8000';

Dispatcher.on(Actions.DISCORD_JOINED_VOICE_CHANNEL, () => {
  icy.get(URL, (res) => {
    console.error(res.headers);

    res.on('metadata', (meta) => {
      const parsed = icy.parse(meta);
      console.error(parsed);

      if (parsed && parsed.StreamTitle) {
        Discord.bot.sendMessage(Discord.textChannel, parsed.StreamTitle).then(() => console.log(`reported song status to ${Settings.TEXT_CHANNEL}`));
        Discord.bot.setPlayingGame(parsed.StreamTitle).then(() => console.log(`set status to song`));
      }

      Dispatcher.emit(Actions.ICY_METADATA, meta);
    });

    //bot.voiceConnection.playRawStream(res.pipe(new lame.Decoder()));
    //bot.voiceConnection.playRawStream(res, { volume: 0.25 });

    Dispatcher.emit(Actions.ICY_CONNECTED, res);
  });
});

Dispatcher.on(Actions.ICY_CONNECTED, (res) => {
  const stream = new ReduceVolumeStream();
  const output = res.pipe(stream);
  //const output = res;

  output.once('readable', () => {
    Discord.bot.voiceConnection.instream = res;
    Discord.bot.voiceConnection.playStream(output, 2);
  });

  output.on('error', (err) => {
    console.error(err);
    Discord.bot.voiceConnection.stopPlaying();
  });
});

function ReduceVolumeStream() {
  stream.Transform.call(this);
}
util.inherits(ReduceVolumeStream, stream.Transform);

ReduceVolumeStream.prototype._transform = function _transform(chunk, encoding, cb) {
  for (var i = 0; i < chunk.length; i++) {
    chunk[i] *= 0.25;
  }
  this.push(chunk);

  cb();
}
