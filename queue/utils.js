"use strict";

const http = require('http');
const querystring = require('querystring');

const google = require('googleapis');

const Types = require('./types');

const youtube = google.youtube('v3');

const apiKey = require('../google_api.json').apiKey;

const YOUTUBE_DL_SERVICE_HOSTNAME = process.env.YOUTUBE_DL_SERVICE_HOSTNAME || 'localhost';
const YOUTUBE_DL_SERVICE_PORT = process.env.YOUTUBE_DL_SERVICE_PORT || '5000';

class Utils {
  constructor(container) {
    this.container = container;
  }

  zeroPad(n) {
    return n < 10 ? '0' + n : n;
  }

  formatTime(seconds) {
    return Math.floor(seconds / 60) + ':' + this.zeroPad(seconds % 60);
  }

  fetchYoutubeInfo(url) {
    return new Promise((resolve, reject) => {
      const urlPath = querystring.escape(`/download?v=${url}`);
      const req = http.request({
        method: 'GET',
        hostname: YOUTUBE_DL_SERVICE_HOSTNAME,
        port: YOUTUBE_DL_SERVICE_PORT,
        path: urlPath,
      }, (res) => {
        const buffers = [];

        res.on('error', (err) => {
          reject(err);
        });
        res.on('data', (chunk) => {
          buffers.push(chunk);
        });
        res.on('end', () => {
          const buf = Buffer.concat(buffers);
          if (res.statusCode === 200) {
            const obj = JSON.parse(buf);
            resolve(obj);
          } else {
            reject(`Failed request: ${buf}`);
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

  searchYoutube(searchString) {
    return new Promise((resolve, reject) => {
      youtube.search.list({ key: apiKey, part: 'snippet', q: searchString, maxResults: 10 }, (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      });
    });
  }

  formatInfo(self) {
    const time = self.time ? `${this.formatTime(self.time | 0)}/` : '';
    const title = self.title ? `**${self.title}**` : '';

    const owner = this.container.get('bot').client ? (
      this.container.get('bot').client.Users.get(self.ownerId).username
    ) : self.ownerId;

    if (self.type === Types.YTDL) {
      const length = this.formatTime(parseInt(self.duration));

      return `(${time}${length}) \`[${self.encoding}]\` ${title} (${self.id}) (${owner})`;
    }
    return `NON-YTDL \`[${self.encoding}]\` ${title} - ${self.url} (${owner})`;
  }
}

module.exports = Utils;
