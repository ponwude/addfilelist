/*eslint-disable no-unused-vars, no-console */
/*global __dirname, describe, context, it, before, beforeEach, after, afterEach */

const load_schema = require('../load_schema.js')

const path = require('path')

const _ = require('lodash')


const chai = require('chai')
chai.use(require('chai-as-promised'))
chai.should()

require('./unhandled.js')


function resolve_schema_path(file_name) {
  return path.join(__dirname, 'form_schemas', file_name)
}

/* Structure is: { 'file_name.js': file_name_object, ... } */
const schemas = _.fromPairs([
  'form_test_schema.js',
  'single_form_schema.js',
].map(fn => [fn, require(resolve_schema_path(fn))]))


describe('load_schema', function() {
  it('absolute file path', async function() {
    const file_name = 'form_test_schema.js'
    const obj = await load_schema(resolve_schema_path(file_name))

    obj.should.eql(schemas[file_name])
  })

  it('object passed through', async function() {
    const obj = {object: 'passed through'}
    const returned = await load_schema(obj)

    returned.should.eql(obj)
  })

  it('array passed through', async function() {
    const array = ['array', 'passed', 'through']
    const returned = await load_schema(array)

    returned.should.eql(array)
  })

  it('bad file path', function() {
    const file_path = resolve_schema_path('bad_file_path')
    return load_schema(file_path)
      .should.be.rejectedWith(`ENOENT: no such file or directory, access '${file_path}'`)
  })

  describe('errors on relative file path', function() {
    it('file name', function() {
      const file_path = 'hi'
      return load_schema(file_path)
        .should.be.rejectedWith('Must be absolute file path')
    })

    it('current directory', function() {
      const file_path = '.'
      return load_schema(file_path)
        .should.be.rejectedWith('Must be absolute file path')
    })

    it('up one directory', function() {
      const file_path = '..'
      return load_schema(file_path)
        .should.be.rejectedWith('Must be absolute file path')
    })
  })

})
