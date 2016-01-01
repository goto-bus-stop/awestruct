module.exports = StructType

function StructType(descr, mapRead, mapWrite) {
  var type = function (opts) {
    if (Buffer.isBuffer(opts)) {
      opts = { buf: opts, offset: 0 }
    }
    var args = [ opts ]
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i])
    return type.read.apply(type, args)
  }
  mapRead = mapRead || []
  mapWrite = mapWrite || []

  Object.keys(descr).forEach(function (key) {
    type[key] = descr[key]
  })

  type.$structType = true

  type.read = function () {
    var val = descr.read.apply(type, arguments)
      , i = 0
      , l = mapRead.length
    for (; i < l; i++) {
      val = mapRead[i].call(type, val)
    }
    return val
  }

  if (type.write == null) {
    type.write = function () {
      throw new Error('unimplemented')
    }
  } else {
    type.write = function (opts, originalVal) {
      var val = originalVal
        , i = mapWrite.length - 1
      for (; i >= 0; i--) {
        val = mapWrite[i].call(type, val, opts)
      }
      return descr.write.call(type, opts, val)
    }
  }

  type.transform =
  type.mapRead = function (fn) {
    return StructType(descr, mapRead.concat([ fn ]), mapWrite)
  }
  type.mapWrite = function (fn) {
    return StructType(descr, mapRead, mapWrite.concat([ fn ]))
  }
  type.map = function (read, write) {
    return StructType(descr, read ? mapRead.concat([ read ]) : mapRead
                           , write ? mapWrite.concat([ write ]) : mapWrite)
  }

  if (type.size == null) {
    type.size = function () {
      throw new Error('unimplemented')
    }
  }
  else if (typeof type.size === 'number') {
    type.size = function () { return descr.size }
  }

  return type
}
