/*eslint-disable no-console, no-unused-vars */

/*
https://github.com/jsdom/jsdom/issues/1272
*/

// const fs = require('fs')
// const path = require('path')
// const mime = require('mime-types')

// const { JSDOM } = require('jsdom')
// const dom = new JSDOM(`
// <!DOCTYPE html>
// <body>
//   <input type="file">
// </body>
// `)

const path = require('path')
const Joi = require('joi')
const { createFile } = require('./addFileList.js')


// const { window } = dom
// const { document, File, ArrayBuffer, FileList } = window



const file = createFile(path.resolve('./addFileList.js'))

// console.log('file.size.call', file.size.call)
const validator = Joi.object().keys({
  size: Joi.number().less(1000000),
})

const FileProperities = [
  'lastModified',
  'name',
  'size',
  'type',
]
let copy = {}
for (let fpi = FileProperities.length - 1; fpi >= 0; --fpi) {
  const prop = FileProperities[fpi]
  copy[prop] = file[prop]
}
copy = Object.freeze(copy)
console.log('copy', copy)

const validated = validator.validate(copy)
console.log('validated', validated)

