const Sequence = require('event_sequencing')


module.exports = function(form, schema) {
  /*
  Applies the validaton to the from from schema.

  form needs to contain the inputs with the name attributes that match schema names
  */
  console.log(`apply validation\n\tform: ${form}`)
  schema
    .filter(spec => spec.validate !== undefined)
    .forEach(spec => {
      console.log('spec', spec)
      const input = form.querySelector(`input[name="${spec.name}"]`),
            input_container = input.parentNode,
            error_text = input_container.querySelector('.input-error-msg')
      console.log('input', input, input.name)

      const validate_promise = eval(spec.validate)

      input.addEventListener('click', function(e) {
        console.log('click event detected')
      })

      const validate_listener = async () => {
        /*
        called when input should be checked
        displays errors after the input
        throws error if input error
        */
        try {
          console.log('validate_listener try')
          await validate_promise.validate(input.value)
          input.classList.remove('input-error')
          input.dispatchEvent(new Event('valid'))
        } catch (err) {
          console.log('validate_listener catch')
          error_text.innerHTML = err.name === 'ValidationError' ?
            err.details[0].message.replace('"value" ', '') :
            'Unknown Error'  // https://github.com/hapijs/joi/blob/v13.0.1/API.md#errors

          input.classList.add('input-error')
          input.dispatchEvent(new Event('invalid'))
        }
      }

      Sequence(input)
        .once('brush', validate_listener)
        .repeat('change', validate_listener)
        .until.event('submit', form)
    })

  return form
}
