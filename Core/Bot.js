"use strict";

const os = require('os');
const util = require('util');

const Discordie = require('discordie');

const Settings = require('../settings');

const oath = require('../hubot_oath.json');

class Bot {
  constructor(container) {
    this.container = container;
    this.commandManager = container.get('commandManager');
    this.logger = container.get('logger');

    this.client = new Discordie();
    this.primaryGuild = null;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.Dispatcher.on(Discordie.Events.GATEWAY_READY, this.onGatewayReady.bind(this));
    this.client.Dispatcher.on(Discordie.Events.VOICE_DISCONNECTED, this.onVoiceDisconnected.bind(this));
    this.client.Dispatcher.on(Discordie.Events.DISCONNECTED, this.onDisconnect.bind(this));
    this.client.Dispatcher.on(Discordie.Events.MESSAGE_CREATE, this.onMessageCreate.bind(this));
  }

  start() {
    this.client.connect({
      token: oath.response.token
    });
  }

  reconnect(channel) {
    const channelName = channel.name;

    // this example will stop reconnecting after 1 attempt
    // you can continue trying to reconnect

    // TODO: implement this.onConnected
    //  .then(info => this.onConnected(info))
    channel.join()
      .catch(err => this.logger.warn(`Failed to connect to ${channelName}`));
  }

  onGatewayReady(e) {
    this.logger.info(`Connected as: ${this.client.User.username}`);

    this.primaryGuild = this.client.Guilds.getBy('id', oath.mainGuildId);

    if (this.primaryGuild) {
      this.logger.info('Found correct server!');
    } else {
      this.logger.warn('Guild not found!');
    }
  }

  onVoiceDisconnected(e) {
    this.logger.info('Disconnected from voice server', e.error);

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
        setTimeout(() => this.reconnect(channel), 5000);
      });
      return;
    }

    // normal disconnect
    if (!e.manual) {
      setTimeout(() => this.reconnect(channel), 5000);
    }
  }

  onDisconnect(e) {
    const delay = 5000;
    const sdelay = Math.floor(delay / 100) / 10;

    // This shouldn't happen according to Discordie docs, but just to make sure
    if (this.container.get('shutdownMode')) {
      this.logger.info(`Disconnected from gw, not reconnecting because of shutdown mode`);
      return;
    }

    if (e.error.message.indexOf('gateway') !== -1) {
      this.logger.info(`Disconnected from gw, resuming in ${sdelay} seconds`);
    } else {
      this.logger.warn(`Failed to log in or get gateway, reconnecting in ${sdelay} seconds`);
    }

    setTimeout(this.start.bind(this), delay);
  }

  onCommandError(m, err) {
    this.logger.error(`Error processing command: ${err && err.stack}`);
    m.reply(`Oops. An error occurred handling that command.\n\`\`\`${err.stack}\`\`\``);
  }

  onMessageCreate(e) {
    if (!e.message.content) return;

    //const m = e.message;
    //const c = m.content.toLowerCase();

    //if (c === 'ping' && m.author.id !== this.client.User.id) {
    //  e.message.channel.sendMessage('pong');
    //} else if (c === 'pong' && m.author.id !== this.client.User.id) {
    //  e.message.channel.sendMessage('ping');
    //} else if (c === '`help') {
    //  e.message.channel.sendMessage(helpText);
    //} else if (c === '`sys' || c === '`sysinfo') {
    //  Dispatcher.emit(Actions.STATUS_SYS_INFO, m);
    //} else if (c === '`user' || c === '`userinfo') {
    //  Dispatcher.emit(Actions.STATUS_USER_INFO, m);
    //} else if (c === '`summon') {
    //  Dispatcher.emit(Actions.START_MUSIC_PLAYBACK, e);
    //} else if (c === '`leave') {
    //  Dispatcher.emit(Actions.STOP_MUSIC_PLAYBACK, e);
    //}

    this.commandManager.handle(e.message, (err) => this.onCommandError(e.message, err));
  }
}

// bot.on('debug', (msg) => {
//   debug(msg);
// });
//function shutdownCb(err) {
//  console.log(err && err.stack);
//
//  try {
//    bot.logout();
//  } finally {
//    return process.exit(1);
//  }
//}
//Dispatcher.on('ctrlc', shutdownCb);

const helpText = `This is *Cardinal*. A general purpose robot.

\`\`\`
Commands:
- ping|pong
  Simple ping and pong to see if bot is responding
\`\`\``;

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

module.exports = function createBot(container) {
  return new Bot(container);
};
