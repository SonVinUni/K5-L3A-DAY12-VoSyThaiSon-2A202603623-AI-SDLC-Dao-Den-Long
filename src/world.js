import * as THREE from 'three'
import { HZ, tuning } from './simulation.js'
import { isSafeLantern, isWeakLantern } from './lanterns.js'
import { maps, ramps, surface } from './maps.js'

const clay = (color) => new THREE.MeshStandardMaterial({ color, roughness: .88, flatShading: true })
const unlit = (color) => new THREE.MeshBasicMaterial({ color })
const sphere = new THREE.SphereGeometry(1, 12, 8)
const box = new THREE.BoxGeometry(1, 1, 1)
const circle = new THREE.CircleGeometry(1, 40)
const flareGeometry = new THREE.RingGeometry(.92, 1, 64)
const bark = clay(0x6b4a2f)
const rock = clay(0x39354e)
const grassTones = [clay(0x3a5660), clay(0x45465f), clay(0x2d5354)]
const wooden = clay(0x6b4a2f)
const metal = clay(0x5f4954)
const paperDark = clay(0x5b5f6e)
const paperLit = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 1.45 })
const hot = unlit(0xfff6c2)

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
  const core = put(group, sphere, unlit(0xffe9b0), [0, 3.04, 0], [.55, .30, .55])
  core.visible = false
  const tornShape = new THREE.Shape()
  tornShape.moveTo(-.13, .24)
  tornShape.lineTo(.06, .12)
  tornShape.lineTo(-.02, -.01)
  tornShape.lineTo(.17, -.26)
  tornShape.lineTo(-.17, -.04)
  tornShape.lineTo(-.07, .08)
  tornShape.closePath()
  const tears = new THREE.Group()
  const tornPaper = new THREE.ShapeGeometry(tornShape)
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const tear = put(tears, tornPaper, unlit(0x151726), [Math.sin(angle) * .56, 3.04, Math.cos(angle) * .56])
    tear.rotation.y = angle
  }
  group.add(tears)

  const fuelBar = new THREE.Group()
  group.add(fuelBar)
  fuelBar.position.y = 4.38
  const plane = new THREE.PlaneGeometry(1, 1)
  put(fuelBar, plane, unlit(0x11162b), [0, 0, 0], [1.85, .19, 1])
  const fill = put(fuelBar, plane, unlit(0xffe9b0), [0, 0, .013], [1.67, .09, 1])
  return { group, paper, halo, pool, core, tears, fuelBar, fill }
}

function makePlayer(texture) {
  const group = new THREE.Group()
  const coat = clay(0xe8e2d0)
  const sash = clay(0xc8102e)
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

function makeShade(texture, shadeColor) {
  const group = new THREE.Group()
  const body = put(group, sphere, clay(0x120a1a), [0, 0, 0], [.59, .69, .52])
  put(group, new THREE.ConeGeometry(.45, .86, 7), clay(0x302144), [0, -.57, 0]).rotation.z = Math.PI
  const eyes = [-1, 1].map((side) => put(group, sphere, unlit(shadeColor),
    [side * .17, .06, .46], [.09, .105, .055]))
  const haze = glow(group, texture, shadeColor, 3.4, .43, [0, .06, 0])
  return { group, body, eyes, haze }
}

function makeIsland(scene, texture, night) {
  const deck = new THREE.Group()
  scene.add(deck)
  const map = maps[night]
  const grass = clay(0x2f5d50)
  const sand = clay(0xc9b48a)
  const dark = clay(0x12384a)
  const rockShape = new THREE.DodecahedronGeometry(1)
  const trunk = new THREE.CylinderGeometry(.13, .23, 2, 7)
  const crown = new THREE.ConeGeometry(1.2, 2.25, 7)
  for (const [islandX, radius] of map.islands) {
    put(deck, new THREE.CylinderGeometry(radius, radius * .9, 1.4, 64), grass, [islandX, -.7, 0])
    put(deck, new THREE.CylinderGeometry(radius * .91, radius * .82, 2.1, 48), sand, [islandX, -2.45, 0])
    put(deck, new THREE.CylinderGeometry(radius * .82, radius * .17, 8, 30), dark, [islandX, -7.45, 0])
    for (let index = 0; index < 15; index += 1) {
      const angle = index * 2.399963
      const range = radius - 1.2 - index % 4
      const x = islandX + Math.cos(angle) * range
      const z = Math.sin(angle) * range
      if (night === 2 && Math.abs(z) < 3.6 && x > 24 && x < 46) continue
      put(deck, trunk, bark, [x, 1, z]).scale.setScalar(.85 + index % 4 * .13)
      for (let level = 0; level < 2; level += 1) {
        const scale = (1 - level * .2) * (1 + index % 4 * .09)
        put(deck, crown, grassTones[(index + level) % 3], [x, 2.15 + level * .75, z], [scale, scale, scale])
      }
    }
    for (let index = 0; index < 22; index += 1) {
      const angle = index * 2.399963
      const range = radius * (.20 + .73 * Math.sqrt((index + .2) / 22))
      const x = islandX + Math.cos(angle) * range
      const z = Math.sin(angle) * range
      put(deck, rockShape, index % 2 ? rock : sand,
        [x, (surface(night, x, z) ?? 0) + .09, z], [.34, .16, .47]).rotation.y = angle
    }
  }

  if (night === 2) {
    const bamboo = clay(0x947248)
    for (let index = 0; index < 24; index += 1) {
      put(deck, box, index % 3 ? bamboo : wooden, [26.375 + .75 * index, -.11, 0], [.72, .22, 4])
    }
  }
  if (night === 3) {
    const half = new THREE.Shape()
    half.absarc(0, 0, 24, 0, Math.PI, false)
    half.lineTo(-12, 0)
    half.absarc(0, 0, 12, Math.PI, 0, true)
    half.closePath()
    const rim = put(deck, new THREE.ExtrudeGeometry(half, { bevelEnabled: false, depth: 3, curveSegments: 32 }),
      [grass, sand], [0, 3, 0])
    rim.rotation.x = Math.PI / 2
    for (const [dx, dz] of ramps) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        dx * 30 - dz * 1.5, 0, dz * 30 + dx * 1.5,
        dx * 30 + dz * 1.5, 0, dz * 30 - dx * 1.5,
        dx * 24 + dz * 1.5, 3, dz * 24 - dx * 1.5,
        dx * 24 - dz * 1.5, 3, dz * 24 + dx * 1.5,
      ], 3))
      geometry.setIndex([0, 2, 1, 0, 3, 2])
      geometry.computeVertexNormals()
      put(deck, geometry, new THREE.MeshStandardMaterial({ color: 0xc9b48a, side: THREE.DoubleSide }), [0, 0, 0])
    }
    put(deck, new THREE.CylinderGeometry(8, 8, 6, 48), [sand, grass, sand], [0, 3, 0])
    put(deck, new THREE.CylinderGeometry(2, 2, 7.4, 16), wooden, [0, 9.7, 0])
    put(deck, new THREE.ConeGeometry(2.1, 1.25, 16), rock, [0, 13.375, 0])
    put(deck, new THREE.CylinderGeometry(.56, .74, .75, 14), hot, [0, 12.45, 1.93])
  }
  for (const pad of map.pads) {
    const [x, y, z] = pad.pos
    put(deck, new THREE.CylinderGeometry(1, 1, .10, 28), clay(0xf2c14e), [x, y + .05, z])
    const padMark = put(deck, new THREE.RingGeometry(.57, .78, 28), hot, [x, y + .108, z])
    padMark.rotation.x = -Math.PI / 2
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = index * 2.399963
    const range = 43 + index % 6 * 9
    const cloud = glow(deck, texture, 0x12384a, 45, .52,
      [Math.cos(angle) * range + (night === 2 ? 35 : 0), -8 - index % 4, Math.sin(angle) * range])
    cloud.scale.y = 8 + index % 4
  }
  return deck
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
  renderer.setClearColor(0x0e1430)
  host.append(renderer.domElement)
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x1b2350, .013)
  const camera = new THREE.PerspectiveCamera(53, 1, .12, 170)
  const texture = radialTexture()
  const skyLight = new THREE.HemisphereLight(0xf6ece6, 0x282644, .15)
  scene.add(skyLight)
  const moonlight = new THREE.DirectionalLight(0xa9b5ff, 1.25)
  moonlight.position.set(-12, 18, 10)
  scene.add(moonlight)
  const bounce = new THREE.DirectionalLight(0xffab76, .55)
  bounce.position.set(12, 7, -13)
  scene.add(bounce)
  makeSky(scene, texture)
  let terrain, terrainNight
  let shadeColor = 0x7a3cff

  const player = makePlayer(texture)
  scene.add(player.group)
  const lanternMeshes = Array.from({ length: 7 }, (_, index) => {
    const group = new THREE.Group()
    scene.add(group)
    return buildLantern(group, texture, index)
  })
  const motes = new Map()
  const shades = new Map()
  const ribbons = new Map()
  const tokens = new Map()
  const silk = clay(0x8fa3b8)
  const gold = unlit(0xf2c14e)
  const crimson = unlit(0xc8102e)
  const leaves = new THREE.Group()
  for (let index = 0; index < 16; index += 1) put(leaves, sphere, gold, [0, 0, 0], [.13, .035, .08])
  scene.add(leaves)
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
    if (terrainNight !== game.night) {
      if (terrain) scene.remove(terrain)
      terrain = makeIsland(scene, texture, game.night)
      terrainNight = game.night
    }
    for (const visual of lanternMeshes) visual.group.visible = false
    for (const ribbon of ribbons.values()) ribbon.visible = false
    for (const token of tokens.values()) token.visible = false
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
      visual.group.visible = true
      visual.group.position.set(...lantern.pos)
      const weak = isWeakLantern(lantern)
      const flash = weak && game.sim_tick % 60 >= 30
      visual.group.scale.y = lantern.lit ? 1 : .8
      visual.tears.visible = !lantern.lit
      visual.paper.material = lantern.lit && !flash ? paperLit : paperDark
      visual.pool.visible = isSafeLantern(lantern)
      visual.core.visible = lantern.lit && !flash
      visual.halo.material.opacity = lantern.lit ? flash ? .21 : .76 : .07
      visual.fuelBar.visible = lantern.lit
      const ratio = lantern.fuelUnits / (tuning.fuel_max * HZ)
      visual.fill.scale.x = Math.max(.001, 1.67 * ratio)
      visual.fill.position.x = -.835 + visual.fill.scale.x / 2
      visual.fill.material.color.setHex(flash ? 0x6b5f64 : 0xffe9b0)
      if (lantern.lit) count += 1
    }
    skyLight.intensity = .15 + .55 * count / game.lanterns.length
    bounce.intensity = .85

    for (const { id, pos } of game.motes.values()) {
      let mote = motes.get(id)
      if (!mote) {
        mote = new THREE.Group()
        put(mote, sphere, hot, [0, 0, 0], [.145, .145, .145])
        glow(mote, texture, 0xffe58a, 1.8, .82, [0, 0, 0])
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
        visual = makeShade(texture, shadeColor)
        shades.set(shade.id, visual)
        scene.add(visual.group)
      }
      visual.group.position.set(shade.pos[0], shade.pos[1] + .14 * Math.sin(time * 4), shade.pos[2])
      visual.group.rotation.y = Math.atan2(actor.pos[0] - shade.pos[0], actor.pos[2] - shade.pos[2])
      visual.body.material.color.setHex(shade.state === 'stunned' ? 0x3a3450 : 0x120a1a)
      visual.body.scale.y = shade.state === 'stunned' ? .46 : .69
      visual.haze.material.opacity = shade.state === 'stunned' ? .18 : .43
    }
    for (const [id, visual] of shades) {
      if (activeShades.has(id)) continue
      scene.remove(visual.group)
      for (const object of visual.group.children) object.material?.dispose()
      shades.delete(id)
    }


    for (const drifter of game.drifters) {
      let ribbon = ribbons.get(drifter.id)
      if (drifter.state === 'removed') {
        if (ribbon) ribbon.visible = false
        continue
      }
      if (!ribbon) {
        ribbon = new THREE.Group()
        for (let part = 0; part < 7; part += 1) {
          put(ribbon, sphere, silk, [0, 0, 0], [.24, .10, .32])
        }
        scene.add(ribbon)
        ribbons.set(drifter.id, ribbon)
      }
      ribbon.visible = true
      ribbon.position.set(drifter.pos[0], drifter.pos[1] + .2, drifter.pos[2])
      ribbon.rotation.y = Math.atan2(actor.pos[0] - drifter.pos[0], actor.pos[2] - drifter.pos[2])
      ribbon.children.forEach((segment, index) => segment.position.set(
        Math.sin(time * 9 + index * .8) * .24, Math.cos(time * 6 + index) * .09, index * -.27))
    }
    for (const charm of game.charms) {
      let token = tokens.get(charm.id)
      if (!token) {
        token = new THREE.Group()
        put(token, box, gold, [0, 0, 0], [.48, .70, .08])
        put(token, box, crimson, [0, 0, .05], [.36, .57, .025])
        scene.add(token)
        tokens.set(charm.id, token)
      }
      token.visible = charm.available
      token.position.set(charm.pos[0], charm.pos[1] + .75 + .13 * Math.sin(time * 4), charm.pos[2])
      token.rotation.y = time * 1.5
    }
    const angle = game.wind.dir_deg * Math.PI / 180
    leaves.visible = game.wind.active || game.wind.warning
    if (leaves.visible) leaves.children.forEach((leaf, index) => {
      const offset = (time * (game.wind.active ? 7 : 3) + index * 2.17) % 18 - 9
      const side = index % 7 - 3
      leaf.position.set(actor.pos[0] + Math.cos(angle) * offset - Math.sin(angle) * side,
        actor.pos[1] + .65 + index % 3 * .32, actor.pos[2] + Math.sin(angle) * offset + Math.cos(angle) * side)
      leaf.rotation.set(time * 2 + index, angle, index)
    })

    const pulseAge = (time - pulseAt) / .55
    pulse.visible = pulseAge < 1
    if (pulse.visible) {
      pulse.position.set(actor.pos[0], .14, actor.pos[2])
      const size = Math.max(.05, pulseAge * tuning.pulse_radius)
      pulse.scale.set(size, size, 1)
      pulse.material.opacity = (1 - pulseAge) * .85
    }

    const [x, y, z] = actor.pos
    if (mode === 'intro' || mode === 'menu') {
      aim.set(game.night === 2 ? 33 : 1, .6, 4)
      cameraPosition.set((game.night === 2 ? -3 : -38) + Math.sin(time * .18) * 4, 28, -46)
    } else {
      cameraPosition.set(x - Math.sin(yaw) * 8.6, Math.max(-4, y) + 5.9, z - Math.cos(yaw) * 8.6)
      aim.set(x + Math.sin(yaw) * 3, Math.max(-5, y) + 1.1, z + Math.cos(yaw) * 3)
    }
    if (mode === lastMode) camera.position.lerp(cameraPosition, .14)
    else camera.position.copy(cameraPosition)
    lastMode = mode
    camera.lookAt(aim)
    for (const visual of lanternMeshes) visual.fuelBar.quaternion.copy(camera.quaternion)
    renderer.render(scene, camera)
  }

  function projectTarget(pos) {
    const target = new THREE.Vector3(pos[0], pos[1] + 3, pos[2])
    const relative = target.clone().applyMatrix4(camera.matrixWorldInverse)
    target.project(camera)
    const visible = relative.z < 0 && Math.abs(target.x) <= .91 && Math.abs(target.y) <= .84
    return { visible, angle: Math.atan2(relative.x, -relative.z) * 180 / Math.PI }
  }


  return {
    projectTarget, canvas: renderer.domElement, draw, recordEvent,
    resetEffects() { pulseAt = hitAt = -10 },
    setAccessiblePalette(enabled) {
      shadeColor = enabled ? 0x00b3ff : 0x7a3cff
      for (const { eyes, haze } of shades.values()) {
        haze.material.color.setHex(shadeColor)
        for (const eye of eyes) eye.material.color.setHex(shadeColor)
      }
    },
  }
}
