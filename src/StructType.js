module.exports = StructType

function StructType(descr) {
  var type = { $structType: true }
  var transforms = []
  
  Object.keys(descr).forEach(function (key) {
    type[key] = descr[key]
  })

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
    transforms.push(fn)
    return type
  }
  
  return type
}