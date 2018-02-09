const _ = require('lodash')


const collection = {a: 1, b: 2}

const filtered = _.filter(collection, function(){
  console.log('arguments', arguments)
  return true
})

console.log('filtered', filtered)
