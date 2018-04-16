/*
Allows files to be added to jsdom input elements.

addFileList(input, file_paths)
  Effects: puts the file_paths as File object in input.files as a FileList
  Returns: input
  Arguments:
    input - HTML input element
    file_paths
      - String of a file path
      - Array of strings of file paths

Read File Example:
  const input = document.querySelector('input[type=file]')

  addFileList(input, 'path/to/file')
  const file = input.files[0]

  const fr = new FileReader()
  fr.readAsText(file)

  fr.onload = () => {
    console.log('fr.result', fr.result)
    console.log('fr.result.length', fr.result.length)
  }

Unresolved jsdom issue that references this:
https://github.com/jsdom/jsdom/issues/1272
*/

const fs = require('fs')
const path = require('path')
const mime = require('mime-types')

const { JSDOM } = require('jsdom')
const { File, FileList } = (new JSDOM()).window


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
    writable: false,
  })

  return input
}

function createFile(file_path) {
  const { mtimeMs: lastModified } = fs.statSync(file_path)

  return new File(
    [new fs.readFileSync(file_path)],
    path.basename(file_path),
    {
      lastModified,
      type: mime.lookup(file_path) || '',
    }
  )
}


module.exports = {
  addFileList,
  createFile,
}
