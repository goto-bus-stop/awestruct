import { Buffer } from 'buffer'

module.exports = StructType

function StructType (descr, mapRead = [], mapWrite = []) {
  const type = (buf, ...rest) =>
    type.read.apply(type,
      [ Buffer.isBuffer(buf) ? { buf: buf, offset: 0 } : buf ]
        .concat(rest)
    )

  Object.keys(descr).forEach((key) => {
    type[key] = descr[key]
  })

  type.$structType = true

  type.read = (...args) => {
    let val = descr.read.apply(type, args)
    for (let i = 0, l = mapRead.length; i < l; i++) {
      val = mapRead[i].call(type, val)
    }
    return val
  }

  if (type.write == null) {
    type.write = () => {
      throw new Error('unimplemented')
    }
  } else {
    type.write = (opts, originalVal) => {
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

  return type
}
