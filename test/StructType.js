/* global it describe beforeEach */

var Struct = require('../lib/Struct')
var assert = require('assert')
var Buffer = require('safe-buffer').Buffer

describe('Creating structs', function () {
  var type = Struct.types.int8
  var buf = Buffer.from([ 1, 2 ])

  it('supports objects of name→type pairs', function () {
    var struct = Struct({
      name: type,
      otherName: type
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

describe('Array definition', function (t) {
  var int8 = Struct.types.int8
  var skip = Struct.types.skip
  var when = Struct.types.if

  it('can receive an array of name,type pairs', function () {
    var struct = Struct([
      ['a', int8],
      ['b', int8],
      ['c', int8]
    ])

    assert.deepEqual(struct(Buffer.from([ 1, 2, 3 ])), {
      a: 1,
      b: 2,
      c: 3
    })
  })

  it('can specify unnamed types', function () {
    var struct = Struct([
      ['a', int8],
      skip('a'),
      ['b', int8]
    ])

    assert.deepEqual(struct(Buffer.from([ 2, 0, 0, 5 ])), {
      a: 2,
      b: 5
    })
  })

  it('merges structs read by unnamed types into the parent', function () {
    var struct = Struct([
      ['a', int8],
      when('a', Struct([
        Struct([
          ['c', int8]
        ])
      ]))
    ])

    assert.deepEqual(struct(Buffer.from([ 1, 3 ])), {
      a: 1,
      c: 3
    })
  })
})

describe('Reading data', function () {
  var int8 = Struct.types.int8
  var array = Struct.types.array

  it('continues reading *after* a nested struct', function () {
    var struct = Struct([
      ['nested', Struct([
        ['value', int8]
      ])],
      ['value', int8]
    ])

    assert.deepEqual(struct(Buffer.from([ 1, 2 ])), { nested: { value: 1 }, value: 2 })
  })

  it('continues reading after a nested struct in a context-preserving container type', function () {
    var struct = Struct([
      ['array', array(1, Struct([
        ['value', int8]
      ]))],
      ['value', int8]
    ])

    assert.deepEqual(struct(Buffer.from([ 1, 2 ])), { array: [ { value: 1 } ], value: 2 })

    struct = Struct([
      ['size', int8],
      ['array', array(1, Struct([
        ['array', array('../size', int8)]
      ]))]
    ])

    assert.deepEqual(struct(Buffer.from([ 1, 2 ])), {
      size: 1,
      array: [ { array: [ 2 ] } ]
    })
  })
})

describe('Value paths', function () {
  var int8 = Struct.types.int8
  var string = Struct.types.string
  var array = Struct.types.array

  it('supports accessing parent structs', function () {
    var struct = Struct([
      ['size', int8],
      ['b', Struct([
        ['text1', string('../size')],
        ['text2', string('../size')]
      ])]
    ])

    assert.deepEqual(
      struct(Buffer.from([ 2, 0x20, 0x20, 0x68, 0x69 ])),
      { size: 2, b: { text1: '  ', text2: 'hi' } }
    )
  })

  it('can be a function', function () {
    var struct = Struct([
      ['size', int8],
      ['doubleSizeArray', array(function (struct) {
        return struct.size * 2
      }, int8)]
    ])

    assert.deepEqual(
      struct(Buffer.from([ 2, 0x20, 0x20, 0x68, 0x69 ])),
      { size: 2, doubleSizeArray: [ 0x20, 0x20, 0x68, 0x69 ] }
    )
  })
})

describe('Struct types', function () {
  var buf = Buffer.from([ 10, 20 ])
  var write = Buffer.alloc(1)
  var opts = { buf: buf, offset: 0 }

  var byte = Struct.types.uint8

  function resetOffset () { opts.offset = 0 }

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

  it('supports transforming read values using a mapping function', function () {
    var plus5 = byte.mapRead(function (a) { return a + 5 })
    assert.equal(plus5(opts), 15)

    resetOffset()

    // old-style:
    var plus5Transform = byte.transform(function (a) { return a + 5 })
    assert.equal(plus5Transform(opts), 15)
  })

  it('supports transforming values back when writing using a mapping function', function () {
    var plus5 = byte.mapWrite(function (a) { return a - 5 })
    plus5.write({ buf: write, offset: 0 }, 15)
    assert.equal(write[0], 10)

    resetOffset()

    // shorthand:
    var plus5Short = byte.map(
      function read (a) { return a + 5 },
      function write (a) { return a - 5 }
    )
    var result = plus5Short(opts)
    assert.equal(result, 15)
    plus5Short.write({ buf: write, offset: 0 }, 15)
    assert.equal(write[0], 10)
  })

  it('chains transforms', function () {
    var plus5 = byte.mapRead(function (a) { return a + 5 })
    var plus6 = plus5.mapRead(function (a) { return a + 1 })
    assert.equal(plus5(opts), 15)
    assert.equal(plus6(opts), 26)
  })

  it('chains transforms', function () {
    var plus5 = byte.map(
      function (a) { return a + 5 },
      function (a) { return a - 5 }
    )
    var plus5Times2 = plus5.map(
      function (a) { return a * 2 },
      function (a) { return a / 2 }
    )
    assert.equal(plus5(opts), 15)
    resetOffset()
    assert.equal(plus5Times2(opts), 30)
    plus5.write({ buf: write, offset: 0 }, 15)
    assert.equal(write[0], 10)
    plus5Times2.write({ buf: write, offset: 0 }, 30)
    assert.equal(write[0], 10)
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
    var buf = Buffer.from([
      0xff,
      0x39, 0x05,
      0x00, 0xca, 0x9a, 0x3b
    ])
    var ints = Struct({
      int8: 'int8',
      int16: 'int16',
      int32: 'int32'
    })
    it('supports intXX', function () {
      assert.deepEqual(ints(buf), { int8: -1, int16: 1337, int32: 1000000000 })
    })
  })

  describe('buffers', function () {
    var buffer = Struct.types.buffer

    it('reads simple buffers', function () {
      var buf = Buffer.from([ 0x00, 0x01, 0x02, 0x03 ])

      var simpleBuffer = Struct({
        a: buffer(2),
        b: buffer(2)
      })

      assert.deepEqual(simpleBuffer(buf), {
        a: Buffer.from([ 0x00, 0x01 ]),
        b: Buffer.from([ 0x02, 0x03 ])
      })
    })

    it('creates a copy of the buffer contents', function () {
      var buf = Buffer.from([ 0x00, 0x00, 0x00, 0x00 ])

      var struct = Struct({ buffer: buffer(4) })

      var copy = struct(buf)
      copy.buffer[1] = 0x01
      copy.buffer[3] = 0x02

      // original remained unchanged
      assert.deepEqual(buf, Buffer.from([ 0x00, 0x00, 0x00, 0x00 ]))
      assert.deepEqual(copy.buffer, Buffer.from([ 0x00, 0x01, 0x00, 0x02 ]))
    })

    describe('writes buffers', function () {
      var initialBuffer = Buffer.from([ 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09 ])
      var buffer5bytes = buffer(5)

      it('writes from buffers of the same length', function () {
        var opts = { offset: 2, buf: Buffer.from(initialBuffer) }
        buffer5bytes.write(opts, Buffer.from([ 0xF3, 0xF4, 0xF5, 0xF6, 0xF7 ]))
        assert.deepEqual(opts.buf, Buffer.from([ 0x01, 0x02, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0x08, 0x09 ]))
      })
      it('writes from buffers longer than needed', function () {
        var opts = { offset: 2, buf: Buffer.from(initialBuffer) }
        buffer5bytes.write(opts, Buffer.from([ 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9 ]))
        assert.deepEqual(opts.buf, Buffer.from([ 0x01, 0x02, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0x08, 0x09 ]))
      })
      it('writes from buffers shorter than needed and zero-fills the rest', function () {
        var opts = { offset: 2, buf: Buffer.from(initialBuffer) }
        buffer5bytes.write(opts, Buffer.from([ 0xF3, 0xF4, 0xF5 ]))
        assert.deepEqual(opts.buf, Buffer.from([ 0x01, 0x02, 0xF3, 0xF4, 0xF5, 0x00, 0x00, 0x08, 0x09 ]))
      })
    })
  })

  describe('arrays', function () {
    var buf = Buffer.from([ 0x03, 0x01, 0x20, 0xff, 0x00 ])
    var array = Struct.types.array

    it('reads simple, constant length arrays', function () {
      var simpleArray = Struct({
        array: array(4, 'uint8')
      })
      assert.deepEqual(simpleArray(buf), { array: [ 3, 1, 32, 255 ] })
    })

    it('reads variable length arrays', function () {
      var lengthArray = Struct({
        len: 'int8',
        array: array('len', 'uint8')
      })
      assert.deepEqual(lengthArray(buf), { len: 3, array: [ 1, 32, 255 ] })
    })

    it('can take a function to compute the length', function () {
      var lengthArray = Struct({
        len: 'int8',
        len2: 'int8',
        array: array(function () { return this.len - this.len2 }, 'uint8')
      })
      assert.deepEqual(lengthArray(buf), { len: 3, len2: 1, array: [ 32, 255 ] })
    })
  })

  describe('strings', function () {
    var buf = Buffer.from([ 0x68, 0x69, 0x20, 0x3a, 0x44 ])
    var char = Struct.types.char

    it('reads strings', function () {
      var string = Struct({ string: char(5) })
      assert.equal(string(buf).string, 'hi :D')
    })
  })

  describe('conditional', function () {
    var _if = Struct.types.if
    var int8 = Struct.types.int8
    var uint16 = Struct.types.uint16
    var uint32 = Struct.types.uint32

    it('supports basic conditional types', function () {
      var buf = Buffer.from([ 0x01, 0x00, 0x02, 0x03 ])
      var basicIf = Struct({
        pTrue: int8,
        pFalse: int8,
        two: _if('pTrue', int8),
        next: int8
      })

      assert.deepEqual(basicIf(buf), { pTrue: 1, pFalse: 0, two: 2, next: 3 })

      var basicFalse = Struct({
        pTrue: int8,
        pFalse: int8,
        two: _if('pFalse', int8),
        next: int8
      })

      assert.deepEqual(basicFalse(buf), { pTrue: 1, pFalse: 0, two: undefined, next: 2 })
    })

    it('supports .else', function () {
      var buf = Buffer.from([ 1, 0xff, 0xff, 0xff, 0xff ])
      var basicIfElse = Struct({
        isLong: int8,
        value: _if('isLong', uint32).else(uint16)
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
    },
    write: function (opts, val) {
      opts.buf.writeInt8(Math.floor(val / 1000), opts.offset)
      opts.offset++
    },
    size: function (val, struct) {
      return 1
    }
  })

  it('supports custom types', function () {
    var myStruct = Struct({
      builtinType: 'uint8',
      customType: myType
    })

    assert.deepEqual(myStruct(Buffer.from([ 5, 5 ])), { builtinType: 5, customType: 5000 })
  })

  it('supports custom read-only types', function () {
    var myStruct = Struct({
      readonly: Struct.Type({
        read: function () { return 10 }
      })
    })
    assert.deepEqual(myStruct(Buffer.alloc(0)), { readonly: 10 })
  })
})

describe('Fancy struct() features', function () {
  var int8 = Struct.types.int8
  var array = Struct.types.array

  it('can take a parent object if no parent struct exists', function () {
    var struct = Struct({
      value: array('../length', int8)
    })
    var buffer = Buffer.from([ 0, 1, 2 ])

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
