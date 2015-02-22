module.exports = StructType

function StructType(descr, transforms) {
  var type = function (opts) {
    if (Buffer.isBuffer(opts)) {
      opts = { buf: opts, offset: 0 }
    }
    var args = [ opts ]
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i])
    return type.read.apply(type, args)
  }
  transforms = transforms || []

  Object.keys(descr).forEach(function (key) {
    type[key] = descr[key]
  })

  type.$structType = true

  type.read = function () {
    var val = descr.read.apply(type, arguments)
      , i = 0
      , l = transforms.length
    for (; i < l; i++) {
      val = transforms[i].call(type, val)
    }
    return val
  }
  type.transform = function (fn) {
    return StructType(descr, transforms.concat([ fn ]))
  }

  if (type.write == null) {
    type.write = function () {
      throw new Error('unimplemented')
    }
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