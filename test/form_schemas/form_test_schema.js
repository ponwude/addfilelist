const Joi = require('joi')

module.exports = {
  form0: [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'text'},
      validate: Joi.string().alphanum().required(),
      type: 'string',
    },
  ],
  form1: [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'number'},
      validate: Joi.number().integer().required(),
      type: 'float',
    },
    {
      name: 'input1',
      label: 'Input 1',
      attr: {type: 'text'},
      validate: Joi.string().lowercase(),
      type: 'string',
    },
    {
      name: 'input2',
      label: 'Input 2',
      attr: {type: 'text'},
      validate: Joi.string().uppercase(),
      type: 'string',
    },
  ],
  form2: [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'text'},
      validate: Joi.string().alphanum().required(),
      type: 'string',
    },
    {
      name: 'input1',
      label: 'Input 1',
      attr: {type: 'number'},
      validate: Joi.number().integer().required(),
      type: 'float',
    },
    {
      name: 'input2',
      label: 'Input 2',
      attr: {type: 'number'},
      validate: Joi.string().min(3),
      type: 'float',
    },
  ],
}
