Awestruct
=========

Library for reading binary Buffer structures into objects in Node.js

## API

### Struct Descriptor

A Struct Descriptor is an Object where the keys are the keys of the Struct, and the values are `StructType`s (i.e. Buffer readers/writers). It's pretty similar to how structs look in C-likes:

```c
struct someStruct {
  int a;
  int b;
  char c[8];
}
```

With Awestruct:
```javascript
var int32 = Struct.types.int32 // builtin types are defined on `Struct.types`.
  , char = Struct.types.char

var someStruct = Struct({
  a: int32
, b: 'int32' // passing a string will look up a type on `Struct.types`.
, c: char(8) // `char` is a function returning a `StructType`.
})
```

### Struct(descriptor)

Creates a new `Struct` function that reads from & writes to `Buffer`s according to the described format.

`descriptor` is a Struct Descriptor. For example:

```javascript
var buffer = new Buffer([ 0x10, 0x20, 0x30 ])
  , struct = Struct({
      a: 'uint16'
    , b: 'uint8'
    })

struct(buffer) //→ { a: 8208, b: 48 }
```

#### Struct#field(name, type)

Adds a field to the `Struct`. Useful if your code isn't going to always run on V8 (or other engines that accidentally keep object keys mostly in order of definition), or if you want to change the structure after the first instantiation.

Note that this *mutates* the current Struct, and does not create a new one.

```javascript
var buffer = new Buffer([ 0x10, 0x20, 0x30 ])
  , struct = Struct()
    .field('a', 'uint16')
    .field('b', 'uint8')

struct(buffer) //→ { a: 8208, b: 48 }
```

### Struct.Type(type)

Creates a Struct type object. `type` is an object:
```javascript
var myType = StructType({
  read: function (opts) {
    // `opts.buf` is the Buffer to read from.
    // `opts.offset` is the current offset within the Buffer that's being read. Make sure to increment this appropriately when you're done reading.
    // `opts.struct` is the result Object of the entire Struct so far. You'll only want to use this with the Struct.get* methods, usually.
    // `opts.parent` is the parent result Object if there is a parent Struct. (as in `Struct({ sub: Struct({}) })`)
    var val = opts.buf.readInt8(opts.offset)
    opts.offset++
    return val * 1000
  }
, write: function (opts, val) {
    opts.buf.writeInt8(Math.floor(val / 1000), opts.offset)
    opts.offset++
  }
, size: function (val, struct) {
    return 1 // always 1 byte, could also write as { size: 1 }
  }
})
```

Custom types can be used like so:
```javascript
var myStruct = Struct({
  builtinType: 'uint8'
, customType: myType
})
myStruct(new Buffer([ 5, 5 ])) //→ { builtinType: 5, customType: 5000 }
```

#### Struct.Type#transform(function)

Creates a new type that applies the given transform function.

```javascript
var int32 = Struct.types.int32
var myStruct = Struct({
  a: int32
, b: int32.transform(num => num * 2)
})
myStruct(Buffer([ 5, 5 ])) //→ { a: 5, b: 10 }
```