/*eslint-disable no-console, no-unused-vars */

/*
https://github.com/jsdom/jsdom/issues/1272
*/

const fs = require('fs')
const path = require('path')
const mime = require('mime-types')

const { JSDOM } = require('jsdom')
const dom = new JSDOM(`
<!DOCTYPE html>
<body>
  <input type="file">
</body>
`)

const { window } = dom
const { document, File, ArrayBuffer, FileList } = window


const file_paths = [
  '/Users/williamrusnack/Documents/form_database/test/try-input-file.html',
  '/Users/williamrusnack/Documents/form_database/test/try-jsdom-input-file.js',
]

function createFile(file_path) {
  const { mtimeMs: lastModified, size } = fs.statSync(file_path)

  return new File(
    [new ArrayBuffer(size)],  // needs to put in the actual data
    path.basename(file_path),
    {
      lastModified,
      type: mime.lookup(file_path) || '',
    }
  )
}

function addFileList(input, file_paths) {
  if (typeof file_paths === 'string')
    file_paths = [file_paths]
  else if (!Array.isArray(file_paths)) {
    throw new Error('file_paths needs to be a file path string or an Array of file path strings')
  }

  const file_list = file_paths.map(fp => createFile(fp))
  file_list.__proto__ = Object.create(FileList.prototype)

  Object.defineProperty(input, 'files', {
    value: file_list,
    writeable: false,
  })

  return input
}



const input = document.querySelector('input')
addFileList(input, file_paths)


console.log('input.files.length', input.files.length)
console.log('input.files[0]', input.files[0])
console.log()



const file_list = input.files
for (let i = 0; i < file_list.length; ++i) {
  const file = file_list[i]
  console.log('file', file)
  console.log('file.name', file.name)
  console.log('file.size', file.size)
  console.log('file.type', file.type)
  console.log('file.lastModified', file.lastModified)
  console.log()
}











