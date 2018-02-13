const { addFileList } = require('addFileList')

// create a jsdom page with a file input
const { JSDOM } = require('jsdom')
const dom = new JSDOM(`
  <!DOCTYPE html>
  <html>
  <head></head>
  <body>
    <input type="file">
  </body>
  </html>
`)
const { document } = dom.window


const input = document.querySelector('input[type=file]')

// add a single file
addFileList(input, 'example.js')

// log input's FileList
console.log(input.files)

// log file properties
const [ file ] = input.files
console.log(file)
console.log(
  '\nlastModified', file.lastModified,
  '\nname', file.name,
  '\nsize', file.size,
  '\ntype', file.type,
  '\n'
)

