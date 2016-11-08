#!/usr/bin/node

const fs = require('fs');

const RedisBrain = require('./Core/Brain/Redis');

const redisBrain = new RedisBrain();

const guildId = process.argv[2];
const channelId = process.argv[3];
console.log(guildId);
console.log(channelId);

const HEADER =
`<!DOCTYPE html>
<html>
<head>
  <title>Channel Output for ${channelId}</title>
  <link rel="stylesheet" href="02ed0b0996f3bfe922db.css">
  <style>
    body {
      overflow: visible;
    }
    .message h2 strong {
      color: rgb(255, 255, 255);
    }
`;

const STYLE_CLOSER =
`  </style>
</head>
<body>
  <div class="app theme-dark">
    <div class="chat">
      <div class="scroller messages">
`;

const FOOTER =
`       </div>
      </div>
    </div>
  </body>
</html>`;

function avatarStyleDeclaration(id, avatar) {
  return `.avatar_${id} {
  content: url(${avatar});
}
`;
}

function messageBody(message) {
  return `        <div class="message-group">
          <div class="avatar-large animate avatar_${message.author.id}"></div>
          <div class="comment">
            <div class="message">
              <div class="body">
                <h2>
                  <span class="username-wrapper">
                    <strong>${message.author.username}</strong>
                  </span>
                  <span class="highlight-separator"> - </span>
                  <span class="timestamp">${message.timestamp}</span>
                </h2>
                <div class="message-text">
                  <div class="markup">${message.content}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
`;
}

redisBrain.get(`cardinal.${guildId}.channelbackup.${channelId}`, (err, text) => {
  if (err) {
    console.error('failed to retrieve messages');
    console.error(err);
    redisBrain.quit();
    return;
  }

  const { avatars, messages } = JSON.parse(text);
  const filenameOut = `channel_backup_${channelId}.html`;
  const output = fs.createWriteStream(filenameOut);

  output.write(HEADER);

  for (const id of Object.keys(avatars)) {
    output.write(avatarStyleDeclaration(id, avatars[id]));
  }

  output.write(STYLE_CLOSER);

  for (const message of messages) {
    output.write(messageBody(message));
  }

  output.write(FOOTER);

  output.end();
  redisBrain.quit();
  console.log(`written to ${filenameOut}`);
});
