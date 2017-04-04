"use strict";

const _secrets = new Map();

class Secrets {
  get(name) {
    return _secrets.get(name);
  }

  set(name, value) {
    return _secrets.set(name, value);
  }
}

module.exports = new Secrets();
