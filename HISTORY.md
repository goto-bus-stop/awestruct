0.12.2 / 2017-01-18
===================

 - Make `buffer` type writable ([#16](https://github.com/goto-bus-stop/awestruct/pull/16)
   by [@Iwasawafag](https://github.com/Iwasawafag))

0.12.1 / 2016-10-26
===================

 - Use new Buffer APIs if available, for compatibility with Node v7+
 - Upgrade dependencies

0.12.0 / 2016-04-26
===================

 - pass current struct as the first parameter to function value paths,
   so arrow functions can be used:

   ```js
   Struct.types.if((currentStruct) => currentStruct.shouldReadThisThing, ...)
   ```

0.11.1 / 2016-01-01
===================

 - unbork publish

0.11.0 / 2016-01-01
===================

 - es6 :tada:
 - add read and write mapping functions instead of only read transforms

0.10.0 / 2015-02-28
===================

 - add `buffer` type
 - rename `char` type to `string` (deprecate `char`)
 - fix reading more stuff after a nested struct

0.9.1 / 2015-02-22
==================

 - fix accessing parent structs from value paths
