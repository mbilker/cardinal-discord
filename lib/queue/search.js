"use strict";

const Client = require('elasticsearch').Client;

class LocalMusicSearch {
  constructor(container) {
    this.container = container;
    this.logger = this.container.get('logger');
    this.settings = this.container.get('settings');

    if (!this.settings.elasticsearch) {
      throw new Error('options.elasticsearch is null');
    }

    this.buildClient();
  }

  shutdown() {
  }

  buildClient() {
    const { host } = this.settings.elasticsearch;

    this.logger.info("Using Elasticsearch for local media library");

    this.client = new Client({
      host,
    });
  }

  byAnyField(text) {
    return this.client.search({
      q: text
    }).then((body) => {
      return body.hits.hits;
    }).then((hits) =>
      hits.map((hit) => {
        return Object.assign({}, hit._source, {
          score: hit._score
        });
      })
    ).then(res => {
      console.log(res);
      return res;
    });
  }
}

module.exports = LocalMusicSearch;
