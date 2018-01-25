const Joi = require('joi')

module.exports = {
  missing_name: [
    {
      validate: Joi.number(),
      database_type: 'float',
    },
  ]
}
