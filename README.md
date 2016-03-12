#mongodb-tailor

Easy MongoDB [oplog tailing](https://www.compose.io/articles/the-mongodb-oplog-and-node-js/)
 with optional document lookups after updates.

## Usage

```js
const tailor = require('mongodb-tailor');

const tail = tailor.tail({
  uri: 'mongodb://localhost/', // a mongodb URI
  db: 'my-database',           // database name
  collections: 'users,votes',  // comma seperated list of collections to tail, use "*" to represent watching all collections
  fullDoc: true                // (default: false) if true, include the full document which was changed
});

tail.on('change', (change) => {
  console.log('do something with %j', change);
});

tail.on('connected', () => {
  console.log('connected to mongodb');
});

tail.on('error', console.error);

tail.on('end', () => {
  console.log('tail ended');
});

setTimeout(() = {
  tail.destroy(); // closes the stream
}, 5000);
```

## Change events

Each `change` event includes a `Payload` object containing the following properties:

- `log`: the oplog object [provided by mongodb](https://www.compose.io/articles/the-mongodb-oplog-and-node-js/)
- `doc`: when `fullDoc` is true, this value is the document as found in the
         database after the update

### Examples

#### updated documents

```js
// fullDoc: false
{ log:
  { ts: Timestamp { _bsontype: 'Timestamp', low_: 10, high_: 1457738334 },
    h: Long { _bsontype: 'Long', low_: 329911832, high_: -1131257351 },
    v: 2,
    op: 'u',
    ns: 'test_mongo_tailor.testing',
    o2: { _id: 'someid' },
    o: { '$set': { n: 3 } }
  },
  doc: undefined
}

// fullDoc: true
{ log:
  { ts: Timestamp { _bsontype: 'Timestamp', low_: 10, high_: 1457738334 },
    h: Long { _bsontype: 'Long', low_: 329911832, high_: -1131257351 },
    v: 2,
    op: 'u',
    ns: 'test_mongo_tailor.testing',
    o2: { _id: 'someid' },
    o: { '$set': { n: 3 } }
  },
  doc: { _id: 'someid', n: 3 } // the entire object in the database
}
```

#### inserted documents

```js
{ log:
  { ts: Timestamp { _bsontype: 'Timestamp', low_: 2, high_: 1457737253 },
    h: Long { _bsontype: 'Long', low_: -1470957526, high_: 287724487 },
    v: 2,
    op: 'i',
    ns: 'test_mongo_tailor.testing',
    o: { _id: 'someid', some: 'value' }
  },
  doc: undefined
}
```

#### deleted documents

```js
{ log:
  { ts: Timestamp { _bsontype: 'Timestamp', low_: 2, high_: 1457737509 },
    h: Long { _bsontype: 'Long', low_: 946730008, high_: -1703118155 },
    v: 2,
    op: 'd',
    ns: 'test_mongo_tailor.testing',
    b: true,
    o: { _id: 'someid' }
  },
  doc: undefined
}
```

#### dropped collections

```js
{ log:
  { ts: Timestamp { _bsontype: 'Timestamp', low_: 3, high_: 1457740592 },
    h: Long { _bsontype: 'Long', low_: -1205550711, high_: 462207525 },
    v: 2,
    op: 'c',
    ns: 'test_mongo_tailor.$cmd',
    o: { drop: 'some_collection_name' }
  },
  doc: undefined
}
```

## Development

### Running tests

- `make test` runs tests
- `make test-cov` runs tests + test coverage
- `make open-cov` opens test coverage results in your browser

## Sponsored by

[Pebble Technology!](https://pebble.com)

## LICENSE

[MIT](/LICENSE)
