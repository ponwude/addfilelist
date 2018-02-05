const Joi = require('joi')

// Joi
//   .array()
//   .items(
//     Joi.object(),
//     Joi.func().arity(1)
//   )
//   .validate([{}, () => {}])
//   .then(console.log.bind(console))
//   .catch(console.error.bind(console))

Joi
  .object({})
  .keys({
    a: Joi.any().valid('x'),
    b: Joi.any(),
  })
  .requiredKeys('a', 'b')
  .validate({a: 'x', c: 'x'})
  .then(console.log.bind(console))
  .catch(console.error.bind(console))
