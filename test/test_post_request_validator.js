/*eslint-disable no-unused-vars, no-console */
/*global __dirname, describe, context, it, before, beforeEach, after, afterEach */

const post_request_validator = require('../post_request_validator.js')

const combineErrors = require('combine-errors')

const path = require('path')

const Joi = require('joi')
const express = require('express')
const supertest = require('supertest')

const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai

require('./unhandled.js')

const schema_dir = path.join(__dirname, 'form_schemas')
const schema_path = path.join(schema_dir, 'form_test_schema.js')
const schema = require(schema_path)


describe.only('validate schema', function() {
  describe('throw error when', function() {
    it('schema is not an Object', function() {
      const schema = []

      return expect( post_request_validator(schema) )
        .to.be.rejectedWith('"value" must be an object')
    })

    it('schema values are not Arrays', function() {
      const schema = {form0: 'not an Array'}

      return expect( post_request_validator(schema) )
        .to.be.rejectedWith('child "form0" fails because ["form0" must be an array]')
    })

    it('schema Arrays must contain Objects', function() {
      const schema = {
        form: ['not an object'],
      }

      return expect( post_request_validator(schema) )
        .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because ["0" must be an object]]')
    })
  })

  describe('attribute', function() {
    describe('"name"', function() {
      it('throw error when undefined', function() {
        const schema = {
          form: [
            {
              // name undefined
              validate: () => {},
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0].name cannot be undefined')
      })

      it('throw error when not a string', function() {
        const schema = {
          form: [
            {
              name: [], // is not a string
              validate: () => {},
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0].name has to be a string')
      })

      it.skip('throw error when empty string', function() {
        const schema = {
          form: [
            {
              name: '', // empty string
              validate: () => {},
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0].name string must have at lease one character')
      })

      it.skip('throw error when two names are the same in an Array', function() {
        const schema = {
          form: [
            {
              name: 'same_name', // same name
              validate: () => {},
            },
            {
              name: 'same_name', // same name
              validate: () => {},
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0] and schema.form[0] have the same name')
      })
    })

    describe.skip('"validate"', function() {
      it('throw error when missing', function() {
        const schema = {
          form: [
            {
              name: 'name',
              // validate is undefined
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0].validate cannot be undefined')
      })

      it('throw error when not a Joi Object nor a function', function() {
        const schema = {
          form: [
            {
              name: 'name',
              validate: 'string',
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0].validate must be a Joi Object or function')
      })

      describe.skip('can be a', function() {
        it('Joi Object', function() {
          const schema = {
            form: [
              {
                name: 'name',
                validate: Joi.any(),
              },
            ],
          }

          return post_request_validator(schema)
        })

        it('function', function() {
          const schema = {
            form: [
              {
                name: 'name',
                validate: function() {},
              },
            ],
          }

          return post_request_validator(schema)
        })
      })

      it('has top be undefined when "form_skip" is true', function() {
        const schema = {
          form: [
            {
              name: 'name',
              validate: Joi.any(),
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('schema.form[0].validate must be undefined when "form_skip" is true')
      })
    })
  })
})


describe('catch validation errors', function() {

  let request
  beforeEach(async function() {

    const app = express()
    try {
      app.use('/', await post_request_validator(schema))
    } catch(err) {
      throw combineErrors([new Error('Problem creating app'), err])
    }
    app.use(function(req, res) {
      res.status(500)
      res.send('was not caught by routes')
    })
    app.use(function(err, req, res, next) {
      // render the error page
      res.status(err.status || 500)
      res.send('error')
    })

    request = supertest(app)
  })

  it('Content-Type is wrong', function() {
    const post_to = 'form0'

    return request
      .post('/' + post_to)
      .timeout({
        response: 100,
        deadline: 200,
      })
      .type('json')
      .send({input0: 'goodVal'}) // this has to be send
      .expect(400, 'Wrong Content-Type of "application/json"" when expecting "multipart/form-data"')
  })

  it('has extra input fields', function() {
    const post_to = 'form0'

    return request
      .post('/' + post_to)
      .field({
        input0: 'hi there',
        bad_field: 'bad_field',
        bad_field_2: 'bad_field_2',
      })
      .expect(400, 'Unexpected body fields: bad_field, bad_field_2')
  })

  it('missing required input fields', function() {
    const post_to = 'form1'

    return request
      .post('/' + post_to)
      .field({
        input1: 'hi there',
      })
      .expect(400, 'Missing required body fields: input0, input2')
  })

  it('body cannot contain form_skip=true elements', function() {
    const post_to = 'database_only'

    return request
      .post('/' + post_to)
      .field({
        db0: '',
        db1: '',
        input0: '',
        input1: '',
      })
      .expect(400, 'Unexpected body fields: db0, db1')
  })

  it('multiple validation errors sent back', async function() {
    const post_to = 'form2'

    const { body } = await request
      .post('/' + post_to)
      .field({
        input0: 'not a number',
        input1: '1',
        input2: '12',
      })
      .expect(400)

    expect(body).to.eql({
      input0: 'must only contain alpha-numeric characters',
      input2: 'length must be at least 3 characters long',
    })
  })
})

describe('file validation', function() {
  it('returns 400 error on file validation error')
  it('empty file')
})

it('needs default security checks')

