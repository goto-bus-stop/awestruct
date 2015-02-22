awestruct
---------

Library for reading binary Buffer structures into objects in Node.js

[![NPM](https://nodei.co/npm/awestruct.png?compact=true)](https://nodei.co/npm/awestruct)

## API

### Struct(descriptor)

Creates a new `Struct` function that reads from `Buffer`s according to the described format.

`descriptor` is a Struct Descriptor. For example:

```javascript
var buffer = Buffer([ 0x10, 0x20, 0x30 ])
  , t = Struct.types
  , struct = Struct({
      a: t.uint16
    , b: t.uint8
    })

struct(buffer) //→ { a: 8208, b: 48 }
```

#### Struct#field(name, type)

Adds a field to the `Struct`. Useful if your code isn't going to always run on V8 (or other engines that accidentally keep object keys mostly in order of definition), or if you want to change the structure after the first instantiation.

Note that this *mutates* the current Struct, and does not create a new copy.

```javascript
var buffer = Buffer([ 0x10, 0x20, 0x30 ])
  , t = Struct.types
  , struct = Struct()
    .field('a', t.uint16)
    .field('b', t.uint8)

struct(buffer) //→ { a: 8208, b: 48 }, same as above!
```

#### struct(buffer, ?parent)

Instances of `Struct()` can be called directly to read data from buffers. The first parameter is the
Buffer you want to use. The second (optional) parameter is a parent object for the struct, as shown in [Value Paths](#valuepaths).

### Custom types: Struct.Type(type)

Creates a Struct type object. `type` is an object:
```javascript
var myType = Struct.Type({
  read: function (opts, parent) {
    // `opts.buf` is the Buffer to read from.
    // `opts.offset` is the current offset within the Buffer that's being read. Make sure to increment this appropriately when you're done reading.
    // `opts.struct` is the result Object of the entire Struct so far. You'll only want to use this with the Struct.get* methods, usually.
    // `parent` is the parent result Object if there is a parent Struct.
    var val = opts.buf.readInt8(opts.offset)
    opts.offset++
    return val * 1000
  }
, size: function (val, struct) {
    return 1 // always 1 byte, could also write as { size: 1 }
  }
})
```

Custom types can be used like so:
```javascript
var myStruct = Struct({
  builtinType: Struct.types.uint8
, customType: myType
})
myStruct(Buffer([ 5, 5 ])) //→ { builtinType: 5, customType: 5000 }
```

#### Struct.Type#transform(function)

Creates a new type that applies the given transform function when reading values.

```javascript
var int32 = Struct.types.int32
var myStruct = Struct({
  a: int32
, b: int32.transform(num => num * 2)
})
myStruct(Buffer([ 5, 5 ])) //→ { a: 5, b: 10 }
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

* `char(n, encoding = 'utf8')` → Creates a type that decodes `n` bytes into a string with the given encoding (defaults to 'utf8')
* `array(n, type)` → Creates a type that reads `n` items of Struct.Type `type` into an `n`-length array.
* `skip(n)` → Creates a type that skips `n` bytes and returns `undefined`.

The `n` parameter in each of those is a Value Path.

### Value Paths

Value paths are used to pass values to some type readers. Value paths can just be numbers, or depend on other values in the struct.

Value paths take three forms:

* Numbers: nothing fancy, produces the given number.
* Strings: looks up the value at the given path.
* Functions: takes the return value of the function.

```javascript
Struct({
  len: int8
, string: char('len')
})(Buffer([ 3, 104, 105, 33 ])) → { len: 3, string: 'hi!' }
```

A string path can be just a plain property name, or a bunch of property names separated by dots ('child.struct.key') to descend into child structs, and can also start with '../' to look back into a "parent" struct.

```javascript
Struct({
  otherArrayLength: t.int8
, subStruct: Struct({
    irrelevantDataLength: t.int32
  , array: t.array('../otherArrayLength', t.int8)
  })
, irrelevant: t.skip('subStruct.irrelevantDataLength')
})
```

Functions will be called with the current (possibly incomplete) struct as `this`:

```javascript
Struct({
  child: Struct({
    data: t.array(100, t.uint8)
  , whatever: t.if(() => {
      this.data //→ array of 100 uint8s
      this.$parent //→ the "parent" struct, like '../' in a path
      return true
    }, uint8)
  })
})
```