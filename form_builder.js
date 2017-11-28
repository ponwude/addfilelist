'use strict'
const fs = require('fs')

const Sequence = require('event_sequencing')

module.exports = {
  form_builder(schema, {
    document=document,
    submit_text='Submit',
  }) {
    /*
    Returns a form element that has been built from schema.

    schema (required) - array of objects that contain the properties:
      name (required) - String of name of the input element
                        added as an attribute to the input element
      label (optional) - String of label element before the input element
                         if not given no label is inserted
      attr (optional) - Object of html attributes to add to the input element
                        keys are the attribute type
                        values are the attribute value
      validate (optional) - Joi schema that will check the input on submit.
                            Reference: https://github.com/hapijs/joi/blob/v13.0.1/API.md

    options (optional) - Object that has the properties:
      document (optional) - gives a different DOM document to work with
                            defaults to the global document
      submit_text (optional) - Defines text for submit input
                               Defaults to 'Submit'

    Example schema:
    [
      {
        name: 'first_name',
        label: 'First Name',
        attr: {type: 'text'},
        validate: Joi.string().required(),
      },
      {
        name: 'last_name',
        label: 'Last Name',
        attr: {type: 'text'},
        validate: Joi.string().required(),
      },
    ]
    */
    const form = document.createElement('form')

    schema.forEach(spec => {
      // console.log(spec)
      const {label:label_text='', name, attr:attributes={}, validate} = spec

      const input_div = createAppendElement(form, 'div')

      // set label text
      createAppendElement(input_div, 'label').innerHTML = label_text

      // create input and apply its attributes
      const input = createAppendElement(input_div, 'input')
      if (name === undefined) throw new Error('No name specified for input.')
      input.name = name
      for (const attr in attributes) {
        if (attributes.hasOwnProperty(attr)) {
          input.setAttribute(attr, attributes[attr])
        }
      }

      // error text
      createAppendElement(input_div, 'p').classList.add('input-error-msg')
    })

    // submit
    const submit = createAppendElement(form, 'input')
    submit.type = 'submit'
    submit.value = submit_text

    return form

    function createAppendElement(parent, tag) {
      /*
      Creates a new element of type tag.
      Appends new element to parent.
      Returns new element.

      parent - element that the new element is appended to
      tag - string that defines the new element's tag
      */
      const new_element = document.createElement(tag)
      parent.appendChild(new_element)
      return new_element
    }

  },

  apply_validation(form, schema) {
    /*
    Applies the validaton to the from from schema.

    form needs to contain the inputs with the name attributes that match schema names
    */
    schema
    .filter(spec => spec.validate !== undefined)
    .forEach(spec => {
      const input = form.querySelector(`input[name="${spec.name}"]`),
            input_container = input.parentNode,
            error_text = input_container.querySelector('.input-error-msg')

      const validate_promise = spec.validate

      Sequence(input)
        .once('brush', validate_listener)
        .repeat('change', validate_listener)
        .until.event('submit', form)

      async function validate_listener() {
        /*
        called when input should be checked
        displays errors after the input
        throws error if input error
        */
        try {
          await validate_promise.validate(input.value)
          input.classList.remove('input-error')
          input.dispatchEvent(new Event('valid'))
        } catch (err) {
          error_text.innerHTML = err.name === 'ValidationError' ?
            err.details[0].message.replace('"value" ', '') :
            "Unknown Error"  // https://github.com/hapijs/joi/blob/v13.0.1/API.md#errors
          input.classList.add('input-error')
          input.dispatchEvent(new Event('invalid'))
        }
      }
    })

    return form
  },
}


