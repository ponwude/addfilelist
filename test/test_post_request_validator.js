/*global __dirname, describe, it, before, beforeEach */

const post_request_validator = require('../post_request_validator.js')

const combineErrors = require('combine-errors')

const path = require('path')
const fs = require('then-fs')

const Joi = require('joi')
const express = require('express')

const supertest = require('supertest')

const chai = require('chai')
chai.use(require('chai-as-promised'))
chai.use(require('sinon-chai'))
chai.should()
const { expect } = chai

const sinon = require('sinon')

require('./unhandled.js')


let req_validated = undefined
beforeEach(() => {req_validated = undefined})
async function load_request_handler(schemas) {
  const app = express()

  try {
    app.use('/', await post_request_validator(schemas))
  } catch(err) {
    throw combineErrors([new Error('Problem creating app'), err])
  }

  app.use((req, res) => {
    req_validated = req
    res.status(200).send('validation success')
  })

  app.use((err, req, res, next) => { //eslint-disable-line no-unused-vars
    // render the error page
    res.status(err.status || 500).send('error')
  })

  return supertest(app)
}


describe('validate schema', function() {
  it('can accept a file path', function() {
    const file_path = resolve_path('good_schema.js')

    return post_request_validator(file_path)
  })

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
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "name" fails because ["name" is required]]]')
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
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "name" fails because ["name" must be a string]]]')
      })

      it('throw error when empty string', function() {
        const schema = {
          form: [
            {
              name: '', // empty string
              validate: () => {},
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "name" fails because ["name" is not allowed to be empty]]]')
      })

      it('throw error when two names are the same in an Array', function() {
        // should provide a better error message

        const schema = {
          form: [
            {
              name: 'same_name', // same name
              validate: function(a) {}, //eslint-disable-line no-unused-vars
            },
            {
              name: 'same_name', // same name
              validate: function(a) {}, //eslint-disable-line no-unused-vars
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('child "form" fails because ["form" position 1 contains a duplicate value]')
      })
    })

    describe('"validate"', function() {
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
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "validate" fails because ["validate" is required]]]')
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
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "validate" fails because ["validate" must be an object, "validate" must be a Function]]]')
      })

      describe('can be a', function() {
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
                validate: function(a) {}, //eslint-disable-line no-unused-vars
              },
            ],
          }

          return post_request_validator(schema)
        })
      })

      it('has to be undefined when "form_skip" is true', function() {
        const schema = {
          form: [
            {
              name: 'name',
              validate: Joi.any(),
              form_skip: true,
            },
          ],
        }

        return expect( post_request_validator(schema) )
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "validate" fails because ["validate" is not allowed]]]')
      })
    })
  })

  describe('can have unhandled keys', function() {
    it('form_skip=undefined', function() {
      const schema = {
        form: [
          {
            name: 'name',
            validate: Joi.any(),
            another_key: 'hi',
          },
        ],
      }

      return post_request_validator(schema)
    })

    it('form_skip=true', function() {
      const schema = {
        form: [
          {
            name: 'name',
            form_skip: true,
            another_key: 'hi',
          },
        ],
      }

      return post_request_validator(schema)
    })
  })

  describe('case insenstive attr', function() {
    // cache makes the second two run faster than the first
    ['file', 'File', 'FILE'].forEach(file_case => {
      it(file_case, async function() {
        const validate_spy = sinon.spy(file => {}) //eslint-disable-line no-unused-vars
        const schema = {
          form: [
            {
              name: file_case,
              attr: {type: file_case},
              validate: validate_spy,
            },
          ],
        }

        const request = await load_request_handler(schema)

        await request
          .post('/form')
          .attach(file_case, resolve_path('simple.txt'))
          .expect(200)

        validate_spy.should.have.been.calledOnce
      })
    })
  })
})


describe('catch validation errors', function() {

  it('Content-Type is wrong', async function() {
    const request = await load_request_handler({url_path: []})

    return request
      .post('/url_path')
      .timeout({
        response: 100,
        deadline: 200,
      })
      .type('json')
      .send({input0: 'goodVal'}) // this has to be send
      .expect(400, 'Wrong Content-Type of "application/json"" when expecting "multipart/form-data"')
  })

  it('has extra input fields', async function() {
    const schemas = {
      extra_input_fields: [
        {
          name: 'good_field',
          validate: Joi.any(),
        },
      ],
    }
    const request = await load_request_handler(schemas)

    return request
      .post('/extra_input_fields')
      .field({
        good_field: 'good_field value',
        bad_field: 'bad_field value',
        bad_field_2: 'bad_field_2 value',
      })
      .expect(400, 'Unexpected body fields: bad_field, bad_field_2')
  })

  it('missing required input fields', async function() {
    const schemas = {
      missing_inputs: [
        {name: 'input0', validate: Joi.any()},
        {name: 'input1', validate: Joi.any()},
        {name: 'input2', validate: Joi.any()},
      ],
    }
    const request = await load_request_handler(schemas)

    return request
      .post('/missing_inputs')
      .field({
        input1: 'hi there',
      })
      .expect(400, 'Missing required body fields: input0, input2')
  })

  it('body cannot contain form_skip=true elements', async function() {
    const schemas = {
      database_only: [
        {name: 'db0', form_skip: true},
        {name: 'db1', form_skip: true},
        {name: 'input0', validate: Joi.any()},
      ],
    }
    const request = await load_request_handler(schemas)

    return request
      .post('/database_only')
      .field({
        db0: '',
        db1: '',
        input0: '',
        input1: '',
      })
      .expect(400, 'Unexpected body fields: db0, db1, input1')
  })

  it('multiple validation errors sent back', async function() {
    const schemas = {
      multiple_errors: [
        {name: 'input0', validate: Joi.string().alphanum() },
        {name: 'input1', validate: Joi.any() },
        {name: 'input2', validate: Joi.string().min(3) },
      ],
    }
    const request = await load_request_handler(schemas)

    const { body } = await request
      .post('/multiple_errors')
      .field({
        input0: '%)(&T^*&^*',
        input1: 'hi',
        input2: '12',
      })
      .expect(400)
      .expect('Content-Type', /json/)

    expect(body).to.eql({
      input0: 'must only contain alpha-numeric characters',
      input2: 'length must be at least 3 characters long',
    })
  })

  describe('validate can be a function', function() {

    let request
    const error_msg = 'is a sync error'
    const change_val = 'change val'
    before(async function() {
      const schemas = {
        sync_no_error: [{
          name: 'input',
          validate: value => {}, //eslint-disable-line no-unused-vars
        }],
        sync_error: [{
          name: 'input',
          validate: value => {throw new Error(error_msg)}, //eslint-disable-line no-unused-vars
        }],
        sync_change_val: [{
          name: 'input',
          validate: value => change_val, //eslint-disable-line no-unused-vars
        }],
        async_no_error: [{
          name: 'input',
          validate: value => Promise.resolve(), //eslint-disable-line no-unused-vars
        }],
        async_error: [{
          name: 'input',
          validate: value => Promise.reject(new Error(error_msg)), //eslint-disable-line no-unused-vars
        }],
        async_change_val: [{
          name: 'input',
          validate: value => Promise.resolve(change_val), //eslint-disable-line no-unused-vars
        }],
      }

      request = await load_request_handler(schemas)
    })

    describe('sync', function() {
      it('no error', function() {
        return request
          .post('/sync_no_error')
          .field({input: 'hi'})
          .expect(200)
      })

      it('error', async function() {
        const { body } = await request
          .post('/sync_error')
          .field({input: 'hi'})
          .expect('Content-Type', /json/)
          .expect(400)

        expect( body ).to.eql({input: error_msg})
      })

      it('change value', async function() {
        await request
          .post('/sync_change_val')
          .field({input: 'hi'})
          .expect(200)

        expect( req_validated.body )
          .to.eql({input: change_val})
      })
    })

    describe('async', function() {
      it('no error', function() {
        return request
          .post('/async_no_error')
          .field({input: 'hi'})
          .expect(200)
      })

      it('error', async function() {
        const { body } = await request
          .post('/async_error')
          .field({input: 'hi'})
          .expect('Content-Type', /json/)
          .expect(400)

        expect( body ).to.eql({input: error_msg})
      })

      it('change value', async function() {
        await request
          .post('/async_change_val')
          .field({input: 'hi'})
          .expect(200)

        expect( req_validated.body )
          .to.eql({input: change_val})
      })
    })
  })

  describe('file validation', function() {
    it('validate called with a multer file object', async function() {
      const file_name = 'simple.txt',
            file_path = resolve_path(file_name)

      const multer_file_obj = {
        fieldname: 'file_in',
        originalname: file_name,
        size: (await fs.stat(file_path)).size,
        buffer: await fs.readFile(file_path),
        encoding: '7bit',
        mimetype: 'text/plain',
      }

      const validate_spy = sinon.spy(file => {}) //eslint-disable-line no-unused-vars

      const schemas = {
        file_req: [
          {
            name: multer_file_obj.fieldname,
            attr: {type: 'file'},
            validate: validate_spy,
          },
        ],
      }

      const request = await load_request_handler(schemas)

      await request
        .post('/file_req')
        .attach(multer_file_obj.fieldname, file_path)
        .expect(200)

      validate_spy.should.have.been.calledOnce
      validate_spy.firstCall.args.should.have.lengthOf(1)
      validate_spy.firstCall.args[0].should.eql(multer_file_obj)
    })

    it('returns 400 error on file validation error', async function() {
      const error_text = 'file validation error'
      const schemas = {
        file_req: [
          {
            name: 'file_in',
            attr: {type: 'file'},
            validate: file => {throw new Error(error_text)}, //eslint-disable-line no-unused-vars
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const { body } = await request
        .post('/file_req')
        .attach('file_in', resolve_path('simple.txt'))
        .accept('json')
        .expect('Content-Type', /json/)
        .expect(400)

      body.should.eql({file_in: error_text})
    })

    it('multiple file fields', async function() {
      const spy_valid = sinon.spy(file => {}) //eslint-disable-line no-unused-vars
      const error_text = 'bad validation',
            spy_invalid = sinon.spy(file => {throw new Error(error_text)}) //eslint-disable-line no-unused-vars

      const schemas = {
        form_hi: [
          {
            name: 'file_1',
            attr: {type: 'File'},
            validate: spy_valid,
          },
          {
            name: 'file_2',
            attr: {type: 'FILE'},
            validate: spy_invalid,
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const { body } = await request
        .post('/form_hi')
        .attach('file_1', resolve_path('simple.txt'))
        .attach('file_2', resolve_path('digets.txt'))
        .expect(400)

      body.should.eql({file_2: error_text})

      spy_valid.should.have.been.calledOnce
      spy_invalid.should.have.been.calledOnce

      spy_valid.firstCall.args[0].originalname
        .should.equal('simple.txt')
      spy_invalid.firstCall.args[0].originalname
        .should.equal('digets.txt')
    })

    it('multiple files with the same fieldname', async function() {
      const validate_spy = sinon.spy(file => {}) //eslint-disable-line no-unused-vars
      const schemas = {
        file_req: [
          {
            name: 'file_in',
            attr: {type: 'file'},
            validate: validate_spy,
          },
        ],
      }

      const request = await load_request_handler(schemas)

      await request
        .post('/file_req')
        .attach('file_in', resolve_path('digets.txt'))
        .attach('file_in', resolve_path('simple.txt'))
        .expect(200)

      validate_spy.should.have.been.calledTwice

      const file_names = validate_spy.args
        .map(([args]) => args.originalname)
        .sort()

      file_names.should.eql(['digets.txt', 'simple.txt'])
    })

    it('file to undefined field (this should be handled by different middleware)')

    it('joi validator', async function() {
      const schemas = {
        file_req: [
          {
            name: 'file_in',
            attr: {type: 'file'},
            validate: Joi.object({originalname: Joi.valid('not_simple.txt')}),
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const { body } = await request
        .post('/file_req')
        .attach('file_in', resolve_path('simple.txt'))
        .accept('json')
        .expect('Content-Type', /json/)
        .expect(400)

      body.should.eql({file_in: '"originalname" must be one of [not_simple.txt]'})
    })

  })
})


it('needs default security checks')


function resolve_path(file_name) {
  return path.join(
    __dirname,
    'test_post_request_validator_files',
    file_name
  )
}

