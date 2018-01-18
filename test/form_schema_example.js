const Joi = require('joi')

module.exports = {
  '/form0': [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'text'},
      validate: Joi.string().alphanum().required(),
      // good_values: ['1', 'a'],
      // bad_values: ['#', '*'],
    },
  ],
  '/form1': [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'number'},
      validate: Joi.number().integer().required(),
      // good_values: ['1', 2],
      // bad_values: [1.2, 'b'],
    },
    {
      name: 'input1',
      label: 'Input 1',
      attr: {type: 'text'},
      validate: Joi.string().lowercase(),
      // good_values: ['a', 'b'],
      // bad_values: ['A', 1],
    },
  ],
}