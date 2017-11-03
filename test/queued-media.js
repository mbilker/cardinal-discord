const chai = require('chai');
const spies = require('chai-spies');

chai.use(spies);

const expect = chai.expect;

const QueuedMedia = require('../lib/queue/queued-media');
const Types = require('../lib/queue/types');

const ytdlRecord = Object.freeze({
  type: Types.YTDL,
});

const localRecord = Object.freeze({
  type: Types.LOCAL,
});

const unknownRecord = Object.freeze({
  type: 'BARFJA',
});

describe('QueuedMedia', function() {
  describe('.constructor(_, record)', function() {
    it('acceps Types.YTDL', function() {
      expect(function() { new QueuedMedia(null, ytdlRecord) }).to.not.throw();
    });

    it('accepts Types.LOCAL', function() {
      expect(function() { new QueuedMedia(null, localRecord) }).to.not.throw();
    });

    it('does not accept empty record', function() {
      expect(function() { new QueuedMedia(null, {}) }).to.throw();
    });

    it('does not accept unknown type', function() {
      expect(function() { new QueuedMedia(null, unknownRecord) }).to.throw();
    });
  });

  describe('#play(_)', function() {
    const songRecord = {
      id: 'asdf1234',
      title: 'This is a test.',
      url: 'https://localhost/test.wav',
      duration: 12341337,
    };
    const fakeVoiceConnection = {};

    it('calls #playHTTPS(_) for Types.YTDL', function() {
      const record = Object.assign({}, songRecord, { type: Types.YTDL });
      const queuedMedia = new QueuedMedia(null, record);

      const spy = chai.spy();
      queuedMedia.playHTTPS = spy;

      queuedMedia.play(fakeVoiceConnection);

      expect(spy).to.have.been.called.with.exactly(fakeVoiceConnection);
    });

    it('calls #playLocal(_) for Types.LOCAL', function() {
      const record = Object.assign({}, songRecord, { type: Types.LOCAL });
      const queuedMedia = new QueuedMedia(null, record);

      const spy = chai.spy();
      queuedMedia.playLocal = spy;

      queuedMedia.play(fakeVoiceConnection);

      expect(spy).to.have.been.called.with.exactly(fakeVoiceConnection);
    });
  });

});
