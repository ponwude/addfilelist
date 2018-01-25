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

// const xhr = new window.XMLHttpRequest()
// xhr.open('post', `/$`)
// xhr.onreadystatechange(() => {
//   if (xhr.readyState === window.XMLHttpRequest.DONE) {
//     console.log('xhr.status', xhr.status)
//     if (status(xhr).is(/2../)) 'hi'
//   }
// })
// function status(xhr) {
//   return {
//     is(selector) {
//       // const xhr_status = String(xhr.status)

//       // let matched
//       // try {
//       //   matched = selector.exec(xhr_status)
//       // } catch(err) {
//       //   throw new Error(`xhr_status: ${xhr_status}`)
//       // }

//       // if (matched === null) return false

//       // if (matched[0] !== xhr_status)
//       //   throw new Error(`regex selector ${selector} matched "${matched[0]}" not the whole xhr.status "${xhr_status}"`)

//       return true
//     },
//   }
// }


module.exports = apply_validation
