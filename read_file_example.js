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
const { window } = dom
const { document, FileReader } = window

// add the file to input's FileList
const input = document.querySelector('input[type=file]')
addFileList(input, 'read_file_example.js')

// read the file contents
const [ file ] = input.files
const reader = new FileReader()
reader.readAsText(file)

reader.onload = () => {
  console.log('reader.result', reader.result) // logs whole file
  console.log('reader.result.length', reader.result.length) // logs length of file
}

