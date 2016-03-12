'use strict';

const createOplog = require('mongo-oplog');
const Emitter = require('events').EventEmitter;
const assert = require('assert');

exports.tail = function createTail(config) {
  return new Tail(config);
};

function Tail(config) {
  this.config = Tail.validate(config);
  this.DB_RGX = new RegExp(`^${this.config.db}\.`);
  this.isWatchingAllCollections = Tail.isWatchingAllCollections(config);
  this.oplog = null;
  setImmediate(() => this._start());
}

Tail.prototype = Object.create(Emitter.prototype);

Tail.prototype._start = function _start() {
  const CONFIG = this.config;
  const COLS = this.cols = {};

  const oplog = this.oplog = createOplog(CONFIG.uri, {
    ns: `${CONFIG.db}.*`
  });

  oplog.tail((err) => {
    if (err) return; // handled by oplog.on('error')

    // now that we're connected, obtain collections for queries
    CONFIG.collections.forEach(function(name) {
      COLS[name] = oplog.db.db(CONFIG.db).collection(name);
    });

    this.emit('connected');
  });

  this.u = (data) => {
    if (!CONFIG.fullDoc) {
      const payload = new Payload(data);
      this.emit('change', payload);
      return;
    }

    // get full new db state for downstream
    const name = this.colname(data);
    COLS[name].findOne({ _id: data.o2._id }, (err, doc) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      const payload = new Payload(data, doc);
      this.emit('change', payload);
    });
  };

  oplog.on('op', (data) => {
    if (!this.isWatched(data)) return;

    if (data.op === 'u') return this.u(data);

    // generic events: insert, delete and collection actions like drop
    const payload = new Payload(data);
    this.emit('change', payload);
  });

  oplog.on('error', (err) => {
    this.emit('error', err);
  });

  /* istanbul ignore next */
  oplog.on('end', () => {
    this.emit('end');
  });
};

/**
 * @param {Function} [fn]
 * @api public
 * @return undefined
 */

Tail.prototype.destroy = function destry(fn) {
  if (this.oplog) this.oplog.destroy(fn);
};

Tail.prototype.colname = function colname(data) {
  return data.ns.replace(this.DB_RGX, '');
};

Tail.prototype.isWatched = function isWatched(data) {
  if (this.isWatchingAllCollections) return true;

  const colname = this.colname(data);
  let watched = this.config.collections.some((name) => name === colname);
  if (watched) return watched;

  // collection actions eg drop, create, etc?

  const cmdCollection = `${this.config.db}.$cmd`;
  if (data.ns !== cmdCollection) return false;

  let keys = Object.keys(data.o);
  return this.config.collections.some((name) => {
    return keys.some((key) => data.o[key] === name);
  });
};

Tail.validate = function validate(config) {
  assert(config, 'missing config');
  assert(config.uri, 'missing uri');
  assert(config.db, 'missing db');
  assert(config.collections, 'missing collections');
  if (typeof config.collections === 'string') {
    config.collections = config.collections.split(',');
  }
  assert(Array.isArray(config.collections), 'collections must be an Array');
  assert(config.collections.length > 0, 'must be at least 1 collection.');
  return config;
};

Tail.isWatchingAllCollections = function(config) {
  return config.collections.some((name) => name === '*');
};

function Payload(log, doc) {
  this.log = log;
  this.doc = doc;
}
