#mongodb-tailor

```js
const tailor = require('mongodb-tailor');

const tail = tailor.tail({
  uri: 'mongodb://localhost/',
  db: 'my-database',
  collections: 'users,votes',
  fullDoc: true
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
```

## Development

### Running tests

- `make test` runs tests
- `make test-cov` runs tests + test coverage
- `make open-cov` opens test coverage results in your browser

## Sponsored by

[Pebble Technology!](https://pebble.com)

## LICENSE

[MIT](https://github.com/pebble/mongodb-tailor/blob/master/LICENSE)
