# awestruct change log

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](http://semver.org/).

# 1.1.3 / 2019-02-26
- Improve performance when reading many of the same type of objects.

# 1.1.2 / 2018-09-04
- Fixes for writing nested structs.

# 1.1.1 / 2018-09-02
- Speed up `type.read()` calls.

# 1.1.0 / 2018-09-01
- Add dynarray & dynstring for dynamic array/string sizes. This is a more friendly way to implement the common length-prefixed array/string type, without having to add a dummy `length` field to the object.
- Support differently sized elements in arrays. Byte sizes for arrays with variable-size elements are now calculated correctly.

# 1.0.0 / 2017-10-29
- Fields can now be abstract-encoding compatible type objects
- Fields can now be specified as an array of [name, type] pairs. The array syntax also allows bare types,
  whose value will be merged into the struct. This allows embedding different structs without nesting.
- Check input type in `.encode()`.

# 0.12.3 / 2017-04-08
- Use `safe-buffer` module and remove `Buffer.alloc` feature detection.

# 0.12.2 / 2017-01-18
- Make `buffer` type writable ([#16](https://github.com/goto-bus-stop/awestruct/pull/16)
  by [@Iwasawafag](https://github.com/Iwasawafag))

# 0.12.1 / 2016-10-26
- Use new Buffer APIs if available, for compatibility with Node v7+
- Upgrade dependencies

# 0.12.0 / 2016-04-26
- pass current struct as the first parameter to function value paths,
  so arrow functions can be used:

  ```js
  Struct.types.if((currentStruct) => currentStruct.shouldReadThisThing, ...)
  ```

# 0.11.1 / 2016-01-01
- unbork publish

# 0.11.0 / 2016-01-01
- es6 :tada:
- add read and write mapping functions instead of only read transforms

# 0.10.0 / 2015-02-28
- add `buffer` type
- rename `char` type to `string` (deprecate `char`)
- fix reading more stuff after a nested struct

# 0.9.1 / 2015-02-22
- fix accessing parent structs from value paths
