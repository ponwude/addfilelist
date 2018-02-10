/*global __dirname, describe, context, it, beforeEach, afterEach, Buffer */

const post_to_database = require('../post_to_database.js')

const path = require('path')

const combineErrors = require('combine-errors')

const chai = require('chai')
chai.use(require('chai-as-promised'))
chai.should()
const { expect } = chai

const sinon = require('sinon')

require('./unhandled.js')

const express = require('express')
const supertest = require('supertest')
const multer = require('multer')

const KNEX = require('knex')
const Joi = require('joi')
const _ = require('lodash')


context('fresh database', function() {
  this.timeout(200)

  let knex_db, db_destroyed = true
  async function new_database() {
    if (db_destroyed) {
      knex_db = KNEX({
        client: 'sqlite3',
        connection: {filename: ':memory:'},
        useNullAsDefault: true,
      })

      db_destroyed = false
    }
  }
  async function destroy_database() {
    await knex_db.destroy()
    db_destroyed = true
  }

  beforeEach(new_database)
  afterEach(destroy_database)

  it('schemas can be a file path string', function() {
    const schema_path = path.join(__dirname, 'test_post_to_database_files', 'simple_schema.js')
    return post_to_database(knex_db, schema_path)
  })

  describe('schemas errors', function() {
    it('name must be defined', function() {
      const schemas = {
        missing_name: [
          {
            validate: Joi.number(),
            database_type: 'float',
          },
        ],
      }

      return expect(post_to_database(knex_db, schemas))
        .to.be.rejectedWith('child "missing_name" fails because ["missing_name" at position 0 fails because [child "name" fails because ["name" is required]]]')
    })

    it('database_type must be a string', async function() {
      const schemas = {
        form: [
          {name: 'input', database_type: undefined},
        ],
      }

      return expect( post_to_database(knex_db, schemas) )
        .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "database_type" fails because ["database_type" is required]]]')
    })

    it('allow unknown keys', async function() {
      const schemas = {
        form: [
          {name: 'input', database_type: 'string', unknown_key: 'hi'},
        ],
      }

      return post_to_database(knex_db, schemas)
    })

    describe('generate', function() {
      it('has to be a function', async function() {
        const schemas = {
          form: [
            {name: 'input', database_type: 'string', generate: 'not a function'},
          ],
        }

        return expect( post_to_database(knex_db, schemas) )
          .to.be.rejectedWith('child "form" fails because ["form" at position 0 fails because [child "generate" fails because ["generate" must be a Function]]]')
      })

      it('has to be defined if form_skip = true (still deciding if this is a good thing or not)')
    })

  })

  describe('database initialized correctly', function() {
    describe('new table created', function() {

      it('table created for each form', async function() {
        const schemas = {
          form0: [
            {name: 'input0', database_type: 'string'},
          ],
          form1: [
            {name: 'input0', database_type: 'float'},
            {name: 'input1', database_type: 'string'},
          ],
          form2: [
            {name: 'input0', database_type: 'string'},
            {name: 'input1', database_type: 'float'},
            {name: 'input2', database_type: 'float'},
          ],
        }
        await post_to_database(knex_db, schemas)

        for (const table in schemas) {
          if (schemas.hasOwnProperty(table)) {
            expect( await knex_db.schema.hasTable(table), `missing table: ${table}` )
              .to.be.true
          }
        }
      })

      it('new table\'s columns have correct data type', async function() {
        const schemas = {
          form1: [
            {name: 'input0', database_type: 'float'},
            {name: 'input1', database_type: 'string'},
            {name: 'input2', database_type: 'string'},
          ],
        }

        await post_to_database(knex_db, schemas)

        const col_info = await knex_db('form1').columnInfo()

        expect(col_info['input0'].type).to.equal('float')
        expect(col_info['input1'].type).to.equal('varchar')
        expect(col_info['input2'].type).to.equal('varchar')
      })
    })


    describe('existing table', function() {
      it('is not replaced', async function() {
        const schemas = {form0: [{name: 'input0', database_type: 'string'}]}

        // create table before calling post_to_database
        await knex_db.schema.createTable('form0', function (table) {
          table.string('input0')
        })

        // pre-insert data into data
        const pre_data = {input0: 'this should remain in table'}
        await knex_db('form0').insert(pre_data)

        await post_to_database(knex_db, schemas)

        const rows = await knex_db.select('input0').from('form0')
        rows.should.have.a.lengthOf(1)
        rows[0].should.to.eql(pre_data)
      })

      it('form schema and table has column mismatch', async function() {
        const table = 'form0'
        const table_columns = [
          'table_column_0',
          'table_column_1',
        ]
        await knex_db.schema.createTable(table, tb => {
          table_columns.forEach(bc => tb.string(bc))
        })

        const schemas = {}
        schemas[table] = [
          {
            name: 'schema_column_0',
            database_type: 'string',
          },
          {
            name: 'schema_column_1',
            database_type: 'string',
          },
        ]

        return expect( post_to_database(knex_db, schemas) )
          .to.be.rejectedWith(`Existing table (${table}) and schemas have the mismatched column names of: schema_column_0, schema_column_1, table_column_0, table_column_1`)
      })

      it('has matching data types') // columnInfo does not have matching type and schema building functions
    })
  })

  context('express app', function() {

    let router_error = undefined
    afterEach(() => {
      if (router_error !== undefined) {
        const err = router_error
        router_error = undefined
        throw err
      }
    })

    async function load_request_handler(schemas, is_validated=true) {
      const app = express()

      // handle files
      app.use(multer({storage: multer.memoryStorage()}).any())
      app.use((req, res, next) => {
        req.files = _.groupBy(req.files, 'fieldname')
        next()
      })

      app.use((req, res, next) => {
        req.is_validated = is_validated
        next()
      })

      try {
        app.use(await post_to_database(knex_db, schemas))
      } catch(err) {
        throw combineErrors([new Error('Problem creating app'), err])
      }

      app.use((req, res, next) => { //eslint-disable-line no-unused-vars
        throw new Error('post_to_database did not send response')
      })

      app.use((err, req, res, next) => { //eslint-disable-line no-unused-vars
        const error_message = 'middleware error'
        res.status(500).send(error_message)
        router_error = err
      })

      return supertest(app)
    }

    it('500 if is_validated is not true', async function() {
      const schemas = {
        form: [
          {
            name: 'file_field',
            database_type: 'string',
          },
        ],
      }

      const request = await load_request_handler(schemas, false)

      await request
        .post('/form')
        .field({file_field: 'something'})
        .expect(500, 'Request was not validated. Please use the post_request_validator.')

      const rows = await knex_db.select().from('form')
      rows.should.have.lengthOf(0)
    })

    it('text fields are inserted into database', async function() {
      const schemas = {
        field_form: [
          {
            name: 'field_1',
            database_type: 'string',
          },
          {
            name: 'field_2',
            database_type: 'string',
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const data_obj = {
        field_1: 'field_1 value',
        field_2: 'field_2 value',
      }

      await request
        .post('/field_form')
        .field(data_obj)
        .expect(200)

      const rows = await knex_db.select().from('field_form')
      rows.should.have.a.lengthOf(1)
      rows[0].should.eql(data_obj)
    })

    it('no error thrown when expected field is undefined', async function() {
      const schemas = {
        field_form: [
          {
            name: 'field_1',
            database_type: 'string',
          },
          {
            name: 'field_2',
            database_type: 'string',
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const data_obj = {field_1: 'field_1 value'}

      await request
        .post('/field_form')
        .field(data_obj)
        .expect(200)

      const rows = await knex_db.select().from('field_form')
      rows.should.have.a.lengthOf(1)
      rows[0].should.eql(Object.assign({field_2: null}, data_obj))
    })

    it('ignores extra body fields and files fields', async function() {
      const schemas = {
        less_fields: [
          {
            name: 'text_field',
            database_type: 'string',
          },
          {
            name: 'file_field',
            database_type: 'string',
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const expected_fields = {
        text_field: 'this is the text field',
        file_field: 'text for file',
      }

      await request
        .post('/less_fields')
        .field(_.pick(expected_fields, 'text_field'))
        .attach('file_field', buff(expected_fields.file_field), 'expected.txt')
        .attach('unexpected_file', buff('unexpected file text'), 'unexpected.txt')
        .expect(200)

      const rows = await knex_db.select().from('less_fields')
      rows.should.have.a.lengthOf(1)
      rows[0].should.eql(expected_fields)
    })

    it('inserts file to database', async function() {
      const schemas = {
        form: [
          {
            name: 'file_field_1',
            attr: {type: 'file'},
            database_type: 'string',
          },
          {
            name: 'file_field_2',
            attr: {type: 'file'},
            database_type: 'string',
          },
        ],
      }

      const request = await load_request_handler(schemas)

      const file_contents_1 = 'hi there'
      const file_contents_2 = 'how are you'

      await request
        .post('/form')
        .attach('file_field_1', buff(file_contents_1), 'hi_there.txt')
        .attach('file_field_2', buff(file_contents_2), 'how_are_you.txt')
        .expect(200)

      const rows = await knex_db.select().from('form')
      rows.should.have.a.lengthOf(1)
      rows[0].should.eql({
        file_field_1: file_contents_1,
        file_field_2: file_contents_2,
      })
    })

    it('throws error if more than one file per field', async function() {
      const schemas = {
        form: [
          {
            name: 'file_field',
            attr: {type: 'file'},
            database_type: 'string',
          },
        ],
      }

      const request = await load_request_handler(schemas)

      await request
        .post('/form')
        .attach('file_field', buff('one'), 'one.txt')
        .attach('file_field', buff('two'), 'two.txt')
        .expect(400, '"file_field" must contain less than or equal to 1 items')

      const rows = await knex_db.select().from('form')
      rows.should.have.a.lengthOf(0)
    })

    describe('generate returned value is put into the database', function() {
      [
        ['sync', () => 'sync gen', 'sync gen'],
        ['async', async () => 'async gen', 'async gen'],
      ].forEach(([func_type, generate, col_val]) => {
        it(func_type, async function() {
          const schemas = {
            cool_table: [
              {
                name: 'col_val',
                form_skip: true,
                database_type: 'string',
                generate,
              },
            ],
          }

          const request = await load_request_handler(schemas)

          await request
            .post('/cool_table')
            .field({})
            .expect(200)

          const rows = await knex_db.select().from('cool_table')
          rows.should.have.a.lengthOf(1)
          rows[0].should.eql({col_val})
        })
      })
    })

    it('generate function is called with insert_data as the input argument', async function() {
      const text_spy = sinon.spy(insert_data => 'text_spy'), //eslint-disable-line no-unused-vars
            file_spy = sinon.spy(insert_data => 'file_spy') //eslint-disable-line no-unused-vars

      const schemas = {
        generate_values: [
          {
            name: 'gen_1',
            form_skip: true,
            database_type: 'string',
            generate: text_spy,
          },
          {
            name: 'gen_2',
            form_skip: true,
            database_type: 'string',
            generate: file_spy,
          },
        ],
      }

      const request = await load_request_handler(schemas)

      await request
        .post('/generate_values')
        .field({})
        .expect(200)

      const rows = await knex_db.select().from('generate_values')
      rows.should.have.a.lengthOf(1)
      rows[0].should.eql({gen_1: 'text_spy', gen_2: 'file_spy'})

      text_spy
    })
  })
})


function buff(str) {
  return Buffer.from(str, 'utf8')
}
