const Joi = require('joi')

const v = Joi
  .when(Joi.object({form_skip: Joi.valid(true)}), {
    then: Joi.object({validate: Joi.forbidden()})
  })
  .try(
    Joi.func(),
    Joi.string()
  )


// v.validate({form_skip: true})
v.validate('hi')
  .then(console.log.bind(console))
  .catch(console.error.bind(console))

console.log(`try-joi.js ${Date.now()} --------------------`)