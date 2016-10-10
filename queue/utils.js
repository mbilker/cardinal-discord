"use strict";

const google = require('googleapis');
const ytdl = require('ytdl-core');

const youtube = google.youtube('v3');

const apiKey = require('../google_api.json').apiKey;

function sortFormats(a, b) {
  // anything towards the beginning of the array is -1, 1 to move it to the end
  if (a.audioEncoding === 'opus' && b.audioEncoding !== 'opus') {
    return -1;
  } else if (a.audioEncoding !== 'opus' && b.audioEncoding === 'opus') {
    return 1;
  }

  if (a.audioEncoding === 'vorbis' && b.audioEncoding !== 'vorbis') {
    return -1;
  } else if (a.audioEncoding !== 'vorbis' && b.audioEncoding === 'vorbis') {
    return 1;
  }

  if (a.audioBitrate < b.audioBitrate) {
    return 1;
  } else if (a.audioBitrate > b.audioBitrate) {
    return -1;
  }

  return 0;
};

function formatTime(seconds) {
  function zeroPad(n) {
    return n < 10 ? '0' + n : n;
  };
  return Math.floor(seconds / 60) + ':' + zeroPad(seconds % 60);
};

function fetchYoutubeInfo(url) {
  return new Promise((resolve, reject) => {
    ytdl.getInfo(url, { filter: 'audioonly' }, (err, info) => {
      if (err) {
        reject(err);
        return;
      }

      const formats = info.formats
        .filter(x => x.audioEncoding)
        .sort(sortFormats)
        .map(x => ({
          container: x.container,
          url: x.url,
          audioEncoding: x.audioEncoding,
          audioBitrate: x.audioBitrate,
        }));

      resolve([info, formats]);
    });
  });
};

function searchYoutube(searchString) {
  return new Promise((resolve, reject) => {
    youtube.search.list({ key: apiKey, part: 'snippet', q: searchString, maxResults: 10 }, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

module.exports = {
  sortFormats,
  formatTime,
  fetchYoutubeInfo,
  searchYoutube,
};
