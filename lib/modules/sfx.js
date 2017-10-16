"use strict";

const fs = require('fs');

const Module = require('../core/api/module');

class SFXPlayer extends Module {
  constructor(container) {
    super(container);

    this.sourceFile = '/music/winblows.opus';

    this.hears(/winblows/i, this.onSfxCommand.bind(this));
  }

  onSfxCommand(m) {
    const voiceChannel = m.author.getVoiceChannel(m.guild);

    if (!voiceChannel) {
      return m.reply('Could you please join a voice channel I can play to?');
    }

    voiceChannel.join(false, false).then((info) => {
      const oldEncoder = info.voiceConnection.getEncoder();

      if (oldEncoder) {
        oldEncoder.unpipe();
      }

      const source = fs.createReadStream(this.sourceFile);
      const encoder = info.voiceConnection.createExternalEncoder({
        type: 'OggOpusPlayer',
        source: source
      });

      if (!encoder) {
        return m.reply('Voice connection is disposed');
      }

      encoder.once('end', () => {
        this.logger.debug('stream end');
        if (oldEncoder) {
          oldEncoder.pipe(info.voiceConnection.getEncoderStream());
        } else {
          voiceChannel.leave();
        }
      });
      encoder.once('error', (err) => {
        this.logger.error('error playing Ogg SFX', err);
      });

      const encoderStream = encoder.play();
      encoderStream.once('unpipe', () => source.destroy());

      encoderStream.resetTimestamp();
    });
  }
}

module.exports = SFXPlayer;
