/*eslint-disable no-console, no-unused-vars */
/*globals XMLHttpRequest */

const Sequence = require('event_sequencing')


function apply_validation(form, schema, {
  on_validated_submit = ()=>{},
  on_invalidated_submit = ()=>{},
}={}) {
  /*
  Applies the validaton to the from from schema.

  form needs to contain the inputs with the name attributes that match schema names
  */
  const val_funcs = schema
    .filter(({validate}) => validate !== undefined)
    .map(({name, attr={}, validate}) => {
      const { type='text' } = attr
      const is_file_input = type.toLowerCase() === 'file'

      const input = form.querySelector(`input[name="${name}"]`),
            input_container = input.parentNode,
            error_text = input_container.querySelector('.input-error-msg')

      const validator_wrapper = is_file_w => {
        if (is_file_w) {
          const single_validator = validator_wrapper(false)

          return async files => {
            for (let fli = files.length - 1; fli >= 0; --fli) {
              await single_validator(files[fli])
            }
          }
        }

        if (validate.isJoi) {
          return async value => {
            try {
              return await validate.validate(
                is_file_input ? file2obj(value) : value,
                {
                  allowUnknown: is_file_input,
                  abortEarly: !is_file_input,
                }
              )
            } catch(err) {
              // https://github.com/hapijs/joi/blob/v13.0.1/API.md#errors
              if (err.name === 'ValidationError')
                // throw new Error(err.details[0].message.replace('"value" ', ''))
                throw new Error(err.details
                  .map(({message}) => message.replace('"value" ', ''))
                  .join(', ')
                )

              if (err.message !== undefined && err.message !== '')
                throw err

              throw new Error('Unknown Error')
            }
          }
        }

        if (typeof validate === 'function')
          return validate

        throw new Error(`${name}.validate needs to be a Joi validator or a function`)
      }

      const validator = validator_wrapper(is_file_input)

      const val_func = async () => {
        /*
        called when input should be checked
        displays errors after the input
        throws error if input error
        */
        try {
          const value = is_file_input ? input.files : input.value
          const val_value = await validator(value)

          if (value !== val_value && !is_file_input) {
            /* set the cursor positon */
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
          error_text.innerHTML = err.message

          input.classList.add('input-error')
          input.dispatchEvent(new Event('invalid'))

          return false
        }
      }

      if (is_file_input) input.addEventListener('change', val_func)
      else {
        Sequence(input)
          .once('blur', val_func)
          .repeat('keyup', val_func)
          .whenever('submit', form).restart()
      }

      return val_func
    })

  form.addEventListener('submit', async submit_event => {
    submit_event.preventDefault()
    submit_event.stopPropagation()

    const all_valid = (await Promise.all(
      val_funcs.map(f => f()) // start all validation functions
    )).every(a=>a) // true true if all true

    if (all_valid) {
      form.dispatchEvent(new Event('valid'))
      on_validated_submit(form)
    } else {
      form.dispatchEvent(new Event('invalid'))
      on_invalidated_submit(form)
    }
  })

  return form
}


function file2obj(file) {
  /* puts all File properties into an object */
  return Object.freeze({
    /*eslint-disable key-spacing */
    lastModified:       file.lastModified,
    lastModifiedDate:   file.lastModifiedDate,
    name:               file.name,
    webkitRelativePath: file.webkitRelativePath,
    size:               file.size,
    type:               file.type,
    /*eslint-enable key-spacing */
  })
}


module.exports = apply_validation
