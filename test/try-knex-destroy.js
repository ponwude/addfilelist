const KNEX = require('knex')


describe('after each destroy database', function() {

  let knex_db
  const new_database = () => {
    console.log('create')
    knex_db = KNEX({
      client: 'sqlite3',
      connection: {filename: ':memory:'},
      useNullAsDefault: true,
    })
  }

  // const destroy_database = done => {
  //   console.log('destroy')
  //   knex_db.destroy(done)
  // }
  const destroy_database = () => {
    console.log('destroy')
    return knex_db.destroy()
  }

  before(new_database)
  after(destroy_database)

  describe('needs to be destroyed after each', function() {
    beforeEach(new_database)
    afterEach(destroy_database)

    it('test 1', ()=>{})
    it('test 2', ()=>{})
  })

  describe('tests need to be run on the same database', function() {
    it('test 3', ()=>{})
    it('test 4', ()=>{})
  })

})
