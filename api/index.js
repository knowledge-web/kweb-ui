const express = require('express')
const fs = require('fs')
const path = require('path')

const brainDir = process.env.BRAIN_DIR || '../Brain/B02'
const brainJsonDir = process.env.BRAIN_JSON_DIR ? process.env.BRAIN_JSON_DIR : path.join(brainDir, '../db') // ex '../Brain/db'
const rootNode = process.env.ROOT_NODE || '335994d7-2aff-564c-9c20-d2c362e82f8c' // "Knowledge Web" node
const includeContent = process.env.CONTENT !== 'false'

console.log('config:')
console.log({ brainDir, brainJsonDir, rootNode, includeContent })

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
  if (!fs.existsSync(f) || !fs.statSync(f).isDirectory()) return {}
  if (!/^[-0-9a-f]{36}$/.test(id)) return {}
  return {
    md: readFile(path.join(f, 'Notes.md')),
    html: readFile(path.join(f, 'Notes/notes.html'))
  }
}

function extractMeta (id) {
  const meta = {}

  const content = getContent(id)
  let txt = content.md || content.html
  if (!txt) return {}

  txt = txt.replaceAll(/achievement\(s\):/ig, 'achievements:') // standardize
  txt = txt.replaceAll(/DATE\/PLACE OF DEATH\/AGE AT DEATH:/ig, 'DATE AND PLACE OF DEATH:')

  txt = txt.replaceAll(/DATE AND PLACE OF BIRTH:/ig, 'Born:')
  txt = txt.replaceAll(/DATE AND PLACE OF DEATH:/ig, 'Died:')

  const extract = [
    'NAME',
    'OTHER-NAME', // things only?
    'INVENTED/BEGAN', // things only  // XXX can be one dor date & one for place ...also
    // DATE INVENTED/BEGAN
    // PLACE INVENTED/BEGAN
    'ACHIEVEMENTS',
    'NICKNAME/ALIAS',
    'BORN',
    'DIED',
    'CATEGORY', // things only?
    'DISCIPLINE',
    'FIELD',
    'LANGUAGE',
    'PARENTS',
    'SIBLINGS',
    'SPOUSE',
    'CHILDREN',
    'EDUCATION',
    'MAJOR WORK',
    // 'LIFE AND TIMES', // FIXME always several lines...
    // 'DEAILS', // things only? // FIXME always several lines...
    'ASSESSMENT',
    'EXTRA CONNECTIONS', // FIXME often several lines...
    'ONELINER'
  ].map(s => s.toLowerCase())

  for (const key of extract) {
    const pat = key + ':\\s+(.*)'
    let match = (new RegExp(pat, 'ig').exec(txt) || ['', ''])[1]
    if (!match) continue
    match = match.split('<br />')[0]
    match = match.split('<br/>')[0]
    match = match.replace(/<\/?[^>]+(>|$)/g, '')
    meta[key] = match
  }
  return meta
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

    // exclude thoughts not in wiki-links?
    // const wikiLinks = require('../../wiki-links.json')
    // const wikiLinkNames = Object.keys(wikiLinks)
    // data = data.filter(t => wikiLinkNames.includes(t.Name)) // exclude thoughts not in wiki-links

    // NOTE CONSIDER extractMeta could also be done here for everything...
  } else if (name === 'links.json') {
    const nodes = loadJson('thoughts.json')
    const map = mapFrom(nodes)
    data = data.filter(l => l.Kind === Links.Kind.Type || (map[l.ThoughtIdA] && map[l.ThoughtIdB])) // exclude links not linking to available thoughts
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

const Thoughts = {
  ACType: { Public: 0, Private: 1 },
  Kind: { Normal: 1, Type: 2, Tag: 4 } // 5 Seems to be "Pinned"
}
const Links = {
  // Relation
  // Direction - Binary flags
  // Meaning
  Kind: { Normal: 1, Type: 2 }
}
// const Links = { // TODO from: https://forums.thebrain.com/post/in-links-json-what-are-these-fields-10616870
//   Relation
//   NoValue = 0,
//   Child = 1,
//   Parent = 2,
//   Jump = 3,
//   Sibling = 4,

//   Direction - Binary flags
//   OneWay = 4, // x1xx, 1 means One-Way Link;
//   DirectionBA = 2, // xx1x, 0 means A -> B, 1 means B -> A, isBackward
//   IsDirected = 1, // xxx1, 1 means Is-Directed; xxx0 means Not-Directed

//   Meaning
//   Normal = 1,
//   InstanceOf = 2, // Type (A) to Normal Thought (B)
//   TypeOf = 3, // Super Type (A) to Type (B)
//   HasEvent = 4,
//   HasTag = 5, // Tag (A) to Normal or Type Thought (B)
//   System = 6,
//   SubTagOf = 7, // Super Tag (A) to Tag (B)

//   Kind
//   Normal = 1,
//   Type = 2,
// }

function getTags (id, map, links) { // map should be a map of all, nodes
  if (!map[id]) return []
  links = links.filter(l => l.ThoughtIdA === id || l.ThoughtIdB === id) // remove irrelevant links
  links = links.map(l => l.ThoughtIdA !== id ? l.ThoughtIdA : l.ThoughtIdB) // get the other id
  links = links.filter(l => map[l] && map[l].Kind === Thoughts.Kind.Tag) // remove non-tags
  const tags = links.map(l => ({ id: map[l].Id, name: map[l].Name }))
  return tags
}

// NOTE copied from K-WEB UI (first version)
function toColor (num) {
  if (!num) return null
  num >>>= 0
  const b = num & 0xFF
  const g = (num & 0xFF00) >>> 8
  const r = (num & 0xFF0000) >>> 16
  // const a = ( (num & 0xFF000000) >>> 24 ) / 255
  return `rgb(${[r, g, b].join(',')})`
}

const api = express.Router()

api.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

api.get('/nodes', (req, res) => {
  const nodes = getNodes()
  // return only a list of { name, id }
  // filter only normal nodes
  let list = nodes.filter(n => n.Kind === Thoughts.Kind.Normal)
  list = list.map(n => ({ name: n.Name, id: n.Id }))
  res.send(list)
})

api.get('/nodes/:id?', (req, res) => {
  let { id } = req.params
  if (id === 'root') id = rootNode
  // const levels = req.query.levels || 1 // TODO
  const node = getNodes().find(n => n.Id === id)
  if (!node) return res.send({ })

  const allLinks = getLinks()
  let links = allLinks.filter(l => l.ThoughtIdA === id || l.ThoughtIdB === id)
  const map = getNodesMap()

  let nodes = {}
  nodes[id] = node

  links.forEach(l => {
    nodes[l.ThoughtIdA] = map[l.ThoughtIdA]
    nodes[l.ThoughtIdB] = map[l.ThoughtIdB]
  })

  // remove Kind != Normal
  nodes = Object.values(nodes).filter(n => n.Kind === Thoughts.Kind.Normal)
  nodes = mapFrom(nodes)
  links = links.filter(l => nodes[l.ThoughtIdA] && nodes[l.ThoughtIdB])
  allLinks.forEach(l => {
    if (l.ThoughtIdA === id || l.ThoughtIdB === id) return // we already have this one
    if (nodes[l.ThoughtIdA] && nodes[l.ThoughtIdB]) {
      const link = { ...l, secundary: true } // add indirect link
      // console.log({ link })
      links.push(link)
    }
  })

  for (const [i, node] of Object.entries(nodes)) {
    let content = ''
    if (includeContent) {
      if (i === id) content = getContent(i) // or remove this if
    }

    const type = { id: node.TypeId, name: map[node.TypeId] ? map[node.TypeId].Name : '' }
    const tags = getTags(id, map, allLinks)
    const meta = extractMeta(i)
    const oneLiner = node.Label || meta.oneliner || meta['one-liner'] || meta.achievements || ''
    nodes[i] = {
      id: node.Id,
      name: node.Name,
      label: node.Label,
      oneLiner,
      color: toColor(node.ForegroundColor),
      // bgColor: toColor(node.BackgroundColor), // never used? (I saw once)
      type,
      tags,
      content,
      meta
    }
  }

  function getLinkType (typeId) {
    if (!typeId) return ''
    typeId = typeId.toLowerCase()
    const link = allLinks.find(l => l.Id === typeId)
    return link ? link.Name : ''
  }

  links = links.map(l => {
    const typeName = getLinkType(l.TypeId, links)
    return {
      name: l.Name || typeName,
      source: l.ThoughtIdA,
      target: l.ThoughtIdB,
      color: toColor(l.Color),
      secundary: l.secundary
    }
  })

  res.send({ nodes, links, id }) // nodes is a map, links is an array
})

api.get('/icons/:id', (req, res) => { // copied from an experiment
  const fileName = (id) => path.join(__dirname, '..', brainDir, id, '.data', 'Icon.png')

  const { id } = req.params
  if (!/^[-0-9a-f]{36}$/.test(id)) return

  let file = fileName(id)
  if (fs.existsSync(file)) return res.sendFile(file)

  const node = getNodes().find(n => n.Id === id)
  if (node.TypeId) {
    file = fileName(node.TypeId)
    if (fs.existsSync(file)) return res.sendFile(file)
  }

  res.sendFile(path.join(__dirname, '../ui', 'empty.png'))
})

getNodes()
getLinks()

module.exports = api
