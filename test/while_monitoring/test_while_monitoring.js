const while_monitoring = require('./while_monitoring.js')

const jsdom = require('jsdom')

const chai = require('chai')
const { expect } = chai

const { JSDOM } = require('jsdom')
const window = new JSDOM('<!DOCTYPE html><body></body>').window
const { document } = window.window
const Event = window.Event


describe('while_monitoring', function() {

  const event_type = 'there should not be an event named this hopefully'

  describe('expect', function() {
    describe('upon', function() {
      it('should catch event.', function() {
        return while_monitoring(document)
          .expect(event_type)
          .upon(() => document.dispatchEvent(new Event(event_type)))
      })

      it('should reject because event is not caught.', async function() {
        try {
          await while_monitoring(document)
            .expect(event_type)
            .upon(() => {})

          return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
        } catch (err) {}
      })
    })

    describe('upon_event', function() {
      it('should catch event.', function() {
        return while_monitoring(document)
          .expect(event_type)
          .upon_event(event_type)
      })

      it('should reject because event is not caught.', async function() {
        try {
          await while_monitoring(document)
            .expect(event_type)
            .upon_event('some other event')

          return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
        } catch (err) {}
      })
    })
  })

  describe('do_not_expect', function() {
    describe('upon', function() {
      it('should throw exception when event is caught.', async function() {
        try {
          await while_monitoring(document)
            .do_not_expect(event_type)
            .upon(() => document.dispatchEvent(event_type))

          return Promise.reject(new Error('Promise should have rejected but did not.'))
        } catch (err) {}
      })

      it('should resolve when no event is caught.', async function() {
        return while_monitoring(document)
          .do_not_expect(event_type)
          .upon(() => {})
      })
    })

    describe('upon_event', function() {
      it('should throw exception when event is caught.', async function() {
        try {
          await while_monitoring(document)
            .do_not_expect(event_type)
            .upon_event(event_type)

          return Promise.reject(new Error('Promise should have rejected but did not.'))
        } catch (err) {}
      })

      it('should resolve when no event is caught.', async function() {
        return while_monitoring(document)
          .do_not_expect(event_type)
          .upon_event('some other event')
      })
    })
  })
})