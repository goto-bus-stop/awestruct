var StructType = require('./StructType')

module.exports = Struct

Struct.Type = StructType
Struct.getValue = getValue
Struct.getType = getType

/**
 * @param {Object} descriptor Object describing this Struct, like `{ key: type, key2: type2 }`
 * @return {function()} Buffer decoding function, with StructType properties and an `.encode` method to encode Buffers.
 */
function Struct(descriptor) {
  var fields
  if (descriptor) {
    fields = Object.keys(descriptor).map(function (key) {
      return { name: key, type: getType(descriptor[key]) }
    })
  }
  else {
    fields = []
  }

  /**
   * Decodes a buffer into the object structure as described by this Struct.
   * @param {Object|Buffer} opts A Buffer to decode.
   */
  var decode = function (opts) {
    if (Buffer.isBuffer(opts)) {
      opts = { buf: opts }
    }

    var hasParent = !!opts.struct
      , struct = {}
      // if there is a parent struct, then we need to start at some offset (namely where this struct starts)
      , subOpts = { struct: struct, buf: opts.buf, offset: hasParent ? opts.offset : 0, parent: struct.$parent }

    // `struct` gets a temporary `.$parent` property so dependencies can travel up the chain, like in:
    // ```
    // Struct({
    //   size: 'int8',
    //   b: Struct({
    //     text1: Struct.char('../size'),
    //     text2: Struct.char('/size')
    //   })
    // })
    // ```
    // Both ../size and /size need to access parent structs.
    struct.$parent = hasParent ? opts.struct : null

    fields.forEach(function (field) {
      struct[field.name] = field.type.read(subOpts)
    })

    // if we have a parent Struct, we also need to update its offset
    // so it continues reading in the right place
    if (hasParent) opts.offset = subOpts.offset

    delete struct.$parent

    return struct
  }

  /**
   * Encodes an object into a Buffer as described by this Struct.
   * @param {Object} struct The Object to encode.
   */
  var encode = function (struct) {
    var size = type.size(struct)
      , buf = Buffer(size)
      , opts = { buf: buf, offset: 0 }

    type.write(opts, struct)

    return buf
  }

  var type = StructType({
    read: decode
  , write: function (opts, struct) {
      fields.forEach(function (field, i) {
        field.type.write(opts, struct[field.name])
      })
    }
  , size: function (struct) {
      return fields.reduce(function (size, field) {
        return size + field.type.size(struct[field.name], struct)
      }, 0)
    }
  })
  type.encode = encode
  type.field = function (name, fieldType) {
    fields.push({ name: name, type: getType(fieldType) })
    return type
  }

  return type
}

// dict of name→StructType
Struct.types = {}

/**
 * @param {Object} struct
 * @param {string} key
 * @return {*} Value.
 */
function descend(struct, key) {
  if (key.indexOf('.') === -1) return struct[key]
  return key.split('.').reduce(function (struct, sub) {
    return struct[sub]
  }, struct)
}

/**
 * @param {Object} struct Object to find a value on.
 * @param {*}      value  Value to find. If a string, used as a path inside the `struct`. If a function, gets called with `this = struct`. Else, used unchanged as the value.
 * @return {*}
 */
function getValue(struct, value) {
  // key path inside the `struct`
  if (typeof value === 'string') {
    // ../ moves to a "parent" struct
    while (value.indexOf('../') === 0) {
      if (struct.$parent === null) {
        throw new Error('cannot access nonexistent parent')
      }
      struct = struct.$parent
      value = value.substr(3)
    }
    return descend(struct, value)
  }
  else if (typeof value === 'function') {
    return value.call(struct)
  }
  return value
}

/**
 * @param {string|Object|function} type Type name to find, or a StructType-ish descriptor object.
 * @return {StructType}
 */
function getType(type) {
  // an object that can read/write something. `type.size` can also be 0
  if (type.read && type.write && type.size != null) return type.$structType ? type : StructType(type)
  // Named types
  if (Struct.types[type]) return Struct.types[type]
  throw new Error('no such type: "' + type + '"')
}

/**
 * Defines a type that maps straight to Buffer methods.
 * Used internally for the different Number reading methods.
 * @param {string} name Name of the type.
 * @param {number} size Size of the type.
 * @param {string} readName Name of the reading method.
 * @param {string} writeName Name of the writing method.
 * @private
 */
function defineBufferType(name, size, readName, writeName) {
  Struct.types[name] = StructType({
    read: function (opts) {
      var result = opts.buf[readName](opts.offset)
      opts.offset += size
      return result
    }
  , write: function (opts, value) {
      opts.buf[writeName](value, opts.offset)
      opts.offset += size
    }
  , size: size
  })
}

defineBufferType('int8',  1, 'readInt8',  'writeInt8')
defineBufferType('uint8', 1, 'readUInt8', 'writeUInt8')
// little endians
defineBufferType('int16',  2, 'readInt16LE',  'writeInt16LE')
defineBufferType('uint16', 2, 'readUInt16LE', 'writeUInt16LE')
defineBufferType('int32',  4, 'readInt32LE',  'writeInt32LE')
defineBufferType('uint32', 4, 'readUInt32LE', 'writeUInt32LE')
defineBufferType('float',  4, 'readFloatLE',  'writeFloatLE')
defineBufferType('double', 8, 'readDoubleLE', 'writeDoubleLE')
// big endians
defineBufferType('int16be',  2, 'readInt16BE',  'writeInt16BE')
defineBufferType('uint16be', 2, 'readUInt16BE', 'writeUInt16BE')
defineBufferType('int32be',  4, 'readInt32BE',  'writeInt32BE')
defineBufferType('uint32be', 4, 'readUInt32BE', 'writeUInt32BE')
defineBufferType('floatbe',  4, 'readFloatBE',  'writeFloatBE')
defineBufferType('doublebe', 8, 'readDoubleBE', 'writeDoubleBE')

// 1 byte for 1 bit of information! efficiency!
Struct.types.bool = StructType({
  read: function (opts) {
    var result = opts.buf[opts.offset] !== 0
    opts.offset++
    return result
  }
, write: function (opts, value) {
    opts.buf[opts.offset] = value ? 1 : 0
    opts.offset++
  }
, size: 1
})

Struct.types.array = function (length, type) {
  var typeClass = getType(type)
  return StructType({
    read: function (opts) {
      var l = getValue(opts.struct, length)
        , i
        , result = []
      for (i = 0; i < l; i++) {
        result.push(typeClass.read(opts))
      }
      return result
    }
  , write: function (opts, value) {
      var l = getValue(opts.struct, length)
        , i
      if (value.length !== l) {
        throw new Error('cannot write incorrect array length, expected ' + l + ', got ' + value.length)
      }
      for (i = 0; i < l; i++) {
        typeClass.write(opts, value[i])
      }
    }
  , size: typeof length === 'number'
      ? function (value, struct) { return length * type.size(value[0], struct) }
      : function (value, struct) {
        return value.length ? type.size(value[0], struct) * value.length : 0
      }
  })
}

Struct.types.char = function (size, encoding) {
  if (!encoding) encoding = 'utf8'
  return StructType({
    read: function (opts) {
      var length = getValue(opts.struct, size)
        , result = opts.buf.toString(encoding, opts.offset, opts.offset + length)
      opts.offset += length
      return result
    }
  , write: function (opts, value) {
      var length = getValue(opts.struct, size)
      if (value.length !== length) {
        throw new Error('cannot write incorrect char size, expected ' + length + ', got ' + value.length)
      }
      opts.buf.write(value, opts.offset, length, encoding)
      opts.offset += length
    }
  , size: function (struct) {
      return getValue(opts.struct, size)
    }
  })
}

// conditional type
Struct.types.if = function (condition, type) {
  return StructType({
    read: function (opts) {
      if (getValue(opts.struct, condition)) {
        return getType(type).read(opts)
      }
      return undefined
    }
  , write: function (opts, value) {
      if (getValue(opts.struct, condition)) {
        getType(type).write(opts)
      }
    }
  , size: function (value, struct) {
      return getValue(struct, condition) ? type.size(value, struct) : 0
    }
  })
}

Struct.types.skip = function (size) {
  return StructType({
    read: function (opts) { opts.offset += size }
  , write: function (opts) { opts.offset += size }
  , size: size
  })
}
