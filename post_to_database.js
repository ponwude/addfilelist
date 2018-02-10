const _ = require('lodash')
const express = require('express')
const Joi = require('joi')

const load_schema = require('./load_schema.js')


async function post_to_database(knex_db, schemas) {
  schemas = await load_schema(schemas)
  schemas = await schema_validator.validate(schemas)

  const router = express.Router()

  const create_table_promises = []
  for (const table in schemas) {
    if (schemas.hasOwnProperty(table)) {
      const table_schema_arr = schemas[table],
            table_schema_obj = _.keyBy(table_schema_arr, 'name'),
            table_columns = Object.keys(table_schema_obj)

      create_table_promises.push(async () => {
        // initialize tables in database
        if (await knex_db.schema.hasTable(table)) {
          // check if the table and schema have the same columns
          const mismatched_columns = _.xor(
            Object.keys(await knex_db(table).columnInfo()),
            _.map(table_schema_arr, 'name')
          )
          if (mismatched_columns.length > 0)
            throw new Error(`Existing table (${table}) and schemas have the mismatched column names of: ${mismatched_columns.sort().join(', ')}`)

        } else {
          // create table
          await knex_db.schema.createTableIfNotExists(table, tb => {
            table_schema_arr.forEach(({name, database_type}) => {
              tb[database_type](name)
            })
          })
        }
      })

      const generate_funcs = _.pickBy(
        _.mapValues(table_schema_obj, 'generate'),
        gen => gen !== undefined
      )

      // post handler
      router.post(
        '/' + table, // url

        (req, res, next) => {
          // ensure request has been validated
          if (req.is_validated) next()
          else res.status(500).send('Request was not validated. Please use the post_request_validator.')
        },

        async (req, res, next) => {
          /*
            Limit one file to each field
            Should be improved to allow more
          */
          try {
            await one_file_limit.validate(req)
            next()
          } catch(err) {
            res.status(400).send(err.details[0].message)
          }
        },

        async (req, res) => {
          // insert into database
          try {
            const { body, files } = req

            const insert_data = {}

            Object.assign(insert_data, _.pick(body, table_columns))

            Object.assign(insert_data,
              /*
                this will probably have to be changed
                multer may not be using memorystorage
                file may not be utf8
              */
              _.mapValues(
                _.pick(files, table_columns),
                ([file]) => file.buffer.toString()
              )
            )

            const gen_promises = _.mapValues(generate_funcs, f => f(insert_data) )
            for (const column in gen_promises) {
              if (gen_promises.hasOwnProperty(column)) {
                insert_data[column] = await gen_promises[column]
              }
            }

            await knex_db(table).insert(insert_data)

            res.send(true)

          } catch(err) {res.status(500).send(err)}
        }

      )
    }
  }

  await Promise.all(create_table_promises.map(f => f()))

  return router
}


// joi validators for schemas input
const base_item = Joi.object()
  .keys({name: Joi.string().required()})
  .unknown(true)

const form_item = base_item
  .keys({
    database_type: Joi.string().required(),
    generate: Joi.func(),
  })

const schema_validator = Joi.object().pattern(/.*/,
  Joi.array().items(form_item).unique('name')
)

// limit number of files to one
const one_file_limit = Joi.object({
  files: Joi.object().pattern(/.*/, Joi.array().max(1) ),
}).unknown(true)


module.exports = post_to_database
