/*global describe, it */

const while_monitoring = require('./while_monitoring.js')

const chai = require('chai')
const { expect } = chai

/*eslint-disable no-global-assign */
const { JSDOM } = require('jsdom')
const window = new JSDOM('<!DOCTYPE html><body></body>').window
const { document } = window.window
Event = window.Event //asdfkasdf check if this needs to be a global
/*eslint-enable no-global-assign */


describe('while_monitoring', function() {

  const event_type = 'et0'
  const multiple_event_types = Object.freeze(['et1', 'et2'])

  describe('expect', function() {
    describe('upon', function() {
      describe('should hear event', function() {
        it('single event', function() {
          return while_monitoring(document)
            .expect(event_type)
            .upon(() => document.dispatchEvent(new Event(event_type)))
        })

        it('multiple events', function() {
          return while_monitoring(document)
            .expect(multiple_event_types)
            .upon(() => {
              multiple_event_types.forEach(event_type => {
                document.dispatchEvent(new Event(event_type))
              })
            })
        })
      })

      describe('should reject because event is not heard', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .expect(event_type)
              .upon(() => {})

            return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
          } catch (err) {
            expect(err.message).to.equal(`Event (${event_type}) was not heard after cause.`)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; --meti) {
            const event_type = multiple_event_types[meti]
            try {
              await while_monitoring(document)
                .expect(multiple_event_types)
                .upon(() => {})

              return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
            } catch (err) {
              expect(err.message).to.equal(`Event (${multiple_event_types.join(', ')}) was not heard after cause.`)
            }
          }

          try {
            await while_monitoring(document)
              .expect(multiple_event_types)
              .upon(() => {})

            return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
          } catch (err) {
            expect(err.message).to.equal(`Event (${multiple_event_types.join(', ')}) was not heard after cause.`)
          }
        })

        it('multiple events with one listened for event heard the same number of times as the length of the number of events being listened for.', async function() {
          const event_type = multiple_event_types[0]
          const unheard_events = multiple_event_types.copyWithout(event_type).join(', ')

          try {
            await while_monitoring(document)
              .expect(multiple_event_types)
              .upon(() => {
                for (let meti = multiple_event_types.length - 1; meti >= 0; --meti)
                  document.dispatchEvent(new Event(event_type))
              })

            return Promise.reject(new Error(`No promise rejection when expected events ${unheard_events} were not heard.`))
          } catch (err) {
            expect(err.message).to.equal(`Event (${unheard_events}) was not heard after cause.`)
          }
        })

      })
    })

    describe('upon_event', function() {
      describe('should hear event', function() {
        it('single events', function() {
          return while_monitoring(document)
            .expect(event_type)
            .upon_event(event_type)
        })

        it('multiple events', async function() {
          const test_event = 'multiple dispatch test'
          const dispatch = () => {
            multiple_event_types.forEach(event_type => {
              document.dispatchEvent(new Event(event_type))
            })
          }
          document.addEventListener(test_event, dispatch)

          try {
            await while_monitoring(document)
              .expect(multiple_event_types)
              .upon_event(test_event)
          } catch (err) {
            return Promise.reject(err)
          } finally {
            document.removeEventListener(test_event, dispatch)
          }
        })
      })

      describe('should reject because event is not heard', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .expect(event_type)
              .upon_event('some other event')

            return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
          } catch (err) {
            expect(err.message).to.equal(`Event (${event_type}) was not heard after cause.`)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; --meti) {
            const event_type = multiple_event_types[meti]

            const test_event = 'multiple dispatch test'
            const dispatch = () => document.dispatchEvent(new Event(event_type))
            document.addEventListener(test_event, dispatch)

            const unheard_events = multiple_event_types.copyWithout(event_type).join(', ')
            try {
              await while_monitoring(document)
                .expect(multiple_event_types)
                .upon_event(test_event)

              return Promise.reject(`Was not rejected even though events ${unheard_events} were called.`)
            } catch (err) {
              expect(err.message).to.equal(`Event (${unheard_events}) was not heard after cause.`)
            } finally {
              document.removeEventListener(test_event, dispatch)
            }
          }
        })
      })

      it('should throw error if causal_event is not a string', function() {
        expect(() => {
          while_monitoring(document).expect(event_type).upon_event(undefined)
        }).to.throw(TypeError, 'causal_event needs to be a String.')
      })
    })
  })

  describe('do_not_expect', function() {
    describe('upon', function() {
      describe('should throw exception when event is caught', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .do_not_expect(event_type)
              .upon(() => document.dispatchEvent(new Event(event_type)))

            return Promise.reject(new Error('Promise should have rejected but did not.'))
          } catch (err) {
            expect(err.message).to.equal(`${event_type} was heard after cause.`)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; meti--) {
            const event_type = multiple_event_types[meti]

            try {
              await while_monitoring(document)
                .do_not_expect(multiple_event_types)
                .upon(() => document.dispatchEvent(new Event(event_type)))

              return Promise.reject(new Error('Promise should have rejected but did not.'))
            } catch (err) {
              expect(err.message).to.equal(`${event_type} was heard after cause.`)
            }
          }

          // should list both events
          try {
            await while_monitoring(document)
              .do_not_expect(multiple_event_types)
              .upon(() => {
                multiple_event_types.forEach(event_type => {
                  document.dispatchEvent(new Event(event_type))
                })
              })

            return Promise.reject(new Error(`Did not throw exception when ${multiple_event_types.join(', ')} were heard.`))
          } catch (err) {
            expect(err.message).to.equal(`${multiple_event_types.join(', ')} was heard after cause.`)
          }
        })
      })

      describe('should resolve when no event is caught', function() {
        it('single event', async function() {
          return while_monitoring(document)
            .do_not_expect(event_type)
            .upon(() => {})
        })

        it('multiple events', async function() {
          return Promise.all(multiple_event_types.map(event_type => {
            return while_monitoring(document)
              .do_not_expect(event_type)
              .upon(() => {})
          }))
        })
      })
    })

    describe('upon_event', function() {
      describe('should throw exception when event is caught', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .do_not_expect(event_type)
              .upon_event(event_type)

            return Promise.reject(new Error('Promise should have rejected but did not.'))
          } catch (err) {
            expect(err.message).to.equal(`${event_type} was heard after cause.`)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; meti--) {
            const event_type = multiple_event_types[meti]
            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon_event(event_type)

              return Promise.reject(new Error(`Did not throw exception when ${event_type} (index ${meti}) was heard.`))
            } catch (err) {
              expect(err.message).to.equal(`${event_type} was heard after cause.`)
            }
          }

          // should list both events
          const test_event = 'multiple dispatch test'
          const dispatch = () => {
            multiple_event_types.forEach(event_type => {
              document.dispatchEvent(new Event(event_type))
            })
          }
          document.addEventListener(test_event, dispatch)
          try {
            await while_monitoring(document)
              .do_not_expect(multiple_event_types)
              .upon_event(test_event)

            return Promise.reject(new Error(`Did not throw exception when ${multiple_event_types.join(', ')} were heard.`))
          } catch (err) {
            expect(err.message).to.equal(`${multiple_event_types.join(', ')} was heard after cause.`)
          }
          finally {
            document.removeEventListener(test_event, dispatch)
          }
        })
      })

      describe('should resolve when no event is caught', function() {
        it('single event', async function() {
          return while_monitoring(document)
            .do_not_expect(event_type)
            .upon_event('some other event')
        })

        it('multiple events', async function() {
          return Promise.all(multiple_event_types.map(event_type => {
            return while_monitoring(document)
              .do_not_expect(event_type)
              .upon_event('some other event')
          }))
        })
      })

      it('should throw error if causal_event is not a string', function() {
        expect(() => {
          while_monitoring(document).expect(event_type).upon_event(undefined)
        }).to.throw(TypeError, 'causal_event needs to be a String.')
      })

    })
  })
})



// Warn if overriding existing method
if(Array.prototype.copyWithout)
    console.warn("Overriding existing Array.prototype.copyWithout. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.");
Array.prototype.copyWithout = function(without) {
  if (!Array.isArray(without))
    without = [without]

  return this.filter(v => !without.includes(v))
}
Object.defineProperty(Array.prototype, "copyWithout", {enumerable: false});


describe('Array copyWithout', function() {
  const to_copy = Object.freeze([1, 2, 3])

  describe('Copies all', function() {
    it('Without is a single item.', function() {
      const without = 0

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql(to_copy)
    })

    it('Without is an Array.', function() {
      const without = [0]

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql(to_copy)
    })
  })

  describe('Copies without.', function() {
    it('Without is a single item.', function() {
      const without = 2

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql([1, 3])
    })

    it('Without has multiple items.', function() {
      const without = [0, 1, 3]

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql([2])
    })
  })
})