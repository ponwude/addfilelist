const jsdom = require('jsdom')
const { JSDOM } = jsdom

const dom = new JSDOM(`
  <!DOCTYPE html>
  <body>
    <form>

      <input name="input0" value="input0 val">

      <div>
        <input name="div_input" value="div_input val">
      </div>

    </form>
  </body>
  <script>
    const form = document.querySelector('form')
    console.log('form', form)

    const inputs = form.querySelector('input')
    console.log('inputs', inputs)

    const form_data = new FormData(form)
    console.log('form_data', form_data)

    const entries = Array.from(form_data.entries())
    console.log('entries', entries)
  </script>
`, {
  runScripts: 'dangerously',
})


