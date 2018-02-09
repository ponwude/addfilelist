function bye() {console.log('bye1')}

function hi() {
  function bye() {console.log('bye2')}

  bye()
}

hi()
bye()
