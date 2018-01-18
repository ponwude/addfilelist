const Sequence = require('event_sequencing')

module.exports = function(form, schema) {
  /*
  Applies the validaton to the from from schema.

  form needs to contain the inputs with the name attributes that match schema names
  */
  const val_funcs = schema
    .filter(spec => spec.validate !== undefined)
    .map(spec => {
      const input = form.querySelector(`input[name="${spec.name}"]`),
            input_container = input.parentNode,
            error_text = input_container.querySelector('.input-error-msg')

      const validate_promise = spec.validate

      const val_func = async () => {
        /*
        called when input should be checked
        displays errors after the input
        throws error if input error
        */
        try {
          const int_value = input.value
          const val_value = await validate_promise.validate(int_value)

          if (int_value !== val_value) {
            const { selectionStart, selectionEnd } = input

            input.value = val_value

            if (selectionStart !== null) {
              input.selectionStart = selectionStart
              input.selectionEnd = selectionEnd
            }
          }

          input.classList.remove('input-error')
          error_text.innerHTML = ''
          input.dispatchEvent(new Event('valid'))
          return true
        } catch (err) {
          error_text.innerHTML = err.name === 'ValidationError' ?
            err.details[0].message.replace('"value" ', '') :
            'Unknown Error'  // https://github.com/hapijs/joi/blob/v13.0.1/API.md#errors

          input.classList.add('input-error')
          input.dispatchEvent(new Event('invalid'))
          return false
        }
      }

      Sequence(input)
        .once('blur', val_func)
        .repeat('keyup', val_func)
        .whenever('submit', form).restart()

      return val_func
    })

  form.addEventListener('submit', async e => {
    e.preventDefault()
    e.stopPropagation()

    const validations = await Promise.all(val_funcs.map(f => f()))

    form.dispatchEvent(new Event(
      validations.every(a=>a) ? 'valid' : 'invalid'
    ))
  })

  return form
}
