/*eslint-disable no-unused-vars, no-console */
/*global __dirname, describe, context, it, before, beforeEach, after, afterEach */

const path = require('path')

const combineErrors = require('combine-errors')

const chai = require('chai')
chai.use(require('chai-as-promised'))
const { expect } = chai

const express = require('express')
const supertest = require('supertest')

const KNEX = require('knex')

const _ = require('lodash')

const post_to_database = require('../post_to_database.js')
const schema_dir = path.join(__dirname, 'form_schemas')
const schema_path = path.join(schema_dir, 'form_test_schema.js')
const schema = require(schema_path)


context('fresh database', function() {

  let knex_db, db_destroyed = true
  const new_database = function() {
    if (db_destroyed) {
      knex_db = KNEX({
        client: 'sqlite3',
        connection: {filename: ':memory:'},
        useNullAsDefault: true,
      })

      db_destroyed = false
    }
  }

  const destroy_database = function() {
    return new Promise(resolve => {
      if (db_destroyed)
        resolve()
      else {
        db_destroyed = true
        knex_db.destroy(resolve)
      }
    })
  }
  before(new_database)
  after(destroy_database)

  it('schema_path is a bad path', function() {
    const bad_path = 'bad file path'
    return expect(post_to_database(knex_db, bad_path))
      .to.be.rejectedWith(`ENOENT: no such file or directory, access '${bad_path}'`)
  })

  it('schema missing validation', async function() {
    const unvalidated_path = path.join(schema_dir, 'undefined_validation.js')

    return expect(post_to_database(knex_db, unvalidated_path))
      .to.be.rejectedWith('validate not defined for columns: input0, input1')
  })

  it('scheam parse error', function() {
    const parse_path = path.join(schema_dir, 'parse_error.js')

    return expect(post_to_database(knex_db, parse_path))
      .to.be.rejectedWith(`Cannot parse javascript file: ${parse_path}`)
  })

  describe('database initialized correctly', function() {
    beforeEach(new_database)
    afterEach(destroy_database)

    describe('new table created', function() {

      it('table created for each form', async function() {
        await post_to_database(knex_db, schema_path)

        for (const table in schema) {
          if (schema.hasOwnProperty(table)) {
            expect( await knex_db.schema.hasTable(table), `missing table: ${table}` )
              .to.be.true
          }
        }
      })

      it('new table\'s columns have correct data type', async function() {
        const table = 'form1'

        await post_to_database(knex_db, schema_path)

        const col_info = await knex_db(table).columnInfo()

        expect(col_info['input0'].type).to.equal('float')
        expect(col_info['input1'].type).to.equal('varchar')
        expect(col_info['input2'].type).to.equal('varchar')
      })
    })


    describe('existing table', function() {
      it('is not replaced', async function() {
        const table_name = 'form0',
              column_name = 'input0'
        await knex_db.schema.createTable(table_name, function (table) {
          table.string(column_name)
        })

        const pre_data = {}
        pre_data[column_name] = 'this should remain in table'
        await knex_db(table_name).insert(pre_data)

        await post_to_database(knex_db, schema_path)

        const [ table_row ] = await knex_db(table_name)
          .select(column_name)
          .where(pre_data)

        expect(table_row).to.eql(pre_data)
      })

      it('has more columns than defined in schema', async function() {
        const table = 'form0'
        const bad_columns = [
          'incorrect_column_name_0',
          'incorrect_column_name_1',
        ]
        await knex_db.schema.createTable(table, tb => {
          bad_columns.forEach(bc => tb.string(bc))
        })

        return expect(post_to_database(knex_db, schema_path))
          .to.be.rejectedWith(`In existing table ${table} unexpected columns found: ${bad_columns.join(', ')}`)
      })

      it('does not have columns defined in schema', async function() {
        const table = 'form1'
        const extra_columns = ['input1', 'input2']

        await knex_db.schema.createTable(table, tb => {
          tb.string('input0')
        })

        return expect(post_to_database(knex_db, schema_path))
          .to.be.rejectedWith(`The existing table ${table} does not have the columns: ${extra_columns.join(', ')}`)
      })

      it.skip('has matching data types', async function() {
        // columnInfo does not have matching type and schema building functions
        const table = 'form1'

        await knex_db.schema.createTable(table, tb => {
          tb.string('input0')
          tb.float('input1')
          tb.string('input2')
        })

        return expect(post_to_database(knex_db, schema_path))
          .to.be.rejectedWith(`Existing table ${table} and form schema have differing data types; column_name: (column_type != schema_type). input0: (string != number), input1: (float != string)`)

          // const unmatched_types = []
          // for (const column in column_info) {
          //   if (column_info.hasOwnProperty(column)) {
          //     const column_type = column_info[column].type,
          //           schema_type = table_schema_obj[column].type
          //     if (column_type !== schema_type) {
          //       console.log('column_type', column_type)
          //       console.log('schema_type', schema_type)
          //       unmatched_types.push({column, column_type, schema_type})
          //     }
          //   }
          // }
          // unmatched_types.sort(({column: a}, {column: b}) => {
          //   if (a === b) return 0
          //   if (a < b) return -1
          //   return 1
          // })
          // if (unmatched_types.length > 0) {
          //   let msg = `Existing table ${table_name} and form schema have differing data types; column_name; column_name: (column_type != schema_type). `
          //   msg += unmatched_types.map(({column, column_type, schema_type}) => {
          //     return `${column}: (${column_type}, ${schema_type})`
          //   }).join(', ')
          //   throw new Error(msg)
          // }
      })
    })
  })

  describe('data is validated/cleaned before being posted', function() {
    let request
    before(async () => {
      new_database()

      const app = express()
      try {
        app.use('/', await post_to_database(knex_db, schema_path))
      } catch(err) {
        throw combineErrors([new Error('Problem creating app'), err])
      }
      app.use(function(req, res) {
        res.status(500)
        res.send('was not caught by routes')
      })
      app.use(function(err, req, res) {
        // render the error page
        res.status(err.status || 500)
        res.send('error')
      })

      request = supertest(app)
    })

    after(destroy_database)

    it('multiple validation errors sent back', async function() {
      const post_to = 'form2'

      const { body } = await request
        .post('/' + post_to)
        .type('form')
        // .set('Content-Type', 'application/x-www-form-urlencoded')
        .send({
          input0: 'not a number',
          input1: '1',
          input2: '12',
        })
        .expect('Content-Type', /json/)
        .expect(400)

      expect(body).to.eql({
        input0: 'must only contain alpha-numeric characters',
        input2: 'length must be at least 3 characters long',
      })
    })

    it('when validation data is not put to database', async function() {
      const post_to = 'form0'

      await request
        .post('/' + post_to)
        .type('form')
        .send({input0: '%%%'})
        .expect('Content-Type', /json/)
        .expect(400)

      expect(await knex_db(post_to).select('input0'))
        .to.have.lengthOf(0)
    })

    it('true returned when successfully put in database', async function() {
      const { body } = await request
        .post('/form0')
        .type('form')
        .send({input0: 'a'})
        .expect('Content-Type', /json/)
        .expect(200)

      expect(body).to.be.true
    })

    it('data is put in database', async function() {
      const post_to = 'form2'
      const data = {
        input0: 'alphanum',
        input1: 1,
        input2: 1234,
      }

      await request
        .post('/' + post_to)
        .type('form')
        .send(data)
        .expect('Content-Type', /json/)
        .expect(200)

      const table_rows = await knex_db(post_to).select('*')

      expect(table_rows).to.have.lengthOf(1)

      const [ row_data ] = table_rows
      expect(row_data).to.eql(data)
    })

    it('data is cleaned before being put in database', async function() {
      const post_to = 'form1'

      await request
        .post('/' + post_to)
        .type('form')
        .send({
          input0: 123,
          input1: 'HI THERE', // to lowercase
          input2: 'again', // to uppercase
        })
        .expect('Content-Type', /json/)
        .expect(200)

      const [ row ] = await knex_db(post_to).select('*')
      expect(row).to.eql({
        input0: 123,
        input1: 'hi there', // to lowercase
        input2: 'AGAIN', // to uppercase
      })
    })

  })
})




it('knex_db is not a knex object')

  


it('needs default security checks')
