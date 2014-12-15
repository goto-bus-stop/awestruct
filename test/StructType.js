var Struct = require('../src/Struct')
  , assert = require('assert')

describe('Struct types', function () {

  var buf = new Buffer([ 10, 20 ])
    , write = new Buffer(1)
    , opts = { buf: buf, offset: 0 }

  var byte = Struct.types.uint8

  function resetOffset() { opts.offset = 0 }

  beforeEach(resetOffset)

  it("can read a thing", function () {
    assert.equal(byte.read(opts), 10)
    assert.equal(opts.offset, 1)
  })

  it("can be called as a function", function () {
    opts.offset = 1
    assert.equal(byte(opts), 20)
  })

  it("transforms things", function () {
    var plus5 = byte.transform(function (a) { return a + 5 })
    assert.equal(plus5(opts), 15)
  })

  it("chains transforms", function () {
    var plus5 = byte.transform(function (a) { return a + 5 })
    var plus6 = plus5.transform(function (a) { return a + 1 })
    assert.equal(plus5(opts), 15)
    assert.equal(plus6(opts), 26)
  })

  it("creates a new type for transforms (issue #3)", function () {
    var int16 = Struct.types.int16
    var evil16 = int16.transform(function () { return 'lol' })
    assert.notEqual(int16(opts), 'lol')
    resetOffset()
    assert.equal(evil16(opts), 'lol')
  })

})

describe('Custom types', function () {

  var myType = Struct.Type({
    read: function (opts) {
      var val = opts.buf.readInt8(opts.offset)
      opts.offset++
      return val * 1000
    }
  , write: function (opts, val) {
      opts.buf.writeInt8(Math.floor(val / 1000), opts.offset)
      opts.offset++
    }
  , size: function (val, struct) {
      return 1
    }
  })

  it('supports custom types', function () {
    var myStruct = Struct({
      builtinType: 'uint8'
    , customType: myType
    })

    assert.deepEqual(myStruct(new Buffer([ 5, 5 ])), { builtinType: 5, customType: 5000 })
  })

})