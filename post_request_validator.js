/*
  file validoator will be passed a File object or a multer file information object.
*/


const Joi = require('joi')
const express = require('express')
const _ = require('lodash')
const multer = require('multer')

const load_schema = require('./load_schema.js')

/*
  schemas
    - string to schema file
    - schema object
*/
async function post_request_validator(schemas) {
  schemas = await load_schema(schemas)
  schemas = await schema_validator.validate(schemas)

  const router = express.Router()

  for (const req_path in schemas) {
    if (schemas.hasOwnProperty(req_path)) {
      const schema_arr = schemas[req_path]
              .filter(({form_skip}) => form_skip === undefined ||
                                       form_skip === false),
            schema_obj = _.keyBy(schema_arr, 'name')

      function validator_wrapper({name, validate}) {
        if (validate.isJoi) {
          return async value => {
            try {
              return await validate.validate(value)
            } catch(err) {
              // https://github.com/hapijs/joi/blob/v13.0.1/API.md#errors
              if (err.name === 'ValidationError')
                // throw new Error(err.details[0].message.replace('"value" ', ''))
                throw new Error(err.details
                  .map(({message}) => message.replace('"value" ', ''))
                  .join(', ')
                )

              if (err.message !== undefined && err.message !== '')
                throw err

              throw new Error('Unknown Error')
            }
          }
        }

        // promisify regular functions
        if (typeof validate === 'function') return async value => validate(value)

        throw new Error(`${name}.validate needs to be a Joi validator or a function`)
      }

      const validators = _.mapValues(schema_obj, validator_wrapper)
      const expected_body_keys = schema_arr
        .filter(({attr}) => attr === undefined || attr.type !== 'file')
        .map(({name}) => name)
      const expected_file_keys = schema_arr
        .filter(({attr}) => attr !== undefined && attr.type === 'file')
        .map(({name}) => name)

      router.post(
        '/' + req_path, // url

        (req, res, next) => {
          /* Ensure corrct content type so that multer will create req.body
            this should start validating header as well
          */
          const expected_type = 'multipart/form-data'
          if (!req.is(expected_type)) {
            res.status(400).send(`Wrong Content-Type of "${req.headers['content-type']}"" when expecting "${expected_type}"`)
          }
          else {
            next()
          }
        },

        multer({storage: multer.memoryStorage()}).fields(
          expected_file_keys.map(name => ({name}))
        ),

        (req, res, next) => {
          /* correct body fields/keys */
          const { body } = req
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
          const { body, files } = req

          // validate input values
          let is_val_error = false
          const val_errors = {}
          const val_promises = []

          // text fields
          expected_body_keys.forEach(name => {
            const prom = validators[name](body[name])
              .then(value => body[name] = value)
              .catch(err => {
                is_val_error = true
                val_errors[name] = err.message
              })
            val_promises.push(prom)
          })

          // file fields
          expected_file_keys.forEach(name => {
            const validator = validators[name]
            files[name].forEach(file => val_promises.push(
              validator(file)
                .catch(err => {
                  is_val_error = true
                  val_errors[name] = err.message
                })
            ))
          })

          // await all promises to resolve
          for (let vpi = val_promises.length - 1; vpi >= 0; --vpi)
            await val_promises[vpi]

          if (is_val_error) res.status(400).send(val_errors)
          else next()
        },
      )
    }
  }

  return router
}


// joi validators for schemas input
const base_item = Joi.object()
  .keys({name: Joi.string().required()})
  .unknown(true)

const form_skip = base_item.keys({form_skip: Joi.required().valid(true)})

const form_item = base_item
  .when(form_skip, {
    then: form_skip.keys({validate: Joi.forbidden()}),
  })
  .try(base_item.keys({
    validate: Joi.alternatives(
      Joi.object({isJoi: Joi.required().valid(true)}).unknown(true),
      Joi.func().arity(1)
    ).required(),
    attr: Joi.object({type: Joi.string().lowercase()}),
  }))

const schema_validator = Joi.object().pattern(/.*/,
  Joi.array().items(form_item).unique('name')
)


module.exports = post_request_validator
