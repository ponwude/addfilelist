module.exports = function(form) {
  const XHR = new XMLHttpRequest()

  // Define what happens on successful data submission
  XHR.addEventListener("load", function(event) {
    alert(event.target.responseText)
  })

  // Define what happens in case of error
  XHR.addEventListener("error", function(event) {
    alert('Oups! Something goes wrong.')
  })

  // Set up our request
  XHR.open("POST", './' + window.form_type)

  // The data sent is what the user provided in the form
  XHR.send(new FormData(form))
}
