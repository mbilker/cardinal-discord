#!/usr/bin/node

const fs = require('fs');

const RedisBrain = require('./Core/Brain/Redis');

const redisBrain = new RedisBrain();

const guildId = process.argv[2];
const channelId = process.argv[3];
console.log(guildId);
console.log(channelId);

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

  output.write(`<!DOCTYPE html>
<html>
<head>
  <title>Channel Output for ${channelId}</title>
  <style>
table, td {
  border: 1px solid grey;
}
tr td:first-child {
  white-space: nowrap;
}
tr td {
  vertical-align: top;
  white-space: pre;
}
`);

  for (const id of Object.keys(avatars)) {
    output.write(`.avatar_${id} {
  content: url(${avatars[id]});
}
`);
  }

  output.write(`  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <td>timestamp</td>
        <td>author</td>
        <td>content</td>
      </tr>
    </thead>
    <tbody>
`);
  for (const message of messages) {
    output.write(`      <tr>
        <td>${message.timestamp}</td>
        <td>${message.author.username} ${message.author.id}
          <img class="avatar_${message.author.id}" />
        </td>
        <td>${message.content}</td>
      </tr>
`);
  }
  output.write(`    </tbody>
    </table>
  </body>
</html>`);
  output.end();
  redisBrain.quit();
  console.log(`written to ${filenameOut}`);
});
