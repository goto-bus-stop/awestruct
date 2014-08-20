const StructType = require('./StructType')

module.exports = Struct

function Struct(descriptor) {
  var keys = Object.keys(descriptor)
  var types = keys.map(function (key) {
    return Struct.getType(descriptor[key])
  })

  var decode = function (opts) {
    if (Buffer.isBuffer(opts)) {
      opts = { buf: opts }
    }

    var hasParent = !!opts.struct
      , struct = { $parent: hasParent ? opts.struct : Struct.ROOT }
      , subOpts = { struct: struct, buf: opts.buf, offset: hasParent ? opts.offset : 0, parent: struct.$parent }

    keys.forEach(function (key, i) {
      var type = types[i]
			if (!type) {
				throw new Error('type "' + descriptor[key] + '" not found')
			}
      struct[key] = type.read(subOpts)
      if (hasParent) opts.offset = subOpts.offset
    })

    delete struct.$parent

    return struct
  }

  var encode = function (struct) {
    var size = decode.size(struct)
      , buf = new Buffer(size)
      , opts = { buf: buf, offset: 0 }

    keys.forEach(function (key, i) {
      var type = types[i]
      type.write(opts, struct[key])
    })

    return buf
  }

  decode.$struct = true

  decode.encode = encode

  decode.size = function (struct) {
    return keys.reduce(function (size, key) {
      return size + Struct.getSize(descriptor[key], struct[key], struct)
    }, 0)
  }

  decode.type = StructType({
    read: decode,
    write: function (opts, struct) {
      keys.forEach(function (key) {
        var type = Struct.getType(descriptor[key])
        type.write(opts, struct[key])
      })
    },
    size: decode.size
  })

  return decode
}

Struct.Type = StructType

// used as parent of the top-level struct
Struct.ROOT = {}
// dict of name→StructType
Struct.types = {}

/**
 * @param {Object} struct
 * @param {string} key
 * @return {*} Value.
 */
function descend(struct, key) {
  if (key.indexOf('.') === -1) return struct[key]
  var keys = key.split('.')
    , i = 0
    , l = keys.length
  for (; i < l; i++) {
    struct = struct[keys[i]]
  }
  return struct
}

/**
 * @param {Object} struct
 * @param {*} value Value to find. If a string, used as a path inside the `struct`. If a function, gets called with `this = struct`. Else, used as the value.
 * @return {*}
 */
Struct.getValue = function (struct, value) {
  if (typeof value === 'string') {
    var slash = value.indexOf('/')
    if (slash === 0) {
      // if starts with /, we start from the root
      while (struct.$parent !== Struct.ROOT) {
        struct = struct.$parent
      }
      return descend(struct, value.substr(1))
    }
    else if (slash !== -1) {
      // if there's a slash elsewhere, we have a ../ to move to parent structs
      while (value.indexOf('../') === 0) {
        if (struct.$parent === struct.ROOT) {
          throw new Error('cannot access nonexistent parent')
        }
        struct = struct.$parent
        value = value.substr(3)
      }
      return descend(struct, value)
    }
    else {
      return descend(struct, value)
    }
  }
  else if (typeof value === 'function') {
    return value.call(struct)
  }
  return value
}

Struct.getSize = function (type, value, struct) {
  var size = Struct.getType(type).size
  return typeof size === 'function' ? size(value, struct) : size
}

Struct.getType = function (type) {
  // `Struct({})`s
  if (typeof type === 'function' && type.$struct) return type.type
  // `StructType({})`s
  if (typeof type === 'object' && type.$structType) return type
  // Type names
  if (Struct.types[type]) return Struct.types[type]
}

Struct.defineType = function (name, definition) {
  var type
  // type reader/writer generator
  if (typeof definition === 'function') {
    type = function () {
      var t = definition.apply(null, arguments)
      if (!t.$structType) {
        t = StructType(t)
      }
      return t
    }
  }
  // plain type reader/writer
  else {
    if (!definition.$structType) {
      definition = StructType(definition)
    }
    type = definition
//    type = function () {
//      return definition.read.apply(definition, arguments)
//    }
//    Object.keys(definition).forEach(function (key) {
//      type[key] = definition[key]
//    })
  }
  
  Struct.types[name] = type
  if (!Struct[name]) Struct[name] = type
}

function defineBufferType(name, size, readName, writeName) {
  Struct.defineType(name, {
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

defineBufferType('int8', 1, 'readInt8', 'writeInt8')
// little endians
defineBufferType('int16',  2, 'readInt16LE',  'writeInt16LE')
defineBufferType('int32',  4, 'readInt32LE',  'writeInt32LE')
defineBufferType('uint8',  1, 'readUInt8',    'writeUInt8')
defineBufferType('uint16', 2, 'readUInt16LE', 'writeUInt16LE')
defineBufferType('uint32', 4, 'readUInt32LE', 'writeUInt32LE')
defineBufferType('float',  4, 'readFloatLE',  'writeFloatLE')
defineBufferType('double', 8, 'readDoubleLE', 'writeDoubleLE')
// big endians
defineBufferType('int16be',  2, 'readInt16BE',  'writeInt16BE')
defineBufferType('int32be',  4, 'readInt32BE',  'writeInt32BE')
defineBufferType('uint16be', 2, 'readUInt16BE', 'writeUInt16BE')
defineBufferType('uint32be', 4, 'readUInt32BE', 'writeUInt32BE')
defineBufferType('floatbe',  4, 'readFloatBE',  'writeFloatBE')
defineBufferType('doublebe', 8, 'readDoubleBE', 'writeDoubleBE')

// 1 byte for 1 bit of information! efficiency!
Struct.defineType('bool', {
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

Struct.defineType('array', function (size, type) {
  var typeClass = Struct.getType(type)
  return {
    read: function (opts) {
      var l = Struct.getValue(opts.struct, size)
        , i
        , result = []
      for (i = 0; i < l; i++) {
        result.push(typeClass.read(opts))
      }
      return result
    }
  , write: function (opts, value) {
      var l = value.length
        , i
      for (i = 0; i < l; i++) {
        typeClass.write(opts, value[i])
      }
    }
  , size: typeof size === 'number' ? function (value, struct) {
      return size * Struct.getSize(type, value[0], struct)
    } : function (value, struct) {
      return value.length ? Struct.getSize(type, value[0], struct) * value.length : 0
    }
  }
})

Struct.defineType('char', new function () {
  var generate = function (size) {
    return {
      read: function (opts) {
        var length = Struct.getValue(opts.struct, size)
          , result = opts.buf.slice(opts.offset, opts.offset + length)
        opts.offset += length
        return result.toString()
      }
    , write: function (opts, value) {
        opts.buf.write(value, opts.offset, size)
        opts.offset += size
      }
    , size: size
    }
  }
  var size1 = generate(1)
  generate.read = size1.read
  generate.write = size1.write
  generate.size = 1
  
  return generate
})

// conditional type
Struct.defineType('if', function (condition, type) {
  return {
    read: function (opts) {
      if (Struct.getValue(opts.struct, condition)) {
        return Struct.getType(type).read(opts)
      }
      return undefined
    }
  , write: function (opts, value) {
      if (Struct.getValue(opts.struct, condition)) {
        Struct.getType(type).write(opts)
      }
    }
  , size: function (value, struct) {
      return Struct.getValue(struct, condition) ? Struct.getSize(type, value, struct) : 0
    }
  }
})