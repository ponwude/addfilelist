const fs = require('then-fs')
const path = require('path')


const file_path = path.join(
  __dirname,
  'test_post_request_validator_files/simple.txt'
)

;(async() => {
  try {
    const file = await fs.readFile(file_path)
    console.log('file', file)
  } catch(err) {console.error(err)}
})()
