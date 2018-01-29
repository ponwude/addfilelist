Promise.race([
  new Promise(resolve => setTimeout(resolve, 15)),
  new Promise((_, reject) => setTimeout(reject, 10)),
])
.then(() => console.log('resolve'))
.catch(() => console.log('reject'))
