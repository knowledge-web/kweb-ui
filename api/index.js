const express = require('express')
const fs = require('fs')
const path = require('path')

const brainDir = process.env.BRAIN_DIR || '../Brain/B02'
const brainJsonDir = process.env.BRAIN_JSON_DIR ? process.env.BRAIN_JSON_DIR : path.join(brainDir, '../db') // ex '../Brain/db'
const rootNode = process.env.ROOT_NODE || '335994d7-2aff-564c-9c20-d2c362e82f8c' // "Knowledge Web" node

function mapFrom (list, { key } = { key: 'Id' }) {
  const map = {}
  list.forEach(item => { map[item[key]] = item })
  return map
}

function readFile (file) {
  if (!fs.existsSync(file)) return ''
  return fs.readFileSync(file, 'utf8')
}

function getContent (id) {
  const f = path.join(brainDir, id)
  if (!fs.existsSync(f) || !fs.statSync(f).isDirectory()) return
  if (!/^[-0-9a-f]{36}$/.test(id)) return
  return {
    md: readFile(path.join(f, 'Notes.md')),
    html: readFile(path.join(f, 'Notes/notes.html'))
  }
}

const fileCache = {} // { filename, mtimeMs, data }
function loadJson (name) {
  const filename = path.join(brainJsonDir, name)
  const stats = fs.statSync(filename)
  if (fileCache[name] && stats.mtimeMs === fileCache[name].mtimeMs) return fileCache[name].data

  console.log(`reloading ${name}`)
  const raw = fs.readFileSync(filename)
  let data = JSON.parse(raw)

  if (name === 'thoughts.json') {
    data = data.filter(t => t.ForgottenDateTime === null) // exclude removed
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
  return loadJson('links.json')
}

const api = express.Router()

api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

api.get('/nodes/:id?', (req, res) => {
  const id = req.params.id || rootNode
  // const levels = req.query.levels || 1 // TODO
  const node = getNodes().find(n => n.Id === id)
  if (!node) return res.send({ })

  let links = getLinks().filter(l => l.ThoughtIdA === id || l.ThoughtIdB === id)
  const map = getNodesMap()

  links = links.map(l => {
    return {
      from: l.ThoughtIdA,
      to: l.ThoughtIdB
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

  const content = getContent(id) || { md: '', html: '' }
  res.send({ nodes, links, content })
})

getNodes()
getLinks()

module.exports = api
