/*globals describe, it, beforeEach */

const add_method = require('../add_method.js')

require('./unhandled.js')

const chai = require('chai')
const {expect} = chai


describe('add_method', function() {
  let test_obj
  const reserved_method = 'reserved_method'

  beforeEach(function() {
    test_obj = function (val=1) {
      this.val = val
    }

    test_obj.prototype[reserved_method] = function() {}
  })

  it('does not overwrite defined methods', function() {
    expect(() => {
      add_method(reserved_method, test_obj, function() {})
    }).to.throw(`Cannot override existing ${typeof test_obj}.prototype.${reserved_method} method.`)
  })

  it('sets a method', function() {
    const name = 'fun_method'
    const val = 'sets a method'
    const method = function() {this.val = val}
    add_method(name, test_obj, method)

    expect(test_obj.prototype[name]).to.equal(method)

    const instance = new test_obj()
    expect(instance[name]).to.equal(method)
  })

  it('is not enumerable', function() {
    const name = 'fun_method'
    const val = 'sets a method'
    const method = function() {this.val = val}
    add_method(name, test_obj, method)

    const instance = new test_obj()

    expect(instance.hasOwnProperty('val')).to.be.true
    expect(instance.hasOwnProperty(name)).to.be.false
  })
})
