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

In Awestruct:
```javascript
var someStruct = Struct({
  a: Struct.int32 // types are defined straight on Struct. If the type name conflicts with a method, you can access it through `Struct.types.int32` instead.
, b: 'int32' // passing a string will look up a Type on `Struct.types`.
, c: Struct.char(8) // Types can be functions returning `StructType`s.
})
```

Usually the most common form will be the string form.

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

#### Struct.defineType(name, type)

Defines a named type. The `type` can be a `StructType`, a plain Object (which will be used to instantiate a `StructType`), or a function returning a `StructType`.

These types can later be accessed on `Struct.types`, or `Struct`, or as a string in Struct Descriptors. (e.g. `Struct({ key: 'myType' })`)

### StructType(type)

Creates a Struct type object. `type` is an object:
```javascript
StructType({
  read: function (opts) {
    // `opts.buf` is the Buffer to read from.
    // `opts.offset` is the current offset within the Buffer that's being read. Make sure to increment this appropriately when you're done reading.
    // `opts.struct` is the result Object of the entire Struct so far. You'll only want to use this with the Struct.get* methods, usually.
    // `opts.parent` is the parent result Object if there is a parent Struct. (as in `Struct({ sub: Struct({}) })`)
  }
, write: function (opts, buffer) {}
, size: function (struct) {}
})
```