import StructType from './StructType'
import getValue from './getValue'

/**
 * @param {string|Object|function} type Type name to find, or a StructType-ish descriptor object.
 * @return {StructType}
 */
function getType (type) {
  // an object that can read/write something. `type.size` can also be 0
  if (type.read && type.write && type.size != null) {
    return type.$structType ? type : StructType(type)
  }

  // Named types
  if (types[type]) {
    return types[type]
  }

  throw new Error('no such type: "' + type + '"')
}

/**
 * Defines a type that maps straight to Buffer methods.
 * Used internally for the different Number reading methods.
 * @param {number} size      Size of the type.
 * @param {string} readName  Name of the reading method.
 * @param {string} writeName Name of the writing method.
 */
const makeBufferType = (size, readName, writeName) => StructType({
  read (opts) {
    const result = opts.buf[readName](opts.offset)
    opts.offset += size
    return result
  },
  write (opts, value) {
    opts.buf[writeName](value, opts.offset)
    opts.offset += size
  },
  size
})

const int8 = makeBufferType(1, 'readInt8', 'writeInt8')
const uint8 = makeBufferType(1, 'readUInt8', 'writeUInt8')
// little endians
const int16 = makeBufferType(2, 'readInt16LE', 'writeInt16LE')
const uint16 = makeBufferType(2, 'readUInt16LE', 'writeUInt16LE')
const int32 = makeBufferType(4, 'readInt32LE', 'writeInt32LE')
const uint32 = makeBufferType(4, 'readUInt32LE', 'writeUInt32LE')
const float = makeBufferType(4, 'readFloatLE', 'writeFloatLE')
const double = makeBufferType(8, 'readDoubleLE', 'writeDoubleLE')
// big endians
const int16be = makeBufferType(2, 'readInt16BE', 'writeInt16BE')
const uint16be = makeBufferType(2, 'readUInt16BE', 'writeUInt16BE')
const int32be = makeBufferType(4, 'readInt32BE', 'writeInt32BE')
const uint32be = makeBufferType(4, 'readUInt32BE', 'writeUInt32BE')
const floatbe = makeBufferType(4, 'readFloatBE', 'writeFloatBE')
const doublebe = makeBufferType(8, 'readDoubleBE', 'writeDoubleBE')

// 1 byte for 1 bit of information! efficiency!
const bool = StructType({
  read (opts) {
    const result = opts.buf[opts.offset] !== 0
    opts.offset++
    return result
  },
  write (opts, value) {
    opts.buf[opts.offset] = value ? 1 : 0
    opts.offset++
  },
  size: 1
})

const buffer = (size) => StructType({
  read (opts) {
    const length = getValue(opts.struct, size)
    const result = Buffer(length)
    opts.buf.copy(result, 0, opts.offset, opts.offset + length)
    opts.offset += length
    return result
  },
  write (opts, value) {
    if (!Buffer.isBuffer(value)) {
      const valueType = Object.prototype.toString.call(null).replace(/^\[object (.+)\]$/, '$1')
      throw new Error('cannot write value of incorrect type, expected Buffer, got ' + valueType)
    }
    const fieldLength = getValue(opts.struct, size)
    const valueLength = Math.min(value.length, fieldLength)
    value.copy(opts.buf, opts.offset, 0, valueLength)
    opts.buf.fill(0, opts.offset + valueLength, opts.offset + fieldLength)
    opts.offset += fieldLength
  },
  size: (struct) => getValue(struct, size)
})

const array = (length, type) => {
  const typeClass = getType(type)
  return StructType({
    read (opts, parent) {
      const l = getValue(opts.struct, length)
      const result = []
      for (let i = 0; i < l; i++) {
        result.push(typeClass.read(opts, parent))
      }
      return result
    },
    write (opts, value) {
      const l = getValue(opts.struct, length)
      if (value.length !== l) {
        throw new Error('cannot write incorrect array length, expected ' + l + ', got ' + value.length)
      }
      for (let i = 0; i < l; i++) {
        typeClass.write(opts, value[i])
      }
    },
    size: typeof length === 'number'
      ? (value, struct) => length * type.size(value[0], struct)
      : (value, struct) => value.length ? type.size(value[0], struct) * value.length : 0
  })
}

const string = (size, encoding = 'utf8') => StructType({
  read (opts) {
    const length = getValue(opts.struct, size)
    const result = opts.buf.toString(encoding, opts.offset, opts.offset + length)
    opts.offset += length
    return result
  },
  write (opts, value) {
    const length = getValue(opts.struct, size)
    if (value.length !== length) {
      throw new Error('cannot write incorrect string size, expected ' + length + ', got ' + value.length)
    }
    opts.buf.write(value, opts.offset, length, encoding)
    opts.offset += length
  },
  size: (value, struct) => getValue(struct, size)
})

// compat <=0.9.2
const char = string

// conditional type
const when = (condition, type) => {
  type = getType(type)
  let elseType
  return StructType({
    read (opts, parent) {
      if (getValue(opts.struct, condition)) {
        return type.read(opts, parent)
      } else if (elseType) {
        return elseType.read(opts, parent)
      }
    },
    write (opts, value) {
      if (getValue(opts.struct, condition)) {
        type.write(opts, value)
      } else if (elseType) {
        return elseType.write(opts, value)
      }
    },
    size: (value, struct) => getValue(struct, condition) ? type.size(value, struct) : 0,
    // additional methods
    else (type) {
      elseType = getType(type)
      return this
    }
  })
}

const skip = (size) => StructType({
  read (opts) { opts.offset += size },
  write (opts) { opts.offset += size },
  size
})

const types = {
  int8, uint8, bool,
  int16, uint16, int16be, uint16be,
  int32, uint32, int32be, uint32be,
  float, floatbe, double, doublebe,
  char, string, array, buffer,
  when, if: when,
  skip
}

module.exports = { types, getType }
