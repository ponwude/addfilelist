/*eslint-disable no-unused-vars, no-console */

const Joi = require('joi')

const load_schema = require('./load_schema.js')

/*
  schema
    - string to schema file
    - schema object
*/


const schema_validator = Joi.object().pattern(/.*/, Joi.array().items(
  Joi.object()
))

async function post_request_validator(schema) {
  schema = await load_schema(schema)

  await schema_validator.validate(schema)
}

module.exports = post_request_validator
