const KNEX = require('knex')

const knex = ({
  client: 'sqlite3',
  connection: {filename: ':memory:'},
  useNullAsDefault: true,
})

