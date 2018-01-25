const Joi = require('joi')

module.exports = {
  form0: [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'text'},
      validate: Joi.string().alphanum().required(),
      database_type: 'string',
    },
  ],
  form1: [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'number'},
      validate: Joi.number().integer().required(),
      database_type: 'float',

      // for testing only
      good: '1',
    },
    {
      name: 'input1',
      label: 'Input 1',
      attr: {type: 'text'},
      validate: Joi.string().lowercase(),
      database_type: 'string',

      // for testing only
      good: 'good input1',
    },
    {
      name: 'input2',
      label: 'Input 2',
      attr: {type: 'text'},
      validate: Joi.string().uppercase(),
      database_type: 'string',

      // for testing only
      good: 'good input2',
    },
  ],
  form2: [
    {
      name: 'input0',
      validate: Joi.string().alphanum().required(),
      database_type: 'string',
    },
    {
      name: 'input1',
      validate: Joi.number().integer().required(),
      database_type: 'float',
    },
    {
      name: 'input2',
      validate: Joi.string().min(3),
      database_type: 'float',
    },
  ],
  database_only: [
    {
      name: 'db0',
      database_type: 'string',
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
      database_type: 'string',
    },
    {
      name: 'input1',
      validate: Joi.number().integer().required(),
      database_type: 'float',
    },
  ]
}
