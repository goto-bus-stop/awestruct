'use strict'

const { Buffer } = require('safe-buffer')

module.exports = StructType

function StructType (descr, mapRead = [], mapWrite = []) {
  const type = function read (buf, parent) {
    const isBuffer = Buffer.isBuffer(buf)
    if (!isBuffer && typeof buf !== 'object') {
      throw new TypeError(`awestruct: first argument to read/decode function must be Buffer or options object, got ${typeof buf}`)
    }

    const opts = isBuffer ? { buf: buf, offset: 0 } : buf
    return type.read(opts, parent)
  }

  Object.keys(descr).forEach((key) => {
    type[key] = descr[key]
  })

  type.$structType = true

  if (mapRead.length > 0) {
    const readImpl = descr.read.bind(type)
    type.read = function read (opts, parent) {
      let val = readImpl(opts, parent)
      for (let i = 0, l = mapRead.length; i < l; i++) {
        val = mapRead[i].call(type, val)
      }
      return val
    }
  }

  if (type.write == null) {
    type.write = function write () {
      throw new Error('unimplemented')
    }
  } else if (mapWrite.length > 0) {
    const writeImpl = descr.write.bind(type)
    type.write = function write (opts, originalVal) {
      let val = originalVal
      for (let i = mapWrite.length - 1; i >= 0; i--) {
        val = mapWrite[i].call(type, val, opts)
      }
      return writeImpl(opts, val)
    }
  }

  type.transform =
  type.mapRead = (fn) => StructType(
    descr,
    [...mapRead, fn],
    mapWrite
  )
  type.mapWrite = (fn) => StructType(
    descr,
    mapRead,
    [...mapWrite, fn]
  )
  type.map = (read, write) => StructType(
    descr,
    read ? [...mapRead, read] : mapRead,
    write ? [...mapWrite, write] : mapWrite
  )

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
    const value = type.read(opts, undefined)
    decode.bytes = opts.offset - start
    return value
  }
}
