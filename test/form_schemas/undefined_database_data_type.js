const Joi = require('joi')

module.exports = {
  undefined_type: [
    {
      name: 'db0',
      form_skip: true,
    },
    {
      name: 'db1',
      database_type: 'string',
      form_skip: true,
    },
    {
      name: 'input0',
      validate: Joi.string().alphanum().required(),
    },
    {
      name: 'input1',
      validate: Joi.number().integer().required(),
      database_type: 'float',
    },
  ]
}
