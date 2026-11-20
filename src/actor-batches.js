import * as THREE from 'three'

function addBatch(scene, geometry, material, capacity) {
  const batch = new THREE.InstancedMesh(geometry, material, capacity)
  batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  batch.count = 0
  batch.frustumCulled = false
  scene.add(batch)
  return batch
}

export function createActorBatches(scene, texture, sphere) {
  const opaque = (color) => new THREE.MeshBasicMaterial({ color })
  const stylized = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88, flatShading: true })
  const opacity = (amount) => new THREE.MeshBasicMaterial({
    map: texture, color: 0xffffff, transparent: true, depthWrite: false,
    opacity: amount, blending: THREE.AdditiveBlending,
  })
  const plane = new THREE.PlaneGeometry(1, 1)
  const moteBody = addBatch(scene, sphere, opaque(0xfff6c2), 256)
  const moteLight = addBatch(scene, plane, opacity(.82), 256)
  const shadeBody = addBatch(scene, sphere, stylized(), 256)
  const tail = new THREE.ConeGeometry(.45, .86, 7).rotateZ(Math.PI)
  const shadeTail = addBatch(scene, tail, stylized(), 256)
  const shadeEyes = addBatch(scene, sphere, opaque(0xffffff), 512)
  const shadeHaze = addBatch(scene, plane, opacity(.43), 256)
  const pose = new THREE.Object3D()
  const color = new THREE.Color()

  function matrix(mesh, index, x, y, z, sx, sy, sz, yaw = 0, facing) {
    pose.position.set(x, y, z)
    pose.scale.set(sx, sy, sz)
    if (facing) pose.quaternion.copy(facing)
    else pose.rotation.set(0, yaw, 0)
    pose.updateMatrix()
    mesh.setMatrixAt(index, pose.matrix)
  }

  function draw(game, camera, time, shadeColor, reducedMotion) {
    let i = 0
    for (const { pos, id } of game.motes.values()) {
      const offset = (Number(id.slice(1)) || i) * 1.13
      const [x, ground, z] = pos
      const y = ground + .66 + Math.sin(time * 3 + offset) * .19
      const scale = .78 + .21 * Math.sin(time * 4 + offset)
      const core = .145 * scale
      matrix(moteBody, i, x, y, z, core, core, core)
      matrix(moteLight, i, x, y, z, 1.8 * scale, 1.8 * scale, 1, 0, camera.quaternion)
      i += 1
    }
    moteBody.count = moteLight.count = i
    if (i) {
      const tint = color.setHex(0xffe58a)
      for (let j = 0; j < i; j += 1) moteLight.setColorAt(j, tint)
    }

    const [playerX, , playerZ] = game.player.pos
    const sway = reducedMotion ? 0 : .14 * Math.sin(time * 4)
    i = 0
    for (const shade of game.shades) {
      const [x, center, z] = shade.pos
      const y = center + sway
      const yaw = Math.atan2(playerX - x, playerZ - z)
      const stunned = shade.state === 'stunned'
      matrix(shadeBody, i, x, y, z, .59, stunned ? .46 : .69, .52, yaw)
      shadeBody.setColorAt(i, color.setHex(stunned ? 0x3a3450 : 0x120a1a))
      matrix(shadeTail, i, x, y - .57, z, 1, 1, 1, yaw)
      shadeTail.setColorAt(i, color.setHex(0x302144))
      const c = Math.cos(yaw)
      const s = Math.sin(yaw)
      for (let eye = 0; eye < 2; eye += 1) {
        const dx = eye ? .17 : -.17
        const index = i * 2 + eye
        matrix(shadeEyes, index, x + dx * c + .46 * s, y + .06, z - dx * s + .46 * c,
          .09, .105, .055, yaw)
        shadeEyes.setColorAt(index, color.setHex(shadeColor))
      }
      const size = stunned ? 2.8 : 3.4
      matrix(shadeHaze, i, x, y + .06, z, size, size, 1, 0, camera.quaternion)
      shadeHaze.setColorAt(i, color.setHex(shadeColor).multiplyScalar(stunned ? .42 : 1))
      i += 1
    }
    shadeBody.count = shadeTail.count = shadeHaze.count = i
    shadeEyes.count = i * 2
    for (const batch of [moteBody, moteLight, shadeBody, shadeTail, shadeEyes, shadeHaze]) {
      batch.instanceMatrix.needsUpdate = true
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true
    }
  }

  return { draw }
}
