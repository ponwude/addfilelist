/*eslint-disable no-unused-vars, no-console */

const fs = require('then-fs')

const _ = require('lodash')

const express = require('express')
const bodyParser = require('body-parser')

const { celebrate, Joi, errors } = require('celebrate')

const multer = require('multer')


async function post_to_database(knex_db, schema_path) {
  await fs.access(schema_path)

  const all_schemas = (() => {
    try {
      return require(schema_path)
    } catch(err) {
      throw new Error(`Cannot parse javascript file: ${schema_path}`)
    }
  })()

  const router = express.Router()

  const create_table_promises = []
  for (const table_name in all_schemas) {
    if (all_schemas.hasOwnProperty(table_name)) {
      const table_schema_arr = all_schemas[table_name],
            table_schema_obj = _.keyBy(table_schema_arr, 'name')

      // initialize tables in database
      create_table_promises.push(async () => {
        if (await knex_db.schema.hasTable(table_name)) {
          const column_info = await knex_db(table_name).columnInfo(),
                existing_columns = Object.keys(column_info),
                schema_columns = _.map(table_schema_arr, 'name'),
                unexpectd_columns = _.difference(existing_columns, schema_columns),
                extra_columns = _.difference(schema_columns, existing_columns)

          if (unexpectd_columns.length > 0)
            throw new Error(`In existing table ${table_name} unexpected columns found: ${unexpectd_columns.join(', ')}`)
          if (extra_columns.length > 0)
            throw new Error(`The existing table ${table_name} does not have the columns: ${extra_columns.join(', ')}`)

        } else {
          await knex_db.schema.createTableIfNotExists(table_name, tb => {
            table_schema_arr.forEach(({name: col_name, database_type}) => {
              if (tb[database_type] === undefined)
                throw new Error(`The column ${col_name} in table ${table_name} does not have "database_type" defined`)

              tb[database_type](col_name)
            })
          })
        }
      })

      const form_input_properties = table_schema_arr
        .filter(({form_skip}) => form_skip === undefined || form_skip === false)

      // throw error if column does not have a validator defined
      const unvalidated = _.filter(form_input_properties, {validate: undefined})
      if (unvalidated.length > 0) {
        const unvalidated_names = _.map(unvalidated, 'name')
        throw new Error(`For table ${table_name}, validate not defined for columns: ${unvalidated_names.join(', ')}`)
      }

      // post handler
      const form_input_names = _.map(form_input_properties, 'name')
      const validators = _.mapValues(
        _.pick(table_schema_obj, form_input_names),
        'validate'
      )
      router.post(
        '/' + table_name, // url

        (req, res, next) => {
          /* Ensure corrct content type so that multer will create req.body
            this should start validating header as well
          */
          const expected_type = 'multipart/form-data'
          if (!req.is(expected_type))
            res.status(400).send(`Wrong Content-Type of "${req.headers['content-type']}"" when expecting "${expected_type}"`)
          else next()
        },

        multer({storage: multer.memoryStorage()}).any(), // parse multipart/form-data into the body

        (req, res, next) => {
          /* correct body fields/keys */
          const { body } = req
          const expected_body_keys = Object.keys(validators)
          const body_keys = Object.keys(body)

          const unexpected_body_keys = _.difference(body_keys, expected_body_keys)
          if (unexpected_body_keys.length > 0) {
            unexpected_body_keys.sort()
            res.status(400).send(`Unexpected body fields: ${unexpected_body_keys.join(', ')}`)
            return
          }

          const missing_body_keys = _.difference(expected_body_keys, body_keys)
          if (missing_body_keys.length > 0) {
            missing_body_keys.sort()
            res.status(400).send(`Missing required body fields: ${missing_body_keys.join(', ')}`)
            return
          }

          next()
        },

        async (req, res, next) => {
          /* validate the body data */
          const { body } = req

          // validate input values
          const val_errors = {}
          const val_promises = table_schema_arr.map(
            async ({ name: col_name, validate }) => {
              try {
                body[col_name] = await validate.validate(body[col_name])
              } catch(err) {
                if (err.isJoi && err.details !== undefined) {
                  val_errors[col_name] = err.details[0].message
                    .replace('"value" ', '')
                } else {
                  console.error(err.message)
                  next(err.message)
                }
              }
            }
          )

          for (let pi = val_promises.length - 1; pi >= 0; --pi)
            await val_promises[pi]

          if (!_.isEmpty(val_errors))
            res.status(400).json(val_errors)
          else {
            await knex_db(table_name).insert(body)

            res.status(200).json(true)
          }
        },
      )
    }
  }

  await Promise.all(create_table_promises.map(f => f()))

  return router
}

module.exports = post_to_database
