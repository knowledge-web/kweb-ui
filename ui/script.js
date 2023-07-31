import { CSS2DRenderer, CSS2DObject } from '//unpkg.com/three/examples/jsm/renderers/CSS2DRenderer.js'

const MODE = 'local' // TODO make 'external' work
let apiUrl = MODE === 'local' ? '/api/v0' : 'https://k-web.ismandatory.com/api/v0'
if (localStorage.getItem('apiUrl')) apiUrl = localStorage.getItem('apiUrl')

async function fetchNode (x = '') {
  console.log(`${apiUrl}/nodes/${x}`)
  const res = await fetch(`${apiUrl}/nodes/${x}`)
  let { nodes, links, id } = await res.json() // id = current node id / selected (if x is empty)
  return { nodes, links, id } // TODO return here instead!
}


async function main () {
  const x = window.location.hash.split('id=')[1] // Ex /#id=...
  const { nodes, links, id } = await fetchNode(x)

  const gData = { nodes: Object.values(nodes), links }
  const controlType = 'trackball' // trackball / orbit / fly
  
  const graph = ForceGraph3D({ controlType, extraRenderers: [new CSS2DRenderer()] })(document.getElementById('3d-graph'))
    .numDimensions(2)
    .cooldownTicks(100)
    .graphData(gData)
    .nodeRelSize(3)
    .nodeColor(node => node.color || 'rgba(255,255,255,0.8)')
    .nodeLabel(node => node.oneLiner)
    // Link text
    // XXX Works only in 3D!!!
    // .linkThreeObjectExtend(true)
    // .linkThreeObject(link => {
    //   // extend link with text sprite
    //   const sprite = new SpriteText(`${link.name}`);
    //   sprite.color = 'lightgrey';
    //   sprite.textHeight = 3;
    //   return sprite;
    // })
    // .linkPositionUpdate((sprite, { start, end }) => {
    //   const middlePos = Object.assign(...['x', 'y', 'z'].map(c => ({
    //     [c]: start[c] + (end[c] - start[c]) / 2 // calc middle point
    //   })));

    //   // Position sprite
    //   Object.assign(sprite.position, middlePos);
    // })

    .nodeThreeObject(node => {
      console.log(node.color)
      const nodeEl = document.createElement('div');
      nodeEl.textContent = node.name;
      // console.log(node.name)
      nodeEl.style.color = node.color || 'rgba(255,255,255,0.8)'
      nodeEl.className = 'node-label'
      return new CSS2DObject(nodeEl)
    })
    .nodeThreeObjectExtend(true)
    .onNodeClick(node => {
      // goto(node.id)
      window.location.hash = `id=${node.id}`
    })

    graph.cameraPosition({ z: 250 })
    // graph.onEngineStop(() => graph.zoomToFit(80)) // NOTE not perfect

  const settings = { // NOTE not working as I wanted...
    // TODO strength instead of distance!!?
    primaryDistance: 50,
    secundaryDistance: 50
  }
  const linkForce = graph
    .d3Force('link')
    .distance(link => link.secundary ? settings.secundaryDistance : settings.primaryDistance)

  // graph.numDimensions(2); // Re-heat simulation

  async function goto (id) {
    const { nodes, links } = await fetchNode(id)
    const gData = { nodes: Object.values(nodes), links }
    graph.graphData(gData)
  }

  window.onhashchange = async function () {
    const id = window.location.hash.split('id=')[1]
    goto(id)
  }
}

main()