# awestruct

Library for reading complex binary Buffer structures into objects in Node.js

[![NPM](https://nodei.co/npm/awestruct.png?compact=true)](https://nodei.co/npm/awestruct)

## Usage Example

```js
const Struct = require('awestruct')
const t = Struct.types

// https://github.com/goto-bus-stop/genie-slp/
const slpHeader = Struct([
  ['version', t.string(4)],
  ['numFrames', t.int32],
  ['comment', t.string(24)],

  ['frames', t.array('numFrames', Struct([
    ['cmdTableOffset', t.uint32],
    ['outlineTableOffset', t.uint32],
    ['paletteOffset', t.uint32],
    ['properties', t.uint32],

    ['width', t.int32],
    ['height', t.int32],
    ['hotspot', Struct([
      ['x', t.int32],
      ['y', t.int32]
    ])]
  ]))]
])

const headerContents = slpHeader(slpBuffer) // → { version: '1.00', ... }
```

## API

### Struct(descriptor)

Creates a new `Struct` function that reads from `Buffer`s according to the described format.

`descriptor` is a Struct Descriptor. For example:

```js
var buffer = Buffer.from([ 0x10, 0x20, 0x30 ])
var t = Struct.types
var struct = Struct([
  ['a', t.uint16],
  ['b', t.uint8]
])

struct(buffer) //→ { a: 8208, b: 48 }
```

A struct descriptor is an array of fields. A field can either be an array with two elements, `[name, type]`, or an unnamed raw `type`.
Unnamed types are useful if there is some padding you need to skip.

If an unnamed type reads another struct, it is merged into the current one. For example:

```js
var struct = Struct([
  ['needToReadThing', t.int8],
  t.skip(3), // padding
  t.if('needToReadThing', Struct([
    ['value1', t.int8],
    ['value2', t.int8],
  ]))
])
```

Now, if the `buffer`'s first byte is zero, `struct(buffer)` will return an object like:

```js
{ needToReadThing: 0 }
```

But if it is nonzero, `struct(buffer)` will return an object of this shape:

```js
{
  needToReadThing: 1,
  value1: 43,
  value2: 76
}
```

#### struct(buffer, ?parent)

Instances of `Struct()` can be called directly to read data from buffers. The first parameter is the
Buffer you want to use. The second (optional) parameter is a parent object for the struct, as shown in [Value Paths](#valuepaths).

### Custom types: Struct.Type(type)

Creates a Struct type object. `type` is an object:

```js
var myType = Struct.Type({
  read: function (opts, parent) {
    // `opts.buf` is the Buffer to read from.
    // `opts.offset` is the current offset within the Buffer that's being read. Make sure to increment this appropriately when you're done reading.
    // `opts.struct` is the result Object of the entire Struct so far. You'll only want to use this with the Struct.get* methods, usually.
    // `parent` is the parent result Object if there is a parent Struct.
    var val = opts.buf.readInt8(opts.offset)
    opts.offset++
    return val * 1000
  },
  size: function (val, struct) {
    return 1 // always 1 byte, could also write as { size: 1 }
  }
})
```

Custom types can be used like so:

```js
var myStruct = Struct([
  ['builtinType', Struct.types.uint8],
  ['customType', myType]
])
myStruct(Buffer.from([ 5, 5 ])) //→ { builtinType: 5, customType: 5000 }
```

#### Struct.Type#mapRead(function)

Creates a new type that applies the given transform function when reading values.

```js
var int32 = Struct.types.int32
var myStruct = Struct([
  ['a', int32],
  ['b', int32.mapRead(num => num * 2)]
])
myStruct(Buffer.from([ 5, 5 ])) //→ { a: 5, b: 10 }
```

### Builtin Types

#### Number types

These just map straight to the relevant `Buffer().read*()` methods. Number types read Little-Endian by default, append -`be` if you're dealing with Big-Endian data.

* int8, uint8
* int16, uint16, int16be, uint16be
* int32, uint32, int32be, uint32be
* float, floatbe
* double, doublebe

#### Other common types

* `string(n, encoding = 'utf8')` → Creates a type that decodes `n` bytes into a string with the given encoding (defaults to 'utf8')
* `array(n, type)` → Creates a type that reads `n` items of Struct.Type `type` into an `n`-length array.
* `skip(n)` → Creates a type that skips `n` bytes and returns `undefined`.

The `n` parameter in each of those is a Value Path.

#### Conditional types

* `if(condition, type)` → Creates a type that decodes `type` if the `condition` Value Path is truthy.
  `if()` types also have an `.else(type)` method, to specify a `type` to decode if the `condition` is falsy.

  ```js
  t.if('is32bit', t.int32).else(t.int16)
  ```

### Value Paths

Value paths are used to pass values to some type readers, particularly lengths. Value paths can be raw numbers, or depend on other values in the struct.

Value paths take three forms:

* Numbers: produces the given number.
* Strings: looks up the value at the given path.
* Functions: takes the return value of the function.

```js
Struct([
  ['len', int8],
  ['string', string('len')]
])(Buffer.from([ 3, 104, 105, 33 ])) → { len: 3, string: 'hi!' }
```

A string path can be a plain property name, or a bunch of property names separated by dots ('child.struct.key') to descend into child structs, and can also start with '../' to look back into a "parent" struct.

```js
Struct([
  ['otherArrayLength', t.int8],
  ['subStruct', Struct([
    ['irrelevantDataLength', t.int32],
    ['array', t.array('../otherArrayLength', t.int8)]
  ])]
  t.skip('subStruct.irrelevantDataLength')
])
```

Functions will be called with the current (possibly incomplete) struct in the first parameter:

```js
Struct([
  ['child', Struct([
    ['data', t.array(100, t.uint8)],
    ['whatever', t.if((struct) => {
      struct.data //→ array of 100 uint8s
      struct.$parent //→ the "parent" struct, like '../' in a path
      return true
    }, uint8)]
  ])]
])
```
