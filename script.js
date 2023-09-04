/* global localStorage, fetch, ForceGraph3D, SpriteText */
// import { UnrealBloomPass } from '//unpkg.com/three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { CSS2DRenderer, CSS2DObject } from '//unpkg.com/three/examples/jsm/renderers/CSS2DRenderer.js'
import { GUI } from '//unpkg.com/dat.gui/build/dat.gui.module.js'
const { marked } = window
marked.setOptions({
  // renderer: new marked.Renderer(),
  // highlight: function(code, lang) {
  //   const hljs = require('highlight.js');
  //   const language = hljs.getLanguage(lang) ? lang : 'plaintext';
  //   return hljs.highlight(code, { language }).value;
  // },
  // langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
  // pedantic: false,
  gfm: true,
  breaks: true
  // sanitize: false,
  // smartypants: false,
  // xhtml: false
})

const MODE = localStorage.getItem('mode') || 'local'
let apiUrl = (MODE === 'local') ? '/api/v0' : 'https://k-web.ismandatory.com/api/v0'
if (localStorage.getItem('apiUrl')) apiUrl = localStorage.getItem('apiUrl')

function toMap (arr) {
  const map = {}
  arr.forEach(item => {
    map[item.id] = item
  })
  return map
}

async function fetchNode (x = 'root') {
  const res = await fetch(`${apiUrl}/nodes/${x}`)
  let { nodes, links, id } = await res.json() // id = current node id / selected (if x is empty)
  if (Array.isArray(nodes)) nodes = toMap(nodes) // if nodes is array make into object with id as key
  if (!id) id = Object.keys(nodes)[0]
  return { nodes, links, id } // TODO return here instead!
}

async function main () {
  const x = window.location.hash.split('id=')[1] // Ex /#id=...
  const { nodes, links, id } = await fetchNode(x)
  loadContent(nodes[id])
  loadMap(nodes, id)

  const gData = { nodes: Object.values(nodes), links }
  const controlType = 'trackball' // trackball / orbit / fly

  const gui = new GUI({ closed: true })
  const settings = {
    // linkStrength: { primary: 0.5, secundary: 0.25 }, // Different link strengths, not a great idea actually
    dimensions: 2
  }
  gui.add(settings, 'dimensions', { '2D': 2, '3D': 3 }).onChange(dimensions => {
    graph.numDimensions(dimensions)
  })
  const guiElement = gui.domElement
  guiElement.style.position = 'absolute'
  guiElement.style.top = '0'
  guiElement.style.right = '0'

  const w = document.documentElement.clientWidth * (1 - (window.ratio || 0.33)) - 64 // 64 = sidebar width? I don't know...
  const graph = ForceGraph3D({ controlType, extraRenderers: [new CSS2DRenderer()] })(document.getElementById('graph'))
    .backgroundColor('rgba(0,0,0,0)')
    .width(w)
    .numDimensions(settings.dimensions)
    .warmupTicks(100)
    .cooldownTicks(0)
    .graphData(gData)
    .nodeRelSize(2)
    .linkHoverPrecision(2)
    .nodeColor(node => node.color || 'rgba(255,255,255,0.8)')
    .nodeLabel(node => node.oneLiner)
    // Link text
    .linkLabel('')
    .linkThreeObjectExtend(true)
    .linkThreeObject(link => {
      // console.log(link.name)
      // extend link with text sprite
      const sprite = new SpriteText(`${link.name}`)
      // sprite.color = link.color || 'white'
      sprite.color = 'rgba(127, 196, 255, 0.66)'
      sprite.textHeight = 2
      // sprite.rotation = 100
      return sprite
    })
    .linkPositionUpdate((sprite, { start, end }) => {
      const middlePos = Object.assign(...['x', 'y', 'z'].map(c => ({
        [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point
      })))
      if (settings.dimensions === 2) middlePos.z = 0
      // Position sprite
      Object.assign(sprite.position, middlePos)
    })

    .nodeThreeObject(node => {
      const nodeEl = document.createElement('div')
      nodeEl.innerHTML = `<img class="icon icon-16" src="${apiUrl}/icons/${node.id}" style="opacity: 1.0;" /> ${node.name}`

      // const img = 'https://picsum.photos/seed/derp/150/150' // random profile image
      // nodeEl.innerHTML = `${node.name}<br><img class="prof" src="${img}" />`
      nodeEl.style.color = node.color || 'rgba(255,255,255,0.8)'
      nodeEl.className = 'node-label'
      // nodeEl.setAttribute('data-id', node.id)
      // FIXME the below work but breaks scroll wheel zoom etc...
      // nodeEl.style['pointer-events'] = 'all'
      // nodeEl.addEventListener('pointerdown', () => { window.location.hash = `id=${node.id}` })
      // nodeEl.addEventListener('pointerover', () => { nodeEl.classList.add('hover') })
      // nodeEl.addEventListener('pointerout', () => { nodeEl.classList.remove('hover') })
      return new CSS2DObject(nodeEl)
    })
    .nodeThreeObjectExtend(true)
    .linkOpacity(0.66)
    .linkColor(link => {
      if (link.color) return link.color
      if (link.secundary) return 'rgba(127,127,127,0.5)'
      return 'rgba(255,255,255,0.5)'
    })
    .linkCurvature(link => link.secundary ? 0.5 : 0)
    // .linkDirectionalArrowLength(3)
    // .linkDirectionalArrowRelPos(1)
    .onNodeClick(node => {
      // goto(node.id)
      window.location.hash = `id=${node.id}`
    })

  // TODO Transparent background: https://stackoverflow.com/a/62858845 ...then enable
  // const bloomPass = new UnrealBloomPass()
  // bloomPass.strength = 2
  // bloomPass.radius = 0.5
  // bloomPass.threshold = 0.1
  // graph.postProcessingComposer().addPass(bloomPass)

  graph.cameraPosition({ z: 275 })
  // graph.onEngineStop(() => graph.zoomToFit(80)) // NOTE not perfect

  if (settings.linkStrength) graph.d3Force('link').strength(link => link.secundary ? settings.linkStrength.secundary : settings.linkStrength.primary)

  // graph.numDimensions(2); // Re-heat simulation

  function contentToHtml (node) {
    if (!node || !node.content) return ''
    let content = node.content
    if (typeof content !== 'object') content = { md: content }
    let html = ''
    let type = ''
    if (content.md) {
      const md = content.md.replaceAll('.data/md-images/', `/data/${node.id}/.data/md-images/`)
      html = marked.parse(md)
      type = 'markdown'
    } else if (content.html) {
      html = content.html
      type = 'html'
    }

    node.type = node.type || {}
    node.wikipedia = node.wikipedia || node.wikilink || '' // wikilink is the new (.py)
    node.tags = node.tags || []

    const metaString = JSON.stringify(node.meta, null, 2)
    const wikidataString = JSON.stringify(node.wikidata, null, 2)
    return `<div class="content-type">${type}</div>
      <details class="debug metadata ${metaString === '{}' ? 'empty' : ''}"><summary>Meta data</summary><pre>${metaString}</pre></details>
      <details class="debug metadata wikidata ${wikidataString === '{}' ? 'empty' : ''}"><summary>Wikidata</summary><pre>${wikidataString}</pre></details>
      <div class="type ${!node.type.name ? 'empty' : ''}">Type: <img class="icon icon-16" src="${apiUrl}/icons/${node.type.id}" /> ${node.type.name}</div>
      <h1 style="color: ${node.color};"><img class="icon icon-32" src="${apiUrl}/icons/${node.id}" onerror="this.style.display='none'" /> ${node.name}</h1>
      <a class="wiki-link" href="${node.wikipedia}" target="_blank">${(node.wikipedia).split('/').pop() || 'NONE'}</a>
      <div class="tags">Tags: ${node.tags.length ? node.tags.map(tag => `<span class="tag">${tag.name}</span>`).join(', ') : '[none]'}</div>
      <div class="one-liner ${!node.oneLiner ? 'empty' : ''}">${node.oneLiner || '[ one-liner ]'}</div>
      ${html}`
  }
  function loadContent (node) {
    const html = contentToHtml(node)
    const element = document.getElementById('content')
    element.innerHTML = html
    element.scrollTop = 0
  }

  function loadMap (nodes, id) {
    const locations = {}
    // extract locations for all nodes
    Object.values(nodes).forEach(node => {
      if (!node.birth) return
      if (node.birth.place) locations[node.id] = { id: node.id, name: node.name, location: node.birth.place }
    })

    // if (!locations[id]) locations = {} // XXX if current node has no location, clear map ...don't do this!

    // const location = extractLocation(node)
    const event = new CustomEvent('show-location', { detail: { locations, mainId: id } })
    window.dispatchEvent(event)
  }

  async function goto (id) {
    const { nodes, links } = await fetchNode(id)
    const gData = { nodes: Object.values(nodes), links }
    graph.graphData(gData)
    loadContent(nodes[id])
    loadMap(nodes, id)
  }

  window.onhashchange = async function () {
    const id = window.location.hash.split('id=')[1]
    goto(id)
    document.querySelector('#search-bar .search').value = ''
    document.querySelector('#search-container .results').innerHTML = ''
  }

  // TODO?
  // function resizeGraph () {
  //   if (graph) {
  //     const height = document.getElementById('graph').clientHeight
  //     const width = document.getElementById('graph').clientWidth
  //     console.log({ width, height })
  //     graph.width(width)
  //     graph.height(height)
  //     graph.controls().handleResize()
  //   }
  // }
  // document.body.onresize = resizeGraph

  async function getNodeList () {
    const res = await fetch(`${apiUrl}/nodes/`)
    const list = await res.json()
    return list
  }

  let list = []
  list = await getNodeList()

  document.querySelector('#search-bar button.random').onclick = async function () {
    if (list.length === 0) list = await getNodeList() // XXX does the request again, not great
    const id = list[Math.floor(Math.random() * list.length)].id
    window.location.hash = `id=${id}`
  }

  document.querySelector('#search-bar .search').oninput = async function () {
    if (list.length === 0) list = await getNodeList() // XXX does the request again, not great
    const query = this.value
    // check list for matches
    const found = list.filter(node => node.name.toLowerCase().includes(query.toLowerCase()))
    const show = found.slice(0, 100)
    const html = show.map(node => {
      return `<div class="result"><a href="#id=${node.id}"><img class="icon icon-16" src="${apiUrl}/icons/${node.id}" /> ${node.name}</a></div>`
    }).join('')
    document.querySelector('#search-container .results').innerHTML = html
  }

  async function fetchStats () {
    const prettyNr = (nr) => nr.toLocaleString('en-US').replaceAll(',', ' ')

    const res = await fetch(`${apiUrl}/stats`)
    const { nodes, links } = await res.json() // id = current node id / selected (if x is empty)
   
    console.log({ nodes, links })
    document.querySelector('#stats .nodes').innerHTML = prettyNr(nodes)
    document.querySelector('#stats .links').innerHTML = prettyNr(links) 
  }

  fetchStats()
}

main()
