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
  for (const name in all_schemas) {
    if (all_schemas.hasOwnProperty(name)) {
      const table_schema_arr = all_schemas[name],
            table_schema_obj = _.keyBy(table_schema_arr, 'name')

      // initialize tables in database
      create_table_promises.push(async () => {
        if (await knex_db.schema.hasTable(name)) {
          const column_info = await knex_db(name).columnInfo(),
                existing_columns = Object.keys(column_info),
                schema_columns = _.map(table_schema_arr, 'name'),
                unexpectd_columns = _.difference(existing_columns, schema_columns),
                extra_columns = _.difference(schema_columns, existing_columns)

          if (unexpectd_columns.length > 0)
            throw new Error(`In existing table ${name} unexpected columns found: ${unexpectd_columns.join(', ')}`)
          if (extra_columns.length > 0)
            throw new Error(`The existing table ${name} does not have the columns: ${extra_columns.join(', ')}`)

        } else {
          await knex_db.schema.createTableIfNotExists(name, tb => {
            table_schema_arr.forEach(({name, type}) => tb[type](name))
          })
        }
      })

      // throw error if column does not have a validator defined
      const unvalidated = table_schema_arr
        .filter(props => props.validate === undefined)
        .map(props => props.name)
      if (unvalidated.length > 0)
        throw new Error(`For table ${name}, validate not defined for columns: ${unvalidated.join(', ')}`)

      // create routes
      const validators = _.mapValues(table_schema_obj, 'validate')
      router.post(
        '/' + name, // url
        async (req, res, next) => {
          // middleware for joi
          const { body } = req

          const val_errors = [],
                val_promises = table_schema_arr.map(async ({ name, validate }) => {
                  try {
                    body[name] = await validate.validate(body[name])
                  } catch(err) {
                    val_errors.push(err)
                  }
                })

          for (let pi = val_promises.length - 1; pi >= 0; --pi)
            await val_promises[pi]

          if (val_errors.length > 0) {
            console.log('val_errors.length', val_errors.length)
            res
              .status(400)
              .json(val_errors)
          } else {
            next()
          }
        },
        (req, res) => {
          res
            .status(400)
            .json('hi')
        },
      )
    }
  }

  await Promise.all(create_table_promises.map(f => f()))

  return router
}

module.exports = post_to_database
