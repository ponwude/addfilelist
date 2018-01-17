/*global describe it */

const { JSDOM } = require('jsdom')
window = new JSDOM('<!DOCTYPE html><body></body>').window //eslint-disable-line no-global-assign, prefer-destructuring
const { document } = window.window


// testing
const fb = require('../form_builder.js')
const form_builder =  (schema, options={}) => fb(schema, Object.assign({document}, options))

const chai = require('chai')
chai.use(require('chai-dom'))
chai.should()
const {expect} = chai


describe('Create a form.', function() {
  it('Creates a form (does not check validate).', function() {
    const schema = [
      {
        label: 'Label 1',
        name: 'input_1',
        attr: {type: 'text', required: true},
        validate: true,
      },
      {
        label: 'Label 2',
        name: 'input_2',
        attr: {type: 'number'},
        validate: true,
      },
    ]

    const form = form_builder(schema)

    expect(form.tagName).to.equal('FORM')
    expect(form.children).to.have.lengthOf(schema.length + 1)  // input divs and submit

    Array.from(form.children)
      .filter((element, index) => index < schema.length)  // remove input submit element
      .forEach((input_div, div_index) => {
        // three elements label, input, error_text
        expect(input_div.tagName).to.equal('DIV')
        expect(input_div).to.have.length(3)

        const [label, input, error_text] = input_div.children,
              input_schema = schema[div_index]

        expect(label.tagName).to.equal('LABEL')
        expect(label.innerHTML).to.equal(input_schema.label)

        expect(input.tagName).to.equal('INPUT')
        expect(input).to.have.attr('name', input_schema.name)
        for (const is_attr in input_schema.attr) {
          if (input_schema.hasOwnProperty(is_attr)) {
            expect(input).to.have.attr(is_attr, input_schema.attr[is_attr])
          }
        }

        expect(error_text.tagName).to.equal('P')
        expect(error_text).to.have.class('input-error-msg')
        expect(error_text.innerHTML).to.equal('')  // no error message
      })

    const submit = form.children[schema.length]
    expect(submit.tagName).to.equal('INPUT')
    expect(submit).to.have.attr('type', 'submit')
    expect(submit).to.have.attr('name', 'submit')
  })

  it('Empty label should be created if "label" undefined.', function() {
    const schema = [
      {
        label: undefined,
        name: 'input_1',
        attr: {type: 'text', required: true},
        validate: true,
      },
    ]

    const label = form_builder(schema).children[0].firstChild
    expect(label.tagName).to.equal('LABEL')
    expect(label).to.have.text('')
  })

  it('Error text should be created if "validate" undefined.', function() {
    const schema = [
      {
        label: 'Label 1',
        name: 'input_1',
        attr: {type: 'text', required: true},
        validate: undefined,
      },
    ]

    const error_text = form_builder(schema).children[0].lastChild
    expect(error_text.tagName).to.equal('P')
    expect(error_text).to.have.class('input-error-msg')
    expect(error_text).to.have.text('')
  })

  it('Error should be thrown if "name" not defined.', function() {
    const schema = [
      {
        label: 'Label 1',
        name: undefined,
        attr: {type: 'text', required: true},
      },
    ]

    expect(() => form_builder(schema))
      .to.throw('No name specified for input.')
  })

  it('No error if "attr" is undefined (name should still be defined).', function() {
    const schema = [
      {
        label: 'Label 1',
        name: 'input_1',
        attr: undefined,
        validate: true,
      },
    ]

    const input_div = form_builder(schema).children[0] //eslint-disable-line prefer-destructuring
    expect(input_div).to.have.length(3)
    expect(input_div.children[1]).to.have.attr('name', schema[0].name)
  })

  it('Should be a post request.', function() {
    const form = form_builder([])
    expect(form).to.have.attr('method', 'post')
  })

  it('If is a file input the form should have enctype="multipart/form-data".', function() {
    const schema = [
      {
        name: 'input1',
        attr: {type: 'file'},
      },
    ]

    const form = form_builder(schema)

    expect(form).to.have.attr('enctype', 'multipart/form-data')
  })

  describe('Submit input should be created with ', function() {
    it('default value of "Submit".', function() {
      const schema = []

      const submit_input = form_builder(schema).lastChild
      expect(submit_input.tagName).to.equal('INPUT')
      expect(submit_input).to.have.attr('type', 'submit')
      expect(submit_input).to.have.value('Submit')
    })

    it('custom value of "Push to Submit".', function() {
      const schema = []

      const submit_input = form_builder(schema, {submit_text: 'Push to Submit'}).lastChild
      expect(submit_input.tagName).to.equal('INPUT')
      expect(submit_input).to.have.attr('type', 'submit')
      expect(submit_input).to.have.value('Push to Submit')
    })
  })
})
