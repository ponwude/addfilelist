const Joi = require('joi')


module.exports = [
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
]