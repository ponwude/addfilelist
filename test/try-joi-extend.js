/*eslint-disable no-console, indent */

const Joi = require('joi')

const customeJoi = Joi.extend(joi => ({
  base: joi.any(),
  name: 'file',
  language: {
    contains: 'needs hi',
  },
  rules: [
    {
      name: 'contains',
      setup(params) {
        this._flags.file_contains = params
      },
      validate(params, value, state, options) {
        console.log('params', params)
        if (!value.includes('hi'))
          return this.createError('file.contains', {v: value}, state, options)
        return value
      },
    },
  ],
}))

customeJoi
  .file()
  .contains('params string')
  //.validate('i there')
  // .then(console.log.bind(console))
  // .catch(console.error.bind(console))













