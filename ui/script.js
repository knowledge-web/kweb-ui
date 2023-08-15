/* global localStorage, fetch, ForceGraph3D, SpriteText */
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

const MODE = 'local' // TODO make 'external' work
let apiUrl = MODE === 'local' ? '/api/v0' : 'https://k-web.ismandatory.com/api/v0'
if (localStorage.getItem('apiUrl')) apiUrl = localStorage.getItem('apiUrl')

async function fetchNode (x = '') {
  console.log(`${apiUrl}/nodes/${x}`)
  const res = await fetch(`${apiUrl}/nodes/${x}`)
  const { nodes, links, id } = await res.json() // id = current node id / selected (if x is empty)
  return { nodes, links, id } // TODO return here instead!
}

async function main () {
  const x = window.location.hash.split('id=')[1] // Ex /#id=...
  const { nodes, links, id } = await fetchNode(x)
  loadContent(nodes[id])

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
  guiElement.style.left = '0'

  const w = document.documentElement.clientWidth * (1 - (window.ratio || 0.33)) - 64 // 64 = sidebar width? I don't know...
  const graph = ForceGraph3D({ controlType, extraRenderers: [new CSS2DRenderer()] })(document.getElementById('graph'))
    .width(w)
    .numDimensions(settings.dimensions)
    .warmupTicks(100)
    .cooldownTicks(0)
    .graphData(gData)
    .nodeRelSize(2)
    .nodeColor(node => node.color || 'rgba(255,255,255,0.8)')
    .nodeLabel(node => node.oneLiner)
    // Link text
    .linkLabel('')
    .linkThreeObjectExtend(true)
    .linkThreeObject(link => {
      console.log(link.name)
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
      nodeEl.innerHTML = `<img src="${apiUrl}/icons/${node.id}" height="16" style="opacity: 1.0;" /> ${node.name}`

      // const img = 'https://picsum.photos/seed/derp/150/150' // random profile image
      // nodeEl.innerHTML = `${node.name}<br><img class="prof" src="${img}" />`
      nodeEl.style.color = node.color || 'rgba(255,255,255,0.8)'
      nodeEl.className = 'node-label'
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

  graph.cameraPosition({ z: 275 })
  // graph.onEngineStop(() => graph.zoomToFit(80)) // NOTE not perfect

  if (settings.linkStrength) graph.d3Force('link').strength(link => link.secundary ? settings.linkStrength.secundary : settings.linkStrength.primary)

  // graph.numDimensions(2); // Re-heat simulation

  function contentToHtml (node) {
    const { content } = node
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

    const metaString = JSON.stringify(node.meta, null, 2)
    return `<div class="content-type">${type}</div>
      <details class="debug metadata ${metaString === '{}' ? 'empty' : ''}"><summary>Meta data</summary><pre>${metaString}</pre></details>
      <div class="type ${!node.type.name ? 'empty' : ''}">Type: <img src="${apiUrl}/icons/${node.type.id}" height="16" /> ${node.type.name}</div>
      <h1 style="color: ${node.color};"><img class="icon" src="${apiUrl}/icons/${node.id}" height="32" /> ${node.name}</h1>
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

  async function goto (id) {
    const { nodes, links } = await fetchNode(id)
    const gData = { nodes: Object.values(nodes), links }
    graph.graphData(gData)
    loadContent(nodes[id])
  }

  window.onhashchange = async function () {
    const id = window.location.hash.split('id=')[1]
    goto(id)
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
}

main()
