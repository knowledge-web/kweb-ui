const express = require('express')
const api = require('./api')
const port = process.env.PORT || 7575

const app = express()

app.get('/info', (req, res) => {
  res.send(`<h1>Welcome to the Knowledge Web prototype!</h1>
  <p>
    This is what we are building: <a href="https://burkives.notion.site/K-Web-UI-Minimal-Product-dc76722ef10b465c8d987e8f16bedc95?pvs=4">Design document</a>.<br>
    This is where it is built (starting 2023-07-18): <a href="/">prototype</a>.<br>
    <br>
    Join the community on <a href="https://www.facebook.com/James-Burkes-Knowledge-Web-1636642569892667/">Facebook</a>.<br>
    Want to work on the code? Contact karl@passionismandatory.com.
  </p>`)
})

app.use('/', express.static('./ui'))

app.use('/api/v0', api)

app.get('/robots.txt', (req, res) => {
  if (process.env.ROBOTS_OK) return res.sendStatus(404)
  res.send('User-agent: *\nDisallow: /')
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
