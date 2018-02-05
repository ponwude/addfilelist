/*eslint-disable no-unused-vars, no-console */

/*
Loads a schema from file or passes the schema object through.

Throws error if file_path is a string and it is a bad file paht.
*/

const fs = require('then-fs')


async function load_schema(file_path) {
  if (typeof file_path === 'string') {
    if (!file_path.startsWith('/')) throw new Error('Must be absolute file path')

    await fs.access(file_path) // schemas path exists
    return require(file_path)
  }

  return file_path
}


module.exports = load_schema
