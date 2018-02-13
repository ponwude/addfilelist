# addFileList
Put files into jsdom file inputs.
Solves unresolved jsdom issue https://github.com/jsdom/jsdom/issues/1272

## Intended Use
Add one file:
```javascript
const input = document.querySelector('input[type=file]')
addFileList(input, 'path/to/file')
```
Add multiple files:
```javascript
const input = document.querySelector('input[type=file]')
addFileList(input, [
  'path/to/file',
  'path/to/another/file',
  // add as many as you want
])
```

## Install and Require
```sh
npm install https://github.com/BebeSparkelSparkel/addFileList.git
```
```javascript
const { addFileList } = require('addFileList')
```

## Functions
**addFileList**(input, file_paths)  
Effects: puts the file_paths as File object into input.files as a FileList  
Returns: input  
Arguments:  
- input: HTML input element  
- file_paths: String or Array of string file paths to put in input.files  
`const { addFileList } = require('addFileList')`  

**createFile**(file_path)  
Returns a File object created from file at file_path  
`const { createFile } = require('addFileList')`  

## Example
Extract from example.js
```javascript
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
```
Result
```sh
$ node example.js 
FileList [ File {} ]
File {}

lastModified 1518523506000 
name example.js 
size 647 
type application/javascript 
```

## Read File Example
Extract from read_file_example.js
```javascript
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
```
