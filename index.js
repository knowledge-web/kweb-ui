const express = require('express')
const fs = require('fs')
const path = require('path')

function mapFrom (list, { key } = { key: 'Id' }) {
  const map = {}
  list.forEach(item => map[item[key]] = item)
  return map
}

const brainDir = process.env.BRAIN_DIR || '../Brain/B02'
const brainJsonDir = process.env.BRAIN_JSON_DIR ? process.env.BRAIN_JSON_DIR : path.join(brainDir, '../db') // ex '../Brain/db'
const port = process.env.PORT || 7575

const config = { }
config.hideBrainId = process.env.HIDE_BRAINID === 'false' ? false : true
config.hidePrivate = process.env.HIDE_PRIVATE === 'false' ? false : true
// config.hideWip = process.env.HIDE_WIP === 'false' ? false : true
config.rootNode = process.env.ROOT_NODE || '335994d7-2aff-564c-9c20-d2c362e82f8c'

let fileCache = {} // { filename, mtimeMs, data }
function loadJson (name) {
  const filename = path.join(brainJsonDir, name)
  const stats = fs.statSync(filename)
  if (fileCache[name] && stats.mtimeMs === fileCache[name].mtimeMs) return fileCache[name].data

  console.log(`reloading ${name}`)
  const raw = fs.readFileSync(filename)
  let data = JSON.parse(raw)

  if (name === 'thoughts.json') {
    data = data.filter(t => t.ForgottenDateTime === null) // exclude removed
    if (config.hideWip) data = data.filter(t => !t.Name.includes('Connections 4')) // exclude Connections 4 stuff?
    // if (config.hidePrivate) data = data.filter(t => t.ACType === 0) // exclude private
    if (config.hideBrainId) data.forEach(node => { delete node.brainId })
  } else if (name === 'links.json') {
    const nodes = loadJson('thoughts.json')
    const map = mapFrom(nodes)
    data = data.filter(l => map[l.ThoughtIdA] && map[l.ThoughtIdB]) // exclude links not linking to available thoughts
    // console.log(data.length, '<-- links')
  }

  if (!fileCache[name]) fileCache[name] = {}
  fileCache[name].data = data
  fileCache[name].mtimeMs = stats.mtimeMs

  return data
}

function getNodes () {
  return loadJson('thoughts.json')
}
function getNodesMap () {
  const nodes = getNodes()
  return mapFrom(nodes)
}

function getLinks () {
  const nodes = getNodes()
  return loadJson('links.json')
}

const app = express()

app.use('/ui', express.static('./ui'))

app.get('/nodes/:id?', (req, res) => {
  const id = req.params.id || config.rootNode
  // const levels = req.query.levels || 1 // TODO
  const node = getNodes().find(n => n.Id === id)
  if (!node) return res.send({ })

  let links = getLinks().filter(l => l.ThoughtIdA === id || l.ThoughtIdB === id)
  const map = getNodesMap()

  links = links.map(l => {
    return {
      from: l.ThoughtIdA,
      to: l.ThoughtIdB,
    }
  })

  let nodes = {}
  nodes[id] = node

  links.forEach(l => {
    nodes[l.from] = map[l.from]
    nodes[l.to] = map[l.to]
  })

  nodes = Object.values(nodes)
  nodes = nodes.map(n => {
    return {
      id: n.Id,
      label: n.Name
    }
  })

  res.send({ nodes, links })
})

getNodes()
getLinks()

app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
