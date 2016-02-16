'use strict';

const tailor = require('../');
const assert = require('assert');
const mongo = require('mongodb').MongoClient;

const URI = process.env.MONGO_TEST_URI;
assert(URI, 'missing MONGO_TEST_URI');

const DB = 'test_mongo_tailor';
const COL = 'testing';

describe('tailor', function() {
  let db;
  let col;
  let col2;

  before(function(done) {
    mongo.connect(URI, function(err, _db) {
      if (err) return done(err);
      db = _db.db(DB);
      col = db.collection(COL);
      col2 = db.collection('nada');
      col.remove({}, () => {
        col2.remove({}, done);
      });
    });
  });

  after(function(done) {
    col.remove({}, () => {
      db.close(done);
    });
  });

  it('exports a tail() function', function(done) {
    assert.equal(typeof tailor.tail, 'function', 'tail is not a function');
    done();
  });

  describe('configuration', function() {
    it('is required', function(done) {
      assert.throws(function() {
        tailor.tail();
      });
      done();
    });

    it('requires uri', function(done) {
      assert.throws(function() {
        tailor.tail({ });
      });
      done();
    });

    it('requires db', function(done) {
      assert.throws(function() {
        tailor.tail({ uri: URI });
      });
      done();
    });

    it('requires collections array with at least one collection', function(done) {
      assert.throws(function() {
        tailor.tail({ uri: URI, db: DB });
      });

      assert.throws(function() {
        tailor.tail({ uri: URI, db: DB, collections: [] });
      });

      assert.doesNotThrow(function() {
        tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL]
        });
      });

      done();
    });
  });

  describe('emits', function() {
    it('`connected` event when connected to db', function(done) {
      let o = tailor.tail({
        uri: URI,
        db: DB,
        collections: [COL]
      });
      o.once('connected', done);
    });

    function assertValidSchema(change) {
      assert(change, 'missing change object');
      assert(change.ts, 'missing change.ts');
      assert(change.ns, 'missing change.ns');
      assert(change.type, 'missing change.type');
      assert(change.data, 'missing change.data');
    }

    describe('`change` when a document is', function() {
      it('removed', function(done) {
        let o = tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL]
        });

        o.once('error', done);
        o.once('connected', () => {
          let _id = `removed-${Math.random()}`;
          col.insertOne({ _id: _id }).then(() => {
            o.once('change', (change) => {
              assertValidSchema(change);
              o.destroy(done);
            });
            col.deleteOne({ _id: _id }).catch(done);
          });
        });
      });

      it('inserted', function(done) {
        let o = tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL]
        });

        o.once('error', done);
        o.once('connected', () => {
          let _id = `inserted-${Math.random()}`;
          o.once('change', (change) => {
            assert.equal(_id, change.data._id);
            assertValidSchema(change);
            o.destroy(done);
          });
          col.insertOne({ _id: _id }).catch(done);
        });
      });

      it('updated', function(done) {
        let o = tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL]
        });
        o.once('error', done);
        o.once('connected', () => {
          let _id = `updated-${Math.random()}`;
          col.insertOne({ _id: _id }).then(() => {
            o.once('change', (change) => {
              assert.equal(_id, change.data._id);
              assertValidSchema(change);
              o.destroy(done);
            });
            col.updateOne({ _id: _id }, {$set: { n: 9 }}).catch(done);
          });
        });
      });
    });

    describe('error', function() {
      it('when cannot connect', function(done) {
        let o = tailor.tail({
          uri: 'mongodb://garbage',
          db: DB,
          collections: [COL]
        });
        o.on('error', () => done());
        o.on('connected', () => done(new Error('should not connect')));
      });

      it('when error rcvd during fullDoc query', function(done) {
        let o = tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL],
          fullDoc: true
        });

        o.once('connected', () => {
          let _id = 'error during query';
          col.insertOne({ _id: _id }).then(() => {
            o.once('error', (err) => {
              assert(/fail/.test(err));
              o.destroy();
              done();
            });

            var fn = o.cols[COL].findOne;
            o.cols[COL].findOne = function(match, fn) {
              o.cols[COL].findOne = fn;
              process.nextTick(() => fn(new Error('fail')));
            };

            col.updateOne({ _id: _id }, {$set: { n: 3 }}).catch(done);
          });
        });
      });
    });
  });

  describe('update event', function() {
    describe('when fullDoc is true', function() {
      it('includes the full document from the database', function(done) {
        let o = tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL],
          fullDoc: true
        });

        o.once('connected', () => {
          let _id = 'fullDoc is true';
          col.insertOne({ _id: _id, n: 0 }).then(() => {
            setTimeout(() => {
              o.once('change', (change) => {
                assert.equal('update', change.type);
                assert.equal(3, change.data.doc.n);
                done();
              });
              col.updateOne({ _id: _id }, {$set: { n: 3 }}).catch(done);
            }, 100);
          });
        });
      });
    });

    describe('when fullDoc is not true', function() {
      it('does not include the full document from the database', function(done) {
        let o = tailor.tail({
          uri: URI,
          db: DB,
          collections: [COL],
          fullDoc: false
        });

        o.once('connected', () => {
          let _id = 'fullDoc is not true';
          col.insertOne({ _id: _id, n: 0 }).then(() => {
            setTimeout(() => {
              o.once('change', (change) => {
                assert.equal('update', change.type);
                assert.equal(undefined, change.data.doc);
                done();
              });
              col.updateOne({ _id: _id }, {$set: { n: 3 }}).catch(done);
            }, 100);
          }).catch(done);
        });
      });
    });
  });

  describe('#destroy()', function() {
    it('closes the db connection / stops streaming', function(done) {
      let o = tailor.tail({
        uri: URI,
        db: DB,
        collections: [COL]
      });
      o.once('change', () => done(new Error('change detected')));
      o.on('connected', () => {
        o.destroy(() => {
          setTimeout(() => done(), 500);
          col.insertOne({ _id: 'closing connection' });
        });
      });
    });

    it('doesnt throw when no oplog exists', function(done) {
      let o = tailor.tail({
        uri: URI,
        db: DB,
        collections: [COL]
      });

      assert.doesNotThrow(() => {
        o.destroy();
      });

      done();
    });
  });

  describe('ignores', function() {
    it('changes on non-watched collections', function(done) {
      let o = tailor.tail({
        uri: URI,
        db: DB,
        collections: [COL]
      });

      o.once('connected', () => {
        let _id = `non-watched-${Math.random()}`;

        function finished(err) {
          o.destroy();
          done(err);
        }

        o.once('change', (ck) => {
          finished(new Error('should not have seen this'));
        });

        col2.insertOne({ _id: _id }).then(() => {
          col2.updateOne({ _id: _id }, { $inc: { x: 1 }}).then(() => {
            col2.deleteOne({ _id: _id }).catch(done).then(() => {
              setTimeout(() => finished(), 500);
            });
          });
        });
      });
    });
  });
});
