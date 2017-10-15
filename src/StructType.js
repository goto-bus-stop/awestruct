const { Buffer } = require('safe-buffer')

module.exports = StructType

function StructType (descr, mapRead = [], mapWrite = []) {
  const type = function read (buf, ...rest) {
    return type.read(
      Buffer.isBuffer(buf) ? { buf: buf, offset: 0 } : buf,
      ...rest
    )
  }

  Object.keys(descr).forEach((key) => {
    type[key] = descr[key]
  })

  type.$structType = true

  type.read = function read (...args) {
    let val = descr.read.apply(type, args)
    for (let i = 0, l = mapRead.length; i < l; i++) {
      val = mapRead[i].call(type, val)
    }
    return val
  }

  if (type.write == null) {
    type.write = function write () {
      throw new Error('unimplemented')
    }
  } else {
    type.write = function write (opts, originalVal) {
      let val = originalVal
      for (let i = mapWrite.length - 1; i >= 0; i--) {
        val = mapWrite[i].call(type, val, opts)
      }
      return descr.write.call(type, opts, val)
    }
  }

  type.transform =
  type.mapRead = (fn) =>
    StructType(descr, [ ...mapRead, fn ], mapWrite)
  type.mapWrite = (fn) =>
    StructType(descr, mapRead, [ ...mapWrite, fn ])
  type.map = (read, write) =>
    StructType(descr, read ? [ ...mapRead, read ] : mapRead
                    , write ? [ ...mapWrite, write ] : mapWrite)

  if (type.size == null) {
    type.size = () => {
      throw new Error('unimplemented')
    }
  } else if (typeof type.size === 'number') {
    type.size = () => descr.size
  }

  // abstract-encoding
  type.encode = encode
  type.decode = decode
  type.encodingLength = type.size

  return type

  function encode (value, buffer, offset) {
    if (!offset) {
      offset = 0
    }
    if (!buffer) {
      buffer = Buffer.alloc(type.size(value))
    }
    const opts = { buf: buffer, offset: offset }
    type.write(opts, value)
    encode.bytes = opts.offset - offset
    return opts.buf
  }
  function decode (buffer, start, end) {
    if (!start) {
      start = 0
    }
    const opts = { buf: buffer, offset: start }
    const value = type.read(opts)
    decode.bytes = opts.offset - start
    return value
  }
}
