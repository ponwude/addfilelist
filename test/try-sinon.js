const sinon = require('sinon')

const spy = sinon.spy()

spy('hi')

console.log('spy.firstCall.args', spy.firstCall.args)
