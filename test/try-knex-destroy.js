const KNEX = require('knex')

knex_db = KNEX({
  client: 'sqlite3',
  connection: {filename: ':memory:'},
  useNullAsDefault: true,
})

knex_db.destroy(() => {
  console.log('destroy 1')
  knex_db.destroy(() => {
    console.log('destroy 2')
  })
})
