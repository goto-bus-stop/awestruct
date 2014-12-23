module.exports = StructType

function StructType(descr, transforms) {
  var type = function () {
    return type.read.apply(type, arguments)
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

  return type
}