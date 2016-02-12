'use strict';

const tailor = require('../');
const assert = require('assert');

describe('tailor', function() {
  it('exports a tail() function', function(done) {
    assert.equal(typeof tailor.tail, 'function', 'tail is not a function');
    done();
  });
});
