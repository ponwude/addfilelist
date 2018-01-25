/*eslint-disable no-unused-vars, no-console */

const fs = require('then-fs')

const _ = require('lodash')

const express = require('express')
const bodyParser = require('body-parser')

const { celebrate, Joi, errors } = require('celebrate')


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
  router.use(bodyParser.json())
  router.use(bodyParser.urlencoded({ extended: false }))

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

      // throw error if column does not have a validator defined
      const unvalidated = table_schema_arr
        .filter(({validate, form_skip}) => validate === undefined && !form_skip)
        .map(({name}) => name)
      if (unvalidated.length > 0)
        throw new Error(`For table ${table_name}, validate not defined for columns: ${unvalidated.join(', ')}`)

      // create routes
      const validators = _.mapValues(table_schema_obj, 'validate')
      router.post(
        '/' + table_name, // url
        async (req, res) => {
          // middleware for joi
          const { body } = req

          const val_errors = {},
                val_promises = table_schema_arr.map(
                  async ({ name: col_name, validate }) => {
                    try {
                      body[col_name] = await validate.validate(body[col_name])
                    } catch(err) {
                      val_errors[col_name] = err.details[0].message
                        .replace('"value" ', '')
                    }
                  }
                )

          for (let pi = val_promises.length - 1; pi >= 0; --pi)
            await val_promises[pi]

          // console.log('val_errors', val_errors)
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
