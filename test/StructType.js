var Struct = require('../src/Struct')
  , assert = require('assert')

describe('Creating structs', function () {

  var type = Struct.types.int8
    , buf = Buffer([ 1, 2 ])

  it('supports objects of name→type pairs', function () {
    var struct = Struct({
      name: type
    , otherName: type
    })
    assert.deepEqual(struct(buf), { name: 1, otherName: 2 })
  })

  it('supports .field(name, type)', function () {
    var struct = Struct().field('name', type)
    assert.deepEqual(struct(buf), { name: 1 })

    struct.field('otherName', type)
    assert.deepEqual(struct(buf), { name: 1, otherName: 2 })
  })

})

describe('Reading data', function () {
  var int8 = Struct.types.int8
    , array = Struct.types.array

  it('continues reading *after* a nested struct', function () {
    var struct = Struct({
      nested: Struct({ value: int8 }),
      value: int8
    })

    assert.deepEqual(struct(Buffer([ 1, 2 ])), { nested: { value: 1 }, value: 2 })
  })

  it('continues reading after a nested struct in a context-preserving container type', function () {
    var struct = Struct({
      array: array(1, Struct({ value: int8 })),
      value: int8
    })

    assert.deepEqual(struct(Buffer([ 1, 2 ])), { array: [ { value: 1 } ], value: 2 })

    struct = Struct({
      size: int8,
      array: array(1, Struct({
        array: array('../size', int8)
      }))
    })

    assert.deepEqual(struct(Buffer([ 1, 2 ])), {
      size: 1,
      array: [ { array: [ 2 ] } ]
    })
  })

})

describe('Value paths', function () {
  var int8 = Struct.types.int8
    , char = Struct.types.char

  it('supports accessing parent structs', function () {
    var struct = Struct({
      size: int8,
      b: Struct({
        text1: char('../size'),
        text2: char('../size')
      })
    })

    assert.deepEqual(
      struct(Buffer([ 2, 0x20, 0x20, 0x68, 0x69 ])),
      { size: 2, b: { text1: '  ', text2: 'hi' } }
    )
  })
})

describe('Struct types', function () {

  var buf = Buffer([ 10, 20 ])
    , write = Buffer(1)
    , opts = { buf: buf, offset: 0 }

  var byte = Struct.types.uint8

  function resetOffset() { opts.offset = 0 }

  beforeEach(resetOffset)

  it('can read a thing', function () {
    assert.equal(byte.read(opts), 10)
    assert.equal(opts.offset, 1)
  })

  it('can be called as a function', function () {
    opts.offset = 1
    assert.equal(byte(opts), 20)
  })

  it('can read from a plain old buffer', function () {
    assert.equal(byte(buf), 10)
  })

  it('transforms things', function () {
    var plus5 = byte.transform(function (a) { return a + 5 })
    assert.equal(plus5(opts), 15)
  })

  it('chains transforms', function () {
    var plus5 = byte.transform(function (a) { return a + 5 })
    var plus6 = plus5.transform(function (a) { return a + 1 })
    assert.equal(plus5(opts), 15)
    assert.equal(plus6(opts), 26)
  })

  it('creates a new type for transforms (issue #3)', function () {
    var int16 = Struct.types.int16
    var evil16 = int16.transform(function () { return 'lol' })
    assert.notEqual(int16(opts), 'lol')
    resetOffset()
    assert.equal(evil16(opts), 'lol')
  })

})

describe('Default types', function () {

  describe('ints', function () {
    var buf = Buffer([ 0xff
                     , 0x39, 0x05
                     , 0x00, 0xca, 0x9a, 0x3b ])
      , ints = Struct({
          int8: 'int8'
        , int16: 'int16'
        , int32: 'int32'
        })
    it('supports intXX', function () {
      assert.deepEqual(ints(buf), { int8: -1, int16: 1337, int32: 1000000000 })
    })
  })

  describe('buffers', function () {
    var buffer = Struct.types.buffer

    it('reads simple buffers', function () {
      var buf = Buffer([ 0x00, 0x01, 0x02, 0x03 ])

      var simpleBuffer = Struct({
        a: buffer(2)
      , b: buffer(2)
      })

      assert.deepEqual(simpleBuffer(buf), {
        a: Buffer([ 0x00, 0x01 ])
      , b: Buffer([ 0x02, 0x03 ])
      })
    })

    it('creates a copy of the buffer contents', function () {
      var buf = Buffer([ 0x00, 0x00, 0x00, 0x00 ])

      var struct = Struct({ buffer: buffer(4) })

      var copy = struct(buf)
      copy.buffer[1] = 0x01
      copy.buffer[3] = 0x02

      // original remained unchanged
      assert.deepEqual(buf, Buffer([ 0x00, 0x00, 0x00, 0x00 ]))
      assert.deepEqual(copy.buffer, Buffer([ 0x00, 0x01, 0x00, 0x02 ]))
    })
  })

  describe('arrays', function () {
    var buf = Buffer([ 0x03, 0x01, 0x20, 0xff, 0x00 ])
      , array = Struct.types.array

    it('reads simple, constant length arrays', function () {
      var simpleArray = Struct({
        array: array(4, 'uint8')
      })
      assert.deepEqual(simpleArray(buf), { array: [ 3, 1, 32, 255 ] })
    })

    it('reads variable length arrays', function () {
      var lengthArray = Struct({
        len: 'int8'
      , array: array('len', 'uint8')
      })
      assert.deepEqual(lengthArray(buf), { len: 3, array: [ 1, 32, 255 ] })
    })

    it('can take a function to compute the length', function () {
      var lengthArray = Struct({
        len: 'int8'
      , len2: 'int8'
      , array: array(function () { return this.len - this.len2 }, 'uint8')
      })
      assert.deepEqual(lengthArray(buf), { len: 3, len2: 1, array: [ 32, 255 ] })
    })

  })

  describe('strings', function () {
    var buf = Buffer([ 0x68, 0x69, 0x20, 0x3a, 0x44 ])
      , char = Struct.types.char

    it('reads strings', function () {
      var string = Struct({ string: char(5) })
      assert.equal(string(buf).string, 'hi :D')
    })
  })

  describe('conditional', function () {
    var _if = Struct.types.if
      , int8 = Struct.types.int8
      , uint16 = Struct.types.uint16
      , uint32 = Struct.types.uint32

    it('supports basic conditional types', function () {
      var buf = Buffer([ 0x01, 0x00, 0x02, 0x03 ])
      var basicIf = Struct({
        pTrue: int8
      , pFalse: int8
      , two: _if('pTrue', int8)
      , next: int8
      })

      assert.deepEqual(basicIf(buf), { pTrue: 1, pFalse: 0, two: 2, next: 3 })

      var basicFalse = Struct({
        pTrue: int8
      , pFalse: int8
      , two: _if('pFalse', int8)
      , next: int8
      })

      assert.deepEqual(basicFalse(buf), { pTrue: 1, pFalse: 0, two: undefined, next: 2 })
    })

    it('supports .else', function () {
      var buf = Buffer([ 1, 0xff, 0xff, 0xff, 0xff ])
      var basicIfElse = Struct({
        isLong: int8
      , value: _if('isLong', uint32).else(uint16)
      })

      assert.deepEqual(basicIfElse(buf), { isLong: 1, value: 0xffffffff })
      buf[0] = 0
      assert.deepEqual(basicIfElse(buf), { isLong: 0, value: 0xffff })
    })
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

    assert.deepEqual(myStruct(Buffer([ 5, 5 ])), { builtinType: 5, customType: 5000 })
  })

  it('supports custom read-only types', function () {
    var myStruct = Struct({
      readonly: Struct.Type({
        read: function () { return 10 }
      })
    })
    assert.deepEqual(myStruct(Buffer(0)), { readonly: 10 })
  })

})

describe('Fancy struct() features', function () {
  var int8 = Struct.types.int8
    , array = Struct.types.array

  it('can take a parent object if no parent struct exists', function () {
    var struct = Struct({
      value: array('../length', int8)
    })
    var buffer = Buffer([ 0, 1, 2 ])

    assert.throws(
      function () {
        struct(buffer)
      },
      /cannot access nonexistent parent/
    )

    assert.equal(
      struct(buffer, { length: 2 }).value.length,
      2
    )
  })
})