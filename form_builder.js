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

const add_method = require('./add_method.js')

module.exports = function(schema,
  // options
  {
    form_attributes={method: 'post'},
    submit_text='Submit',
    document=document, // document to create elements with
  }={}
) {
  const form = document.createElement('form')
  form_attributes.forEach((attr, attr_value) => form.setAttribute(attr, attr_value))

  const createAppendElement = function (parent, tag) {
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

  schema.forEach(spec => {
    // console.log(spec)
    const {label: label_text='', name, attr: attributes={}} = spec

    const input_div = createAppendElement(form, 'div')

    // set label text
    createAppendElement(input_div, 'label').innerHTML = label_text

    // create input and apply its attributes
    const input = createAppendElement(input_div, 'input')
    if (name === undefined) throw new Error('No name specified for input.')
    input.name = name
    attributes.forEach((attr, attr_value) => {
      input.setAttribute(attr, attr_value)

      if (attr === 'type' && attr_value === 'file')
        form.enctype = 'multipart/form-data'
    })

    // error text
    createAppendElement(input_div, 'p').classList.add('input-error-msg')
  })

  // submit
  const submit = createAppendElement(form, 'input')
  submit.type = submit.name = 'submit'
  submit.value = submit_text

  return form
}


add_method('forEach', Object, function(func) {
  for (const key in this) {
    if (this.hasOwnProperty(key)) {
      func(key, this[key])
    }
  }
})
