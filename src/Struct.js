const { Buffer } = require('safe-buffer')
const StructType = require('./StructType')
const { types, getType } = require('./types')
const getValue = require('./getValue')

/**
 * @param {Object} descriptor Object describing this Struct, like `{ key: type, key2: type2 }`
 * @return {function()} Buffer decoding function, with StructType properties and an `.encode` method to encode Buffers.
 */
function Struct (descriptor) {
  let fields
  if (Array.isArray(descriptor)) {
    fields = descriptor.map((field) => {
      if (Array.isArray(field)) {
        return [field[0], getType(field[1])]
      }
      return getType(field)
    })
  } else if (descriptor) {
    fields = Object.keys(descriptor).map((key) => [
      key,
      getType(descriptor[key])
    ])
  } else {
    fields = []
  }

  /**
   * Decodes a buffer into the object structure as described by this Struct.
   * @param {Object|Buffer} opts A Buffer to decode.
   */
  const decode = (opts, parent) => {
    const struct = {}
    // if there is a parent struct, then we need to start at some offset (namely where this struct starts)
    const subOpts = {
      struct,
      buf: opts.buf,
      offset: opts.offset || 0,
      parent: parent || null
    }

    // `struct` gets a temporary `.$parent` property so dependencies can travel up the chain, like in:
    // ```
    // Struct({
    //   size: int8,
    //   b: Struct({
    //     text1: string('../size'),
    //     text2: string('../size')
    //   })
    // })
    // ```
    // Where ../size needs to access parent structs.
    struct.$parent = parent || null

    fields.forEach((field) => {
      let name = null
      let type = null
      if (Array.isArray(field)) {
        [name, type] = field
      } else {
        type = field
      }

      const value = type.read(subOpts, struct)
      if (name) {
        struct[name] = value
      } else if (typeof value === 'object') {
        Object.assign(struct, value)
      }
    })

    // ensure that the parent continues reading in the right spot
    opts.offset = subOpts.offset

    delete struct.$parent

    return struct
  }

  /**
   * Encodes an object into a Buffer as described by this Struct.
   * @param {Object} struct The Object to encode.
   */
  const encode = (struct, buffer) => {
    if (typeof struct !== 'object') {
      throw new TypeError('Expected an object')
    }

    const size = type.size(struct)
    const opts = {
      struct,
      buf: buffer || Buffer.alloc(size),
      offset: 0
    }

    type.write(opts, struct)

    return opts.buf
  }

  const type = StructType({
    read: decode,
    write (opts, struct) {
      fields.forEach((field) => {
        let name = null
        let type = null
        if (Array.isArray(field)) {
          [name, type] = field
        } else {
          type = field
        }

        const value = name ? struct[name] : struct
        type.write(opts, value)
      })
    },
    size (struct) {
      return fields.reduce(
        (size, [ name, type ]) => size + type.size(struct[name], struct),
        0
      )
    }
  })
  type.encode = encode
  type.field = (name, fieldType) => {
    if (typeof name === 'object') {
      fields.push(getType(name))
    } else {
      fields.push([name, getType(fieldType)])
    }
    return type
  }

  return type
}

// import Struct from 'awestruct'
Struct.default = Struct
// import { Type } from 'awestruct', etc
// require('awestruct').Type, etc
Struct.Struct = Struct
Struct.Type = StructType
Struct.types = types
Struct.getValue = getValue
Struct.getType = getType

// require('awestruct') === Struct
module.exports = Struct
