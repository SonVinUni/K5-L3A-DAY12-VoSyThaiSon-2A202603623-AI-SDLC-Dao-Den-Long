import * as THREE from 'three'
import { ISLAND_RADIUS, tuning } from './simulation.js'

const clay = (color) => new THREE.MeshStandardMaterial({ color, roughness: .88, flatShading: true })
const unlit = (color) => new THREE.MeshBasicMaterial({ color })
const sphere = new THREE.SphereGeometry(1, 12, 8)
const box = new THREE.BoxGeometry(1, 1, 1)
const circle = new THREE.CircleGeometry(1, 40)
const flareGeometry = new THREE.RingGeometry(.92, 1, 64)
const bark = clay(0x443341)
const rock = clay(0x39354e)
const grassTones = [clay(0x3a5660), clay(0x45465f), clay(0x2d5354)]
const wooden = clay(0x69414b)
const metal = clay(0x5f4954)
const paperDark = clay(0xbb6455)
const paperLit = new THREE.MeshStandardMaterial({ color: 0xffc171, emissive: 0xff9938, emissiveIntensity: 1.45 })
const hot = unlit(0xffd38a)

function put(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  if (scale) mesh.scale.set(...scale)
  parent.add(mesh)
  return mesh
}

function radialTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(.22, '#ffffff9e')
  gradient.addColorStop(.55, '#ffffff38')
  gradient.addColorStop(1, '#ffffff00')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

function glow(parent, texture, color, size, opacity, position) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    color, map: texture, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))
  sprite.scale.set(size, size, 1)
  sprite.position.set(...position)
  parent.add(sprite)
  return sprite
}

function buildLantern(group, texture, index) {
  put(group, new THREE.CylinderGeometry(.67, .82, .22, 8), rock, [0, .11, 0])
  put(group, new THREE.CylinderGeometry(.27, .43, .33, 6), wooden, [0, .35, 0])
  put(group, new THREE.CylinderGeometry(.13, .17, 2.6, 6), wooden, [0, 1.63, 0])
  put(group, box, wooden, [0, 2.32, 0], [1.3, .16, .19])
  put(group, new THREE.CylinderGeometry(.60, .60, .11, 6), metal, [0, 2.55, 0])
  const paper = put(group, new THREE.CylinderGeometry(.55, .47, .88, 6), paperDark, [0, 3.02, 0])
  put(group, new THREE.ConeGeometry(.74, .43, 6), metal, [0, 3.68, 0])
  put(group, sphere, metal, [0, 3.95, 0], [.105, .13, .105])
  for (let rib = 0; rib < 6; rib += 1) {
    const theta = rib * Math.PI / 3
    put(group, box, metal, [Math.sin(theta) * .485, 3.03, Math.cos(theta) * .485], [.041, .9, .041])
  }
  const halo = glow(group, texture, 0xffa44d, 6.5, .12, [0, 3.03, 0])
  const pool = put(group, circle, new THREE.MeshBasicMaterial({
    color: 0xeaaa4d, map: texture, transparent: true, opacity: .24,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), [0, .032 + index * .001, 0], [tuning.safe_radius, tuning.safe_radius, 1])
  pool.rotation.x = -Math.PI / 2
  pool.visible = false
  return { group, paper, halo, pool, lit: false }
}

function makePlayer(texture) {
  const group = new THREE.Group()
  const coat = clay(0x89b1ab)
  const sash = clay(0xad5b54)
  const skin = clay(0xa87262)
  const pants = clay(0x403b59)
  const straw = clay(0xeab875)
  const boot = clay(0x453049)
  const torso = put(group, new THREE.CylinderGeometry(.24, .39, .53, 6), coat, [0, .78, 0])
  put(group, box, sash, [0, .62, .012], [.6, .12, .46])
  put(group, box, clay(0xd77c53), [0, .84, -.20], [.32, .44, .15])
  put(group, sphere, skin, [0, 1.19, 0], [.235, .255, .225])
  put(group, new THREE.ConeGeometry(.54, .28, 32), straw, [0, 1.52, 0])
  put(group, new THREE.CylinderGeometry(.54, .55, .055, 32), clay(0xa66547), [0, 1.38, 0])
  put(group, sphere, unlit(0x25182c), [-.088, 1.2, .21], [.023, .03, .015])
  put(group, sphere, unlit(0x25182c), [.088, 1.2, .21], [.023, .03, .015])
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group()
    leg.position.set(side * .15, .55, 0)
    put(leg, box, pants, [0, -.21, 0], [.19, .41, .21])
    put(leg, box, boot, [0, -.47, .045], [.21, .15, .30])
    group.add(leg)
    put(group, sphere, coat, [side * .32, .85, 0], [.13, .235, .135]).rotation.z = side * .18
    return leg
  })
  put(group, box, metal, [.43, 1.19, .08], [.025, .29, .025])
  put(group, new THREE.CylinderGeometry(.104, .09, .18, 6), paperLit, [.43, 1.02, .08])
  put(group, new THREE.ConeGeometry(.125, .085, 6), metal, [.43, 1.15, .08])
  glow(group, texture, 0xffa13f, 1.65, .65, [.43, 1.02, .08])
  return { group, legs, torso }
}

function makeShade(texture) {
  const group = new THREE.Group()
  const body = put(group, sphere, clay(0x211327), [0, 0, 0], [.59, .69, .52])
  put(group, new THREE.ConeGeometry(.45, .86, 7), clay(0x302144), [0, -.57, 0]).rotation.z = Math.PI
  const eyes = [-1, 1].map((side) => put(group, sphere, unlit(0xddabff),
    [side * .17, .06, .46], [.09, .105, .055]))
  const haze = glow(group, texture, 0x8a44e1, 3.4, .43, [0, .06, 0])
  return { group, body, eyes, haze }
}

function makeIsland(scene, texture) {
  const deck = new THREE.Group()
  scene.add(deck)
  put(deck, new THREE.CylinderGeometry(ISLAND_RADIUS, 25, 2.5, 60), clay(0x40585f), [0, -1.27, 0])
  put(deck, new THREE.CylinderGeometry(25.3, 16, 6, 30), clay(0x342f4c), [0, -5, 0])
  put(deck, new THREE.CylinderGeometry(16, 5, 5, 16), clay(0x25253d), [0, -10.45, 0])
  const path = clay(0x6b686b)
  for (let n = 0; n < 5; n += 1) {
    const angle = (n + .6) * Math.PI * 2 / 5
    for (let stone = 0; stone < 13; stone += 1) {
      const dist = 1.7 + stone * 1.32
      const curve = angle + Math.sin(stone * .35 + n) * .16
      const tile = put(deck, sphere, path, [Math.cos(curve) * dist, .014, Math.sin(curve) * dist],
        [.45 + .18 * Math.sin(stone), .061, .28 + .13 * Math.cos(stone)])
      tile.rotation.y = -curve
    }
  }
  const trunk = new THREE.CylinderGeometry(.12, .22, 2.05, 7)
  const crown = new THREE.ConeGeometry(1, 2, 7)
  for (let i = 0; i < 29; i += 1) {
    const angle = i * 2.399963
    const distance = 20 + (i % 6) * 1.1
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    const tree = new THREE.Group()
    tree.position.set(x, 0, z)
    tree.rotation.y = i * .81
    tree.scale.setScalar(.7 + (i % 7) * .12)
    put(tree, trunk, bark, [0, .97, 0])
    for (let layer = 0; layer < 3; layer += 1) {
      const width = 1.28 - layer * .26
      put(tree, crown, grassTones[(i + layer) % grassTones.length],
        [0, 1.85 + layer * .64, 0], [width, .91, width])
    }
    deck.add(tree)
  }
  const stoneShape = new THREE.DodecahedronGeometry(1)
  const tuft = new THREE.ConeGeometry(.23, .5, 3)
  for (let i = 0; i < 90; i += 1) {
    const angle = i * 2.399963
    const radius = 3 + 23 * Math.sqrt((i + .5) / 90)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const isStone = i % 4 === 0
    const decoration = put(deck, isStone ? stoneShape : tuft, isStone ? rock : grassTones[i % 3],
      [x, .12, z], isStone ? [.42 + i % 3 * .17, .3, .48] : [.85, .54 + i % 3 * .18, .85])
    decoration.rotation.y = i
  }
  for (let i = 0; i < 16; i += 1) {
    const angle = i * 2.399963
    const radius = 31 + i % 6 * 9
    const cloud = glow(scene, texture, i % 2 ? 0x816da8 : 0x6c8caf, 40, .3,
      [Math.cos(angle) * radius, -8 - i % 4, Math.sin(angle) * radius])
    cloud.scale.y = 7 + i % 4
  }
}

function makeSky(scene, texture) {
  const positions = []
  for (let i = 0; i < 450; i += 1) {
    const azimuth = i * 2.399963
    const elevation = .02 + 1.54 * (i + .5) / 450
    const radius = 130 * Math.cos(elevation)
    positions.push(Math.cos(azimuth) * radius, Math.sin(elevation) * 130, Math.sin(azimuth) * radius)
  }
  const stars = new THREE.BufferGeometry()
  stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xead2fc, size: .31, fog: false })))
  const moon = put(scene, sphere, new THREE.MeshBasicMaterial({ color: 0xf5d6bb, fog: false }),
    [-23, 16, 50], [4.2, 4.2, 4.2])
  const aura = glow(scene, texture, 0xe5adbd, 28, .65, moon.position.toArray())
  aura.material.fog = false
  for (let n = 0; n < 6; n += 1) {
    const angle = n * 1.1
    const radius = 44 + n % 3 * 13
    const x = Math.sin(angle) * radius
    const z = Math.cos(angle) * radius
    put(scene, new THREE.CylinderGeometry(4 + n % 3, 1, 10, 7), clay(0x2b2a47), [x, -8 - n % 4, z])
  }
}

export function createWorld(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65))
  renderer.setClearColor(0x252340)
  host.append(renderer.domElement)
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x252340, .015)
  const camera = new THREE.PerspectiveCamera(53, 1, .12, 170)
  const texture = radialTexture()
  const skyLight = new THREE.HemisphereLight(0xcac8ff, 0x2e163b, 2.08)
  scene.add(skyLight)
  const moonlight = new THREE.DirectionalLight(0xa9b5ff, 1.25)
  moonlight.position.set(-12, 18, 10)
  scene.add(moonlight)
  const bounce = new THREE.DirectionalLight(0xffab76, .55)
  bounce.position.set(12, 7, -13)
  scene.add(bounce)
  makeSky(scene, texture)
  makeIsland(scene, texture)

  const player = makePlayer(texture)
  scene.add(player.group)
  const lanternMeshes = Array.from({ length: 5 }, (_, index) => {
    const group = new THREE.Group()
    scene.add(group)
    return buildLantern(group, texture, index)
  })
  const motes = new Map()
  const shades = new Map()
  const pulse = put(scene, flareGeometry, new THREE.MeshBasicMaterial({
    color: 0xffcd82, opacity: 0, transparent: true, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }), [0, .15, 0])
  pulse.rotation.x = -Math.PI / 2
  let pulseAt = -10
  let hitAt = -10
  const aim = new THREE.Vector3()
  const cameraPosition = new THREE.Vector3()
  let lastMode

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    camera.aspect = width / Math.max(1, height)
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }
  resize()
  window.addEventListener('resize', resize)

  function recordEvent(event, time) {
    if (event.name === 'pulse') pulseAt = time
    if (event.name === 'player_hit') hitAt = time
  }

  function draw(game, yaw, time, mode) {
    const { player: actor } = game
    player.group.position.set(...actor.pos)
    player.group.rotation.y = actor.facing
    const walking = mode === 'playing' && game.lastInput.move.some((axis) => axis !== 0)
    const stride = walking ? Math.sin(time * 15) * .43 : 0
    player.legs[0].rotation.x = stride
    player.legs[1].rotation.x = -stride
    player.torso.rotation.x = walking ? .09 : 0
    player.group.visible = time - hitAt > .85 || Math.floor(time * 17) % 2 === 0

    let count = 0
    for (const [index, lantern] of game.lanterns.entries()) {
      const visual = lanternMeshes[index]
      visual.group.position.set(...lantern.pos)
      if (visual.lit !== lantern.lit) {
        visual.lit = lantern.lit
        visual.paper.material = lantern.lit ? paperLit : paperDark
        visual.pool.visible = lantern.lit
      }
      visual.halo.material.opacity = lantern.lit ? .76 + .1 * Math.sin(5 * time + index) : .13
      if (lantern.lit) count += 1
    }
    skyLight.intensity = 2.08 + count * .14
    bounce.intensity = .55 + count * .16

    for (const [id, pos] of game.motes) {
      let mote = motes.get(id)
      if (!mote) {
        mote = new THREE.Group()
        put(mote, sphere, hot, [0, 0, 0], [.145, .145, .145])
        glow(mote, texture, 0xffa73b, 1.8, .82, [0, 0, 0])
        motes.set(id, mote)
        scene.add(mote)
      }
      const offset = Number(id.slice(1)) * 1.13
      mote.position.set(pos[0], pos[1] + .66 + Math.sin(time * 3 + offset) * .19, pos[2])
      mote.scale.setScalar(.78 + .21 * Math.sin(time * 4 + offset))
    }
    for (const [id, mote] of motes) {
      if (game.motes.has(id)) continue
      scene.remove(mote)
      mote.children[1].material.dispose()
      motes.delete(id)
    }

    const activeShades = new Set()
    for (const shade of game.shades) {
      activeShades.add(shade.id)
      let visual = shades.get(shade.id)
      if (!visual) {
        visual = makeShade(texture)
        shades.set(shade.id, visual)
        scene.add(visual.group)
      }
      visual.group.position.set(shade.pos[0], shade.pos[1] + .14 * Math.sin(time * 4), shade.pos[2])
      visual.group.rotation.y = Math.atan2(actor.pos[0] - shade.pos[0], actor.pos[2] - shade.pos[2])
      visual.body.scale.y = shade.state === 'stunned' ? .46 : .69
      visual.haze.material.opacity = shade.state === 'stunned' ? .18 : .43
    }
    for (const [id, visual] of shades) {
      if (activeShades.has(id)) continue
      scene.remove(visual.group)
      for (const object of visual.group.children) object.material?.dispose()
      shades.delete(id)
    }

    const pulseAge = (time - pulseAt) / .55
    pulse.visible = pulseAge < 1
    if (pulse.visible) {
      pulse.position.set(actor.pos[0], .14, actor.pos[2])
      const size = Math.max(.05, pulseAge * tuning.pulse_radius)
      pulse.scale.set(size, size, 1)
      pulse.material.opacity = (1 - pulseAge) * .85
    }

    const [x, y, z] = actor.pos
    if (mode === 'intro') {
      aim.set(1, .6, 4)
      cameraPosition.set(-26 + Math.sin(time * .18) * 4, 17, -34)
    } else {
      cameraPosition.set(x - Math.sin(yaw) * 8.6, y * .65 + 5.9, z - Math.cos(yaw) * 8.6)
      aim.set(x + Math.sin(yaw) * 3, y * .50 + 1.1, z + Math.cos(yaw) * 3)
    }
    if (mode === lastMode) camera.position.lerp(cameraPosition, .14)
    else camera.position.copy(cameraPosition)
    lastMode = mode
    camera.lookAt(aim)
    renderer.render(scene, camera)
  }

  return {
    canvas: renderer.domElement, draw, recordEvent,
    resetEffects() { pulseAt = hitAt = -10 },
  }
}
