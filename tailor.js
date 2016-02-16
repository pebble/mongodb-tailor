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

  oplog.on('insert', (data) => {
    if (!this.isWatched(data)) return;

    // we receive the full doc on inserts. no lookup required
    const payload = new Payload('insert', data.ns, data.ts, data.o);
    this.emit('change', payload);
  });

  oplog.on('update', (data) => {
    if (!this.isWatched(data)) return;

    if (!CONFIG.fullDoc) {
      const payload = new Payload('update', data.ns, data.ts, new Update(data.o));
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

      const update = new Update(data.o, doc);
      const payload = new Payload('update', data.ns, data.ts, update);
      this.emit('change', payload);
    });
  });

  oplog.on('delete', (data) => {
    if (!this.isWatched(data)) return;

    // nothing to query, its been removed
    const payload = new Payload('delete', data.ns, data.ts, data.o);
    this.emit('change', payload);
  });

  oplog.on('error', (err) => {
    this.emit('error', err);
  });

  /*istanbul ignore next*/
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
  const colname = this.colname(data);
  return this.config.collections.some((name) => name === colname);
};

Tail.validate = function validate(config) {
  assert(config, 'missing config');
  assert(config.uri, 'missing uri');
  assert(config.db, 'missing db');
  assert(config.collections, 'missing collections');
  assert(Array.isArray(config.collections), 'collections must be an Array');
  assert(config.collections.length > 0, 'must be at least 1 collection.');
  return config;
};

/* eslint-disable max-params */
function Payload(type, ns, ts, data) {
  this.ts = ts;
  this.ns = ns;
  this.type = type;
  this.data = data;
}

function Update(o, doc) {
  this.o = o;
  this.doc = doc;
}
