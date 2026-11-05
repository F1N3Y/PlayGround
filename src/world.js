import * as THREE from 'three'
import { VOID_Y, MONSTERS, RARITY } from './data.js'

export const TILE = 2.4

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const rand = (a, b) => a + Math.random() * (b - a)

function hash2(x, z, s = 1) {
  const n = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453
  return n - Math.floor(n)
}

const tileKey = (gx, gz) => `${gx},${gz}`
const worldPos = (gx, gz) => ({ x: gx * TILE, z: gz * TILE })

// ---------------------------------------------------------------------------
// procedural textures
// ---------------------------------------------------------------------------
function canvasTexture(size, draw, repeat = 1) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  draw(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 4
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function grassTexture() {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s)
    g.addColorStop(0, '#5c8a68')
    g.addColorStop(0.45, '#4b765e')
    g.addColorStop(1, '#3f6855')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * s, y = Math.random() * s
      const l = Math.random()
      ctx.strokeStyle = l > 0.7 ? 'rgba(166,224,178,.28)' : 'rgba(31,69,58,.35)'
      ctx.lineWidth = Math.random() * 1.5 + 0.4
      ctx.beginPath(); ctx.moveTo(x, y)
      ctx.lineTo(x + rand(-2, 2), y - rand(2, 7)); ctx.stroke()
    }
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = `rgba(${140 + Math.random() * 60},${210 + Math.random() * 40},${170 + Math.random() * 40},${0.25 + Math.random() * 0.3})`
      ctx.beginPath(); ctx.arc(Math.random() * s, Math.random() * s, rand(0.8, 2.2), 0, 7); ctx.fill()
    }
  }, 1)
}

function dirtTexture() {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#46382e'; ctx.fillRect(0, 0, s, s)
    for (let y = 0; y < s; y += 6) {
      const shade = 30 + Math.sin(y * 0.09) * 8 + Math.random() * 10
      ctx.fillStyle = `rgba(${shade + 24},${shade + 14},${shade + 7},.55)`
      ctx.fillRect(0, y + Math.random() * 4, s, rand(1, 5))
    }
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * s, y = Math.random() * s
      ctx.fillStyle = Math.random() > 0.6 ? 'rgba(130,113,86,.45)' : 'rgba(24,20,18,.5)'
      ctx.beginPath(); ctx.arc(x, y, rand(0.6, 2.6), 0, 7); ctx.fill()
    }
    for (let i = 0; i < 22; i++) {
      ctx.strokeStyle = 'rgba(20,16,14,.4)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(Math.random() * s, 0); ctx.bezierCurveTo(rand(0, s), s * .3, rand(0, s), s * .7, Math.random() * s, s); ctx.stroke()
    }
  }, 1)
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(180,255,225,.85)')
  g.addColorStop(1, 'rgba(120,255,210,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------------------------------------------------------------------------
// void sky shader
// ---------------------------------------------------------------------------
const voidVert = `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const voidFrag = `
  uniform float uTime;
  uniform float uNight;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i=0;i<4;i++){ v += a*noise(p); p = p*2.03 + 13.7; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = vWorld.xz * 0.035;
    float t = uTime * 0.018;
    float n = fbm(p + vec2(t, -t*0.7));
    float n2 = fbm(p * 2.1 + vec2(-t*0.8, t*0.4));
    float bloom = smoothstep(0.48, 0.95, n * 0.7 + n2 * 0.45);
    vec3 col = mix(vec3(0.004,0.006,0.014), vec3(0.035,0.024,0.085), bloom);
    col += vec3(0.015,0.055,0.065) * smoothstep(0.68, 0.96, n2) * 0.85;
    float glint = step(0.9982, hash(floor(vWorld.xz * 2.4) + floor(uTime * 0.2)));
    col += vec3(0.45, 0.85, 0.95) * glint * 0.7 * (1.0 - uNight*0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`

export class World {
  constructor(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x070b10)
    this.scene.fog = new THREE.FogExp2(0x05080b, 0.018)
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.08, 280)
    this.camera.position.set(9, 6.5, 11)

    this.clock = new THREE.Clock()
    this.time = 0
    this.night = 0
    this.tiles = new Map()
    this.trees = []
    this.fires = []
    this.stills = []
    this.chests = []
    this.monsters = []
    this.effects = []
    this.ripples = []
    this.ghosts = []
    this.glows = []
    this.held = null
    this.heldKind = 'rod'
    this.rodTip = new THREE.Object3D()

    this.glowTex = glowTexture()
    this.grassTex = grassTexture()
    this.dirtTex = dirtTexture()

    this.buildLights()
    this.buildVoid()
    this.buildSky()
    this.buildHeldModels()
    this.buildFishingRig()
    this.buildParticles()

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  // -------------------------------------------------------------------------
  // environment
  // -------------------------------------------------------------------------
  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xa8e8ff, 0x15251f, 0.8)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xffe2b0, 2.3)
    this.sun.position.set(9, 14, 6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.left = -14
    this.sun.shadow.camera.right = 14
    this.sun.shadow.camera.top = 14
    this.sun.shadow.camera.bottom = -14
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 50
    this.sun.shadow.bias = -0.001
    this.scene.add(this.sun)
    this.rim = new THREE.DirectionalLight(0x6fe8d0, 0.55)
    this.rim.position.set(-8, 3, -9)
    this.scene.add(this.rim)
    this.underLight = new THREE.PointLight(0x39e0c0, 8, 22, 2)
    this.underLight.position.set(0, -3.2, 0)
    this.scene.add(this.underLight)
  }

  buildVoid() {
    const geo = new THREE.PlaneGeometry(520, 520, 1, 1)
    this.voidUniforms = { uTime: { value: 0 }, uNight: { value: 0 } }
    this.voidMat = new THREE.ShaderMaterial({
      uniforms: this.voidUniforms,
      vertexShader: voidVert,
      fragmentShader: voidFrag,
    })
    this.voidPlane = new THREE.Mesh(geo, this.voidMat)
    this.voidPlane.rotation.x = -Math.PI / 2
    this.voidPlane.position.y = VOID_Y
    this.scene.add(this.voidPlane)

    // soft milky ring of mist at the edge of vision
    const ringTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256
      const ctx = c.getContext('2d')
      const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 128)
      g.addColorStop(0, 'rgba(60,190,180,0)')
      g.addColorStop(0.65, 'rgba(60,190,180,0.06)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256)
      return new THREE.CanvasTexture(c)
    })()
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0.9, blending: THREE.AdditiveBlending })
    )
    mist.rotation.x = -Math.PI / 2
    mist.position.y = VOID_Y + 0.01
    this.scene.add(mist)
  }

  buildSky() {
    const count = 1500
    const pos = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 120 + Math.random() * 90
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(rand(-0.05, 1))
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 6
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = new THREE.Color().setHSL(rand(0.45, 0.62), rand(0.2, 0.7), rand(0.55, 0.95))
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.15, vertexColors: true, transparent: true, opacity: 0.2, sizeAttenuation: true,
      map: this.glowTex, depthWrite: false, blending: THREE.AdditiveBlending,
    }))
    this.scene.add(this.stars)

    // faint nebula shell far away
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, transparent: true, opacity: 0.55,
        uniforms: { uNight: { value: 0 } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: `
          uniform float uNight; varying vec3 vP;
          float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*45758.5);}
          float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
          void main(){
            vec3 d=normalize(vP); vec2 p=d.xz*4.0 + d.y*1.7;
            float v=n(p*2.)*n(p*3.1)*n(p*5.3);
            vec3 col=mix(vec3(0.02,0.03,0.055),vec3(0.18,0.08,0.3),smoothstep(0.15,0.65,v));
            col+=vec3(0.02,0.1,0.12)*smoothstep(0.2,0.7,v);
            float horizon=smoothstep(-0.2,0.55,d.y);
            gl_FragColor=vec4(col, 0.15*horizon*(0.3+uNight*0.7));
          }`
      })
    )
    shell.material.uniforms.uNight.value = 0
    this.skyShell = shell
    this.scene.add(shell)
  }

  // -------------------------------------------------------------------------
  // island tiles
  // -------------------------------------------------------------------------
  resetIsland() {
    for (const tile of this.tiles.values()) this.scene.remove(tile.group)
    this.tiles.clear()
    for (const t of this.trees) this.scene.remove(t.group)
    this.trees = []
    for (const f of this.fires) this.scene.remove(f.group)
    this.fires = []
    for (const s of this.stills) this.scene.remove(s.group)
    this.stills = []
    for (const c of this.chests) this.scene.remove(c.group)
    this.chests = []
    this.clearGhosts()
    this.clearMonsters()
    this.line.visible = false
    this.bobber.visible = false
    this.castRing.visible = false
  }

  createTile(gx, gz, animate = true) {
    const key = tileKey(gx, gz)
    if (this.tiles.has(key)) return this.tiles.get(key)
    const { x, z } = worldPos(gx, gz)
    const group = new THREE.Group()
    group.position.set(x, animate ? -2.8 : 0, z)
    group.userData.targetY = 0

    const topMat = new THREE.MeshStandardMaterial({ map: this.grassTex, color: 0xffffff, roughness: 0.94, metalness: 0.02 })
    const sideMat = new THREE.MeshStandardMaterial({ map: this.dirtTex, roughness: 0.98, metalness: 0.02 })
    const boxGeo = new THREE.BoxGeometry(TILE * 0.985, 0.86, TILE * 0.985)
    const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]
    const box = new THREE.Mesh(boxGeo, mats)
    box.position.y = -0.44
    box.castShadow = true; box.receiveShadow = true
    group.add(box)

    // subtle grass overhang
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x5b8a68, roughness: 1 })
    const lip = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.995, 0.08, TILE * 0.995), lipMat)
    lip.position.y = 0.01; lip.castShadow = true; lip.receiveShadow = true
    group.add(lip)

    // faint plot seams make the 3x3 claim legible from first person
    const seamGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE * 0.985, 0.02, TILE * 0.985))
    const seam = new THREE.LineSegments(seamGeo, new THREE.LineBasicMaterial({ color: 0x244638, transparent: true, opacity: 0.8 }))
    seam.position.y = 0.055
    group.add(seam)

    // hanging under-rocks, deterministic per tile
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2c2a2a, roughness: 0.96, flatShading: true })
    for (let i = 0; i < 3; i++) {
      const s = rand(0.18, 0.45)
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat)
      rock.position.set(rand(-0.8, 0.8), -0.85 - rand(0.1, 0.7), rand(-0.8, 0.8))
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3))
      rock.castShadow = true
      group.add(rock)
    }

    // grass tufts + tiny flowers
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0x7fb98a, roughness: 1, side: THREE.DoubleSide })
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0x9fffd8, emissive: 0x39d6a0, emissiveIntensity: 1.3, roughness: 0.6 })
    for (let i = 0; i < 5; i++) {
      const px = rand(-0.95, 0.95), pz = rand(-0.95, 0.95)
      if (Math.hypot(px, pz) < 0.42) continue
      const tuft = new THREE.Group()
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, rand(0.18, 0.42), 3), tuftMat)
        blade.position.set(rand(-0.06, 0.06), 0.12, rand(-0.06, 0.06))
        blade.rotation.z = rand(-0.4, 0.4); blade.rotation.x = rand(-0.4, 0.4)
        tuft.add(blade)
      }
      tuft.position.set(px, 0.02, pz)
      group.add(tuft)
    }
    for (let i = 0; i < 2; i++) {
      if (hash2(gx, gz, i) > 0.55) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), flowerMat)
        flower.position.set(rand(-0.9, 0.9), 0.19, rand(-0.9, 0.9))
        group.add(flower)
      }
    }

    // emissive rim prepared for edges
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false })
    group.userData.rimMat = rimMat
    group.userData.fringes = []

    this.scene.add(group)
    const tile = { gx, gz, group, box, animate, t: 0 }
    this.tiles.set(key, tile)
    this.refreshEdges()
    return tile
  }

  refreshEdges() {
    for (const tile of this.tiles.values()) {
      for (const f of tile.group.userData.fringes) tile.group.remove(f)
      tile.group.userData.fringes.length = 0
      const { gx, gz } = tile
      const dirs = [[1, 0, TILE / 2, 0, 0.06, TILE], [-1, 0, -TILE / 2, 0, 0.06, TILE], [0, 1, 0, TILE / 2, TILE, 0.06], [0, -1, 0, -TILE / 2, TILE, 0.06]]
      for (const [dx, dz, ox, oz, sx, sz] of dirs) {
        if (this.tiles.has(tileKey(gx + dx, gz + dz))) continue
        const f = new THREE.Mesh(new THREE.BoxGeometry(sx || 0.06, 0.035, sz || 0.06), tile.group.userData.rimMat)
        f.position.set(ox, 0.075, oz)
        tile.group.add(f)
        tile.group.userData.fringes.push(f)
      }
    }
  }

  setGhostTiles(spots) {
    for (const g of this.ghosts) { this.scene.remove(g); g.geometry.dispose(); g.material.dispose() }
    this.ghosts = []
    const mat = new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
    for (const s of spots) {
      const { x, z } = worldPos(s.gx, s.gz)
      const geo = new THREE.BoxGeometry(TILE * 0.92, 0.06, TILE * 0.92)
      const m = new THREE.Mesh(geo, mat.clone())
      m.position.set(x, 0.1, z)
      m.userData.spot = s
      this.scene.add(m)
      this.ghosts.push(m)
    }
  }

  clearGhosts() {
    for (const g of this.ghosts) { this.scene.remove(g); g.geometry.dispose(); g.material.dispose() }
    this.ghosts = []
  }

  highlightGhost(index) {
    this.ghosts.forEach((g, i) => {
      g.material.opacity = i === index ? 0.46 : 0.13
      g.scale.setScalar(i === index ? 1.03 : 1)
    })
  }

  // -------------------------------------------------------------------------
  // props
  // -------------------------------------------------------------------------
  placeTree(gx, gz, plantedAt, growth = 0) {
    const { x, z } = worldPos(gx, gz)
    const jitter = hash2(gx, gz, 8)
    const px = x + (jitter - 0.5) * 0.5
    const pz = z + (hash2(gz, gx, 3) - 0.5) * 0.5
    const group = new THREE.Group()
    group.position.set(px, 0, pz)

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xc9b98f, roughness: 0.88, emissive: 0x2a2314, emissiveIntensity: 0.3 })
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 2.4, 6), trunkMat)
    trunk.position.y = 1.2; trunk.castShadow = true
    group.add(trunk)

    const branchMat = new THREE.MeshStandardMaterial({ color: 0xb9aa80, roughness: 0.9 })
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.9, 5), branchMat)
      b.position.set(0, 1.35 + i * 0.36, 0)
      b.rotation.z = 0.7 + i * 0.25
      b.rotation.y = i * 2.1
      b.translateY(0.38)
      group.add(b)
    }

    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x4f9c78, roughness: 0.92, flatShading: true })
    const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x6ec695, roughness: 0.92, flatShading: true, emissive: 0x0d3728, emissiveIntensity: 0.35 })
    const canopy = new THREE.Group()
    const clusters = [
      [0, 2.6, 0, 0.85], [0.55, 2.35, 0.2, 0.58], [-0.5, 2.42, -0.25, 0.62],
      [0.1, 2.95, -0.35, 0.5], [-0.2, 2.78, 0.45, 0.46],
    ]
    for (let i = 0; i < clusters.length; i++) {
      const [cx, cy, cz, s] = clusters[i]
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), i % 2 ? canopyMat2 : canopyMat)
      c.position.set(cx, cy, cz); c.castShadow = true
      canopy.add(c)
    }
    const glowSpots = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 2.5, 0, 0.5, 2.9, 0.2, -0.6, 2.5, 0.1, 0.2, 2.2, -0.5]), 3)),
      new THREE.PointsMaterial({ size: 0.22, color: 0xa8ffe4, map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    canopy.add(glowSpots)
    group.add(canopy)

    group.scale.setScalar(0.06 + growth * 0.94)
    group.userData = { canopy, trunk, plantedAt, growth }
    this.scene.add(group)
    const tree = { gx, gz, group, x: px, z: pz, plantedAt, growth, hp: 3, shake: 0, mature: growth >= 1 }
    this.trees.push(tree)
    return tree
  }

  updateTrees(now, dt) {
    for (const t of this.trees) {
      t.growth = clamp((now - t.plantedAt) / 45, 0, 1)
      const s = 0.1 + Math.pow(t.growth, 0.7) * 0.9
      t.group.scale.setScalar(s)
      t.mature = t.growth >= 0.98
      t.group.userData.canopy.rotation.y += dt * 0.08
      if (t.shake > 0) {
        t.shake = Math.max(0, t.shake - dt * 2.5)
        t.group.rotation.z = Math.sin(now * 34) * t.shake * 0.07
        t.group.position.x = t.x + Math.sin(now * 30) * t.shake * 0.05
      } else {
        t.group.rotation.z = 0
        t.group.position.x = t.x
      }
    }
  }

  removeTree(tree) {
    this.burst({ x: tree.x, y: 1.5, z: tree.z }, 0x9dffcf, 26, 3.4)
    this.scene.remove(tree.group)
    this.trees = this.trees.filter(t => t !== tree)
  }

  placeCampfire(gx, gz) {
    const { x, z } = worldPos(gx, gz)
    const group = new THREE.Group()
    group.position.set(x, 0.04, z)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5b5a58, roughness: 0.95, flatShading: true })
    for (let i = 0; i < 8; i++) {
      const s = rand(0.12, 0.19)
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat)
      const a = (i / 8) * Math.PI * 2
      st.position.set(Math.cos(a) * 0.52, 0.05, Math.sin(a) * 0.52)
      st.castShadow = true; group.add(st)
    }
    const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3424, roughness: 0.95 })
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.8, 6), logMat)
      log.rotation.z = Math.PI / 2
      log.rotation.y = i * 0.8
      log.position.y = 0.12
      group.add(log)
    }
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6a1f, transparent: true, opacity: 0.85, depthWrite: false })
    const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffb15e, transparent: true, opacity: 0.9, depthWrite: false })
    const flame = new THREE.Group()
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(rand(0.12, 0.2), rand(0.24, 0.44), 5), i % 2 ? flameMat2 : flameMat)
      f.position.set(rand(-0.12, 0.12), 0.3 + rand(0, 0.14), rand(-0.12, 0.12))
      f.rotation.z = rand(-0.18, 0.18)
      flame.add(f)
    }
    const light = new THREE.PointLight(0xff9a4d, 5, 8, 2)
    light.position.y = 0.9
    light.castShadow = false
    group.add(light)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff9a4d, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false }))
    sprite.scale.set(1.5, 1.5, 1); sprite.position.y = 0.55
    group.add(sprite)
    group.add(flame)
    this.scene.add(group)
    const fire = { gx, gz, group, flame, light, sprite, x, z }
    this.fires.push(fire)
    return fire
  }

  placeStill(gx, gz) {
    const { x, z } = worldPos(gx, gz)
    const group = new THREE.Group()
    group.position.set(x, 0.04, z)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6f5a40, roughness: 0.9 })
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x6b7d7c, roughness: 0.4, metalness: 0.7 })
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.85, 10), woodMat)
    barrel.position.y = 0.43; barrel.castShadow = true; group.add(barrel)
    for (const y of [0.22, 0.64]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 4, 14), metalMat)
      band.rotation.x = Math.PI / 2; band.position.y = y; group.add(band)
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8fe8dc, emissive: 0x1c8f84, emissiveIntensity: 0.8, transparent: true, opacity: 0.75, roughness: 0.2 }))
    dome.position.y = 0.85; group.add(dome)
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshStandardMaterial({ color: 0x74f0e8, emissive: 0x3be2d6, emissiveIntensity: 2 }))
    drop.position.set(0, 1.22 + Math.sin(Date.now() * 0.003) * 0.05, 0); group.add(drop)
    const light = new THREE.PointLight(0x42e6d4, 2.2, 3.6, 2)
    light.position.y = 1; group.add(light)
    group.userData.drop = drop
    this.scene.add(group)
    const still = { gx, gz, group, x, z, drop, light }
    this.stills.push(still)
    return still
  }

  updateProps(now, dt) {
    for (const f of this.fires) {
      const fl = f.flame
      fl.children.forEach((c, i) => {
        c.scale.y = 0.85 + Math.sin(now * 9 + i * 2.1) * 0.18 + Math.sin(now * 17 + i) * 0.07
        c.position.x = Math.sin(now * 4 + i) * 0.045
      })
      f.light.intensity = 8 + Math.sin(now * 13) * 1.5 + Math.sin(now * 29) * 0.7
      f.sprite.material.opacity = 0.45 + Math.sin(now * 8) * 0.08
      if (Math.random() < dt * 8) {
        this.burst({ x: f.x + rand(-0.25, 0.25), y: 0.55, z: f.z + rand(-0.25, 0.25) }, 0xff9a4d, 1, 0.9, 0.8)
      }
    }
    for (const s of this.stills) {
      s.drop.position.y = 1.2 + Math.sin(now * 2.4) * 0.06
      s.light.intensity = 2 + Math.sin(now * 2) * 0.4
    }
  }

  // -------------------------------------------------------------------------
  // particles / effects
  // -------------------------------------------------------------------------
  buildParticles() {
    // ambient dust over the island
    const n = 220
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-12, 12); pos[i * 3 + 1] = rand(-1, 7); pos[i * 3 + 2] = rand(-12, 12)
    }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, color: 0xa8ffe4, map: this.glowTex, transparent: true, opacity: 0.48, depthWrite: false, blending: THREE.AdditiveBlending }))
    this.scene.add(this.dust)
  }

  burst(pos, color = 0x9dffcf, count = 12, speed = 2.2, life = 1) {
    const positions = new Float32Array(count * 3)
    const vel = []
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI
      const sp = rand(speed * 0.25, speed)
      vel.push(new THREE.Vector3(Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp + 0.6, Math.sin(b) * Math.sin(a) * sp))
    }
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ size: rand(0.1, 0.24), color, map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 })
    const points = new THREE.Points(geo, mat)
    this.scene.add(points)
    this.effects.push({ points, vel, life, maxLife: life })
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      e.life -= dt
      const arr = e.points.geometry.attributes.position.array
      for (let i = 0; i < e.vel.length; i++) {
        const v = e.vel[i]
        arr[i * 3] += v.x * dt; arr[i * 3 + 1] += v.y * dt; arr[i * 3 + 2] += v.z * dt
        v.y -= 3.6 * dt
        v.multiplyScalar(0.985)
      }
      e.points.geometry.attributes.position.needsUpdate = true
      e.points.material.opacity = clamp(e.life / e.maxLife, 0, 1)
    }
    this.effects = this.effects.filter(e => {
      if (e.life <= 0) { this.scene.remove(e.points); e.points.geometry.dispose(); e.points.material.dispose(); return false }
      return true
    })
  }

  updateDust(now) {
    const arr = this.dust.geometry.attributes.position.array
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3 + 1] += 0.0016
      arr[i * 3] += Math.sin(now * 0.3 + i) * 0.0005
      if (arr[i * 3 + 1] > 8) arr[i * 3 + 1] = -1
    }
    this.dust.geometry.attributes.position.needsUpdate = true
  }

  // -------------------------------------------------------------------------
  // first-person held models + fishing
  // -------------------------------------------------------------------------
  buildHeldModels() {
    this.hand = new THREE.Group()
    this.hand.position.set(0.4, -0.4, -0.66)
    this.hand.rotation.set(-0.03, -0.06, -0.04)
    this.handBaseY = -0.4
    this.camera.add(this.hand)
    this.scene.add(this.camera)

    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x3f5f58, roughness: 0.8 })
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x1b302d, roughness: 0.9 })
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.72 })
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.27, 4, 8), cuffMat)
    sleeve.position.set(0.05, -0.16, 0.2); sleeve.rotation.x = 1.18; sleeve.rotation.z = -0.2
    this.hand.add(sleeve)
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.08, 4, 8), gloveMat)
    palm.position.set(0, -0.005, 0.01); palm.rotation.x = 1.2; palm.rotation.z = 0.18
    this.hand.add(palm)
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.045, 3, 6), skinMat)
    thumb.position.set(-0.043, 0.03, 0.02); thumb.rotation.z = 0.7; thumb.rotation.x = 0.55
    this.hand.add(thumb)
    const knuckle = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 3, 6), gloveMat)
    knuckle.position.set(0.035, 0.02, 0.0); knuckle.rotation.z = -0.12; knuckle.rotation.x = 1.15
    this.hand.add(knuckle)

    this.rodModel = this.makeRodModel()
    this.axeModel = this.makeAxeModel()
    this.spearModel = this.makeSpearModel()
    this.bladeModel = this.makeBladeModel()
    for (const m of [this.rodModel, this.axeModel, this.spearModel, this.bladeModel]) {
      m.visible = false
      this.hand.add(m)
    }
    this.rodModel.visible = true

    this.rodTip.position.set(0.17, 0.62, -1.22)
    this.rodModel.add(this.rodTip)
  }

  makeRodModel() {
    const g = new THREE.Group()
    // The rod runs forward and slightly up out of the fist instead of
    // lying across the view. Cylinders are aligned to this direction.
    const dir = new THREE.Vector3(0.125, 0.46, -0.9).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3d5c57, roughness: 0.42, metalness: 0.35, emissive: 0x0b211e, emissiveIntensity: 0.6 })
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x8a6544, roughness: 0.82 })
    const reelMat = new THREE.MeshStandardMaterial({ color: 0x9db8b3, roughness: 0.28, metalness: 0.85, emissive: 0x123a33, emissiveIntensity: 0.5 })

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.25, 8), gripMat)
    grip.quaternion.copy(q)
    grip.position.copy(dir).multiplyScalar(0.1)
    g.add(grip)

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.012, 1.06, 7), rodMat)
    rod.quaternion.copy(q)
    rod.position.copy(dir).multiplyScalar(0.74)
    g.add(rod)

    // luminous wraps near the tip
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 4, 8), new THREE.MeshBasicMaterial({ color: 0x74f0c8 }))
    band.position.copy(dir).multiplyScalar(1.16)
    band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    g.add(band)
    const band2 = band.clone()
    band2.position.copy(dir).multiplyScalar(0.62)
    band2.scale.setScalar(0.85)
    g.add(band2)

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), new THREE.MeshBasicMaterial({ color: 0x9bfff0 }))
    tip.position.copy(dir).multiplyScalar(1.33)
    g.add(tip)

    // compact reel body hanging under the grip
    const reel = new THREE.Group()
    reel.position.copy(dir).multiplyScalar(0.27).add(new THREE.Vector3(0, -0.055, 0))
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.048), new THREE.MeshStandardMaterial({ color: 0x233b38, roughness: 0.48, metalness: 0.55 }))
    reel.add(body)
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.022, 12), reelMat)
    spool.rotation.z = Math.PI / 2
    spool.position.set(0.036, -0.004, 0)
    reel.add(spool)
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.055, 5), reelMat)
    crank.position.set(0.052, -0.038, 0.018); crank.rotation.z = 0.5
    reel.add(crank)
    const crankKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), reelMat)
    crankKnob.position.set(0.075, -0.062, 0.03)
    reel.add(crankKnob)
    g.add(reel)

    return g
  }

  makeAxeModel() {
    const g = new THREE.Group()
    const dir = new THREE.Vector3(0.2, 0.55, -0.82).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6746, roughness: 0.9 })
    const metal = new THREE.MeshStandardMaterial({ color: 0x93a9a5, roughness: 0.35, metalness: 0.85 })

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.74, 7), wood)
    handle.quaternion.copy(q)
    handle.position.copy(dir).multiplyScalar(0.38)
    g.add(handle)

    const head = new THREE.Group()
    head.position.copy(dir).multiplyScalar(0.72)
    head.quaternion.copy(q)
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.048), metal)
    cheek.position.set(0.03, 0, 0)
    head.add(cheek)
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.15, 4), metal)
    blade.position.set(0.115, 0, 0)
    blade.rotation.z = -Math.PI / 2
    blade.scale.z = 0.55
    head.add(blade)
    const poll = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, 0.04), metal)
    poll.position.set(-0.018, 0, 0)
    head.add(poll)
    g.add(head)

    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 4, 8), new THREE.MeshStandardMaterial({ color: 0x9fe8cc, emissive: 0x2f8e76, emissiveIntensity: 1.2 }))
    lash.position.copy(dir).multiplyScalar(0.66)
    lash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    g.add(lash)
    return g
  }

  makeSpearModel() {
    const g = new THREE.Group()
    const dir = new THREE.Vector3(0.14, 0.46, -0.88).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const wood = new THREE.MeshStandardMaterial({ color: 0x6e5539, roughness: 0.9 })
    const metal = new THREE.MeshStandardMaterial({ color: 0xb7c5bd, roughness: 0.3, metalness: 0.9 })
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.021, 1.0, 7), wood)
    shaft.quaternion.copy(q)
    shaft.position.copy(dir).multiplyScalar(0.52)
    g.add(shaft)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 5), metal)
    tip.quaternion.copy(q)
    tip.position.copy(dir).multiplyScalar(1.06)
    g.add(tip)
    const bind = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8dd7bb, emissive: 0x2f8e76, emissiveIntensity: 1 }))
    bind.position.copy(dir).multiplyScalar(0.94)
    bind.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    g.add(bind)
    return g
  }

  makeBladeModel() {
    const g = new THREE.Group()
    const dir = new THREE.Vector3(0.16, 0.5, -0.86).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x35403e, roughness: 0.8 })
    const glow = new THREE.MeshStandardMaterial({ color: 0xa88bff, emissive: 0x5c3fdf, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.8 })
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.22, 7), gripMat)
    handle.quaternion.copy(q)
    handle.position.copy(dir).multiplyScalar(0.1)
    g.add(handle)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.66, 0.018), glow)
    blade.quaternion.copy(q)
    blade.position.copy(dir).multiplyScalar(0.57)
    g.add(blade)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.031, 0.12, 4), glow)
    tip.quaternion.copy(q)
    tip.position.copy(dir).multiplyScalar(0.92)
    g.add(tip)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.028, 0.03), gripMat)
    guard.quaternion.copy(q)
    guard.position.copy(dir).multiplyScalar(0.21)
    g.add(guard)
    return g
  }

  equip(kind) {
    this.heldKind = kind
    this.rodModel.visible = kind === 'rod'
    this.axeModel.visible = kind === 'axe'
    this.spearModel.visible = kind === 'spear'
    this.bladeModel.visible = kind === 'blade'
  }

  buildFishingRig() {
    const start = new THREE.Vector3()
    this.linePoints = 30
    const arr = new Float32Array(this.linePoints * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9dffef, transparent: true, opacity: 0.75 }))
    this.line.visible = false
    this.scene.add(this.line)

    this.bobber = new THREE.Group()
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8dfff0, emissive: 0x39e0c0, emissiveIntensity: 2.2, roughness: 0.3 }))
    this.bobber.add(orb)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 4, 16), new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }))
    ring.rotation.x = Math.PI / 2
    this.bobber.add(ring)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x74f0c8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(0.9, 0.9, 1)
    this.bobber.add(glow)
    this.bobber.visible = false
    this.bobber.userData.ring = ring
    this.scene.add(this.bobber)

    // cast target reticle
    this.castRing = new THREE.Group()
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }))
    outer.rotation.x = -Math.PI / 2
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 24), new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }))
    inner.rotation.x = -Math.PI / 2
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.2, 5), new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }))
    beam.position.y = 1.1
    this.castRing.add(outer, inner, beam)
    this.castRing.visible = false
    this.scene.add(this.castRing)
    this.castOuter = outer
    this.castInner = inner
    this.castBeam = beam
  }

  getRodTip() {
    const p = new THREE.Vector3()
    this.rodTip.getWorldPosition(p)
    return p
  }

  showCastRing(pos, valid, y = VOID_Y + 0.03) {
    this.castRing.visible = true
    this.castRing.position.set(pos.x, y, pos.z)
    const col = valid ? 0x74f0c8 : 0xff6b7d
    this.castOuter.material.color.setHex(col)
    this.castInner.material.color.setHex(col)
    this.castBeam.material.color.setHex(col)
    this.castRing.rotation.y = this.time * 0.4
  }

  hideCastRing() { this.castRing.visible = false }

  setLine(from, to, sag = 1) {
    const arr = this.line.geometry.attributes.position.array
    for (let i = 0; i < this.linePoints; i++) {
      const t = i / (this.linePoints - 1)
      const x = lerp(from.x, to.x, t)
      const y = lerp(from.y, to.y, t) - Math.sin(t * Math.PI) * sag
      const z = lerp(from.z, to.z, t)
      arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z
    }
    this.line.geometry.attributes.position.needsUpdate = true
    this.line.geometry.computeBoundingSphere()
    this.line.visible = true
  }

  clearLine() {
    this.line.visible = false
    this.bobber.visible = false
  }

  placeBobber(x, z, y = VOID_Y + 0.12) {
    this.bobber.position.set(x, y, z)
    this.bobber.visible = true
  }

  splash(pos) {
    this.burst({ x: pos.x, y: VOID_Y + 0.2, z: pos.z }, 0x74f0c8, 20, 2.6, 0.9)
    this.addRipple(pos)
  }

  addRipple(pos) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.24, 32),
      new THREE.MeshBasicMaterial({ color: 0x74f0c8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.set(pos.x, VOID_Y + 0.02, pos.z)
    this.scene.add(ring)
    this.ripples.push({ ring, life: 1.1, max: 1.1 })
  }

  updateRipples(dt) {
    for (const r of this.ripples) {
      r.life -= dt
      const t = 1 - r.life / r.max
      r.ring.scale.setScalar(1 + t * 4.5)
      r.ring.material.opacity = (1 - t) * 0.5
    }
    this.ripples = this.ripples.filter(r => {
      if (r.life <= 0) { this.scene.remove(r.ring); r.ring.geometry.dispose(); r.ring.material.dispose(); return false }
      return true
    })
  }

  // -------------------------------------------------------------------------
  // chests
  // -------------------------------------------------------------------------
  makeChestModel(rarity = 'common') {
    const color = RARITY[rarity]?.color || '#a8b6ba'
    const group = new THREE.Group()
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3f2c, roughness: 0.8 })
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a3133, roughness: 0.35, metalness: 0.8 })
    const glowMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), emissive: new THREE.Color(color), emissiveIntensity: 1.6, roughness: 0.4 })
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.52, 0.62), woodMat)
    base.position.y = 0.26; base.castShadow = true; group.add(base)
    for (const x of [-0.34, 0.34]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.56, 0.66), trimMat)
      band.position.set(x, 0.27, 0); group.add(band)
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), glowMat)
    lock.position.set(0, 0.3, 0.33); group.add(lock)
    const lid = new THREE.Group()
    lid.position.set(0, 0.52, -0.31)
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.2, 0.64), woodMat)
    lidMesh.position.set(0, 0.08, 0.31); lidMesh.castShadow = true; lid.add(lidMesh)
    const lidTrim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.66), glowMat)
    lidTrim.position.set(0, 0.2, 0.31); lid.add(lidTrim)
    group.add(lid)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(2.1, 2.1, 1); glow.position.y = 0.4; group.add(glow)
    group.userData = { lid, glow, trim: lidTrim }
    return group
  }

  createChest(pos, rarity = 'common', startY = VOID_Y - 0.6) {
    const group = this.makeChestModel(rarity)
    group.position.set(pos.x, startY, pos.z)
    group.rotation.y = rand(0, Math.PI * 2)
    this.scene.add(group)
    const chest = { group, rarity, state: 'rising', t: 0, targetY: pos.y ?? 0.06, x: pos.x, z: pos.z, opened: false }
    this.chests.push(chest)
    this.addRipple(pos)
    return chest
  }

  openChest(chest) {
    if (chest.opened) return
    chest.opened = true
    chest.state = 'opening'
    chest.t = 0
    const color = RARITY[chest.rarity]?.color || '#ffffff'
    this.burst({ x: chest.x, y: chest.targetY + 0.5, z: chest.z }, new THREE.Color(color).getHex(), 34, 4.2, 1.4)
  }

  updateChests(dt) {
    for (const c of this.chests) {
      c.t += dt
      if (c.state === 'rising') {
        const t = clamp(c.t / 1.3, 0, 1)
        const e = 1 - Math.pow(1 - t, 3)
        c.group.position.y = lerp(VOID_Y - 0.6, c.targetY, e) + Math.sin(t * Math.PI) * 0.5
        c.group.rotation.y += dt * 2.2
        if (t >= 1) { c.state = 'idle'; c.t = 0; c.group.rotation.y = 0 }
      } else if (c.state === 'idle') {
        c.group.position.y = c.targetY + Math.sin(c.t * 2.2) * 0.06
        c.group.userData.glow.material.opacity = 0.45 + Math.sin(c.t * 4) * 0.12
      } else if (c.state === 'opening') {
        c.group.userData.lid.rotation.x = -Math.min(c.t * 5, 2.1)
        c.group.userData.glow.material.opacity = clamp(1.2 - c.t, 0, 1)
        if (c.t > 2.2) {
          this.scene.remove(c.group)
          c.dead = true
        }
      }
    }
    this.chests = this.chests.filter(c => !c.dead)
  }

  // -------------------------------------------------------------------------
  // monsters
  // -------------------------------------------------------------------------
  makeMonsterModel(type) {
    const def = MONSTERS[type]
    const g = new THREE.Group()
    const scale = type === 'herald' ? 1.5 : type === 'crawler' ? 1.15 : 1
    const darkMat = new THREE.MeshStandardMaterial({
      color: type === 'herald' ? 0x281d33 : 0x10151c,
      roughness: 0.9, flatShading: true,
      emissive: type === 'herald' ? 0x120a18 : 0x000000,
      emissiveIntensity: 0.8,
    })
    const eyeMat = new THREE.MeshBasicMaterial({ color: def.color })
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: def.color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(1.6 * scale, 1.6 * scale, 1)

    if (type === 'wisp') {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 7), darkMat)
      body.position.y = 0.85; body.rotation.x = Math.PI; g.add(body)
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), darkMat)
      hood.position.y = 1.45; g.add(hood)
      for (const x of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat)
        eye.position.set(x, 1.48, 0.28); g.add(eye)
      }
      for (let i = 0; i < 4; i++) {
        const tendril = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.8, 4), darkMat)
        tendril.position.set(Math.cos(i * 1.7) * 0.22, 0.25, Math.sin(i * 1.7) * 0.22)
        tendril.rotation.z = rand(-0.25, 0.25); tendril.rotation.x = rand(-0.25, 0.25)
        g.add(tendril)
      }
    } else if (type === 'crawler') {
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), darkMat)
      body.scale.set(1.25, 0.65, 1.6); body.position.y = 0.55; g.add(body)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 5), darkMat)
      head.rotation.x = Math.PI / 2; head.position.set(0, 0.62, 0.62); g.add(head)
      for (const x of [-0.12, 0.12]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), eyeMat)
        eye.position.set(x, 0.67, 0.9); g.add(eye)
      }
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7, 4), darkMat)
        leg.position.set(i % 2 ? 0.42 : -0.42, 0.3, i < 2 ? 0.3 : -0.35)
        leg.rotation.z = i % 2 ? -0.5 : 0.5; g.add(leg)
      }
      for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 4), darkMat)
        spike.position.set(rand(-0.35, 0.35), 0.9, rand(-0.5, 0.3)); g.add(spike)
      }
    } else {
      // herald
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.2, 9), darkMat)
      body.position.y = 1.1; body.rotation.x = Math.PI; g.add(body)

      const mantleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a4a, roughness: 0.75, flatShading: true, emissive: 0x1a1022, emissiveIntensity: 0.6 })
      const shoulders = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 0), mantleMat)
      shoulders.scale.set(1.65, 0.48, 1.0); shoulders.position.y = 2.05; g.add(shoulders)
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.028, 4, 18), new THREE.MeshBasicMaterial({ color: 0xffc86b }))
      collar.rotation.x = Math.PI / 2; collar.position.y = 2.16; collar.scale.z = 1.18; g.add(collar)

      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.5, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), darkMat)
      hood.position.y = 2.45; g.add(hood)
      for (const x of [-0.2, 0.2]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), eyeMat)
        eye.position.set(x, 2.5, 0.37); g.add(eye)
      }
      const thirdEye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), new THREE.MeshBasicMaterial({ color: 0xffe6b0 }))
      thirdEye.position.set(0, 2.62, 0.40); g.add(thirdEye)

      for (let i = 0; i < 3; i++) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, i === 1 ? 0.9 : 0.65, 4), mantleMat)
        horn.position.set((i - 1) * 0.3, 2.9 + (i === 1 ? 0.1 : 0), 0)
        horn.rotation.z = (i - 1) * -0.38
        g.add(horn)
      }
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.2, 4), darkMat)
        t.position.set(Math.cos(i * 1.05) * 0.4, 0.35, Math.sin(i * 1.05) * 0.4)
        t.rotation.z = rand(-0.2, 0.2); g.add(t)
      }

      const coreMat = new THREE.MeshBasicMaterial({ color: 0xff8a2e })
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), coreMat)
      core.position.set(0, 1.62, 0.44); g.add(core)
      const coreHot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe4a8 }))
      coreHot.position.copy(core.position); coreHot.position.z += 0.16; g.add(coreHot)
      const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff8a2e, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }))
      coreHalo.scale.set(1.25, 1.25, 1); coreHalo.position.copy(core.position); g.add(coreHalo)
      const coreLight = new THREE.PointLight(0xffb15e, 4, 6, 2)
      coreLight.position.set(0, 1.8, 0.6); g.add(coreLight)
      g.userData.core = core
    }
    glow.position.y = type === 'herald' ? 1.6 : 1
    g.add(glow)
    g.scale.setScalar(scale)
    g.userData.glow = glow

    // health bar
    const bar = new THREE.Group()
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.09), new THREE.MeshBasicMaterial({ color: 0x090d0e, transparent: true, opacity: 0.8, depthWrite: false }))
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.055), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.95, depthWrite: false }))
    fill.position.z = 0.005
    bar.add(bg, fill)
    bar.position.y = type === 'herald' ? 3.25 : 1.9
    bar.visible = false
    g.add(bar)
    g.userData.bar = bar
    g.userData.barFill = fill
    g.userData.scale = scale
    return g
  }

  spawnMonster(type, x, z) {
    const def = MONSTERS[type]
    const group = this.makeMonsterModel(type)
    group.position.set(x, 0.15, z)
    this.scene.add(group)
    const m = {
      type, def, group, hp: def.hp, maxHp: def.hp, x, z,
      speed: def.speed, damage: def.damage, radius: def.radius, attackCd: 1.2,
      flash: 0, dead: false, phase: Math.random() * 6, id: Math.random().toString(36).slice(2),
      boss: !!def.boss,
    }
    this.monsters.push(m)
    return m
  }

  updateMonsters(dt, now, player, onAttack, camera) {
    for (const m of this.monsters) {
      const dx = player.x - m.x, dz = player.z - m.z
      const dist = Math.hypot(dx, dz)
      const attackRange = m.radius + 0.7
      m.attackCd -= dt
      if (!m.dead) {
        if (dist > attackRange) {
          const nx = dx / (dist || 1), nz = dz / (dist || 1)
          m.x += nx * m.speed * dt
          m.z += nz * m.speed * dt
        } else if (m.attackCd <= 0) {
          m.attackCd = m.boss ? 1.7 : 1.25
          onAttack && onAttack(m)
        }
      }
      m.phase += dt
      const bob = Math.sin(m.phase * (m.boss ? 1.4 : 2.4)) * 0.1
      m.group.position.set(m.x, 0.15 + bob + (m.boss ? 0.25 : 0), m.z)
      m.group.rotation.y = Math.atan2(dx, dz)
      if (m.group.userData.glow) m.group.userData.glow.material.opacity = 0.35 + Math.sin(m.phase * 3) * 0.12
      if (m.group.userData.core) m.group.userData.core.scale.setScalar(1 + Math.sin(m.phase * 4) * 0.15)
      if (m.flash > 0) m.flash = Math.max(0, m.flash - dt)
      const baseScale = m.group.userData.scale || 1
      const flashBump = m.flash * 4
      m.group.scale.setScalar(baseScale * (1 + flashBump * 0.05))
      const bar = m.group.userData.bar
      if (bar) {
        bar.visible = !m.boss && m.hp < m.maxHp
        bar.quaternion.copy(m.group.quaternion).invert().multiply(camera.quaternion)
        const f = m.group.userData.barFill
        f.scale.x = Math.max(0.001, m.hp / m.maxHp)
        f.position.x = -(1 - f.scale.x) * 0.53
      }
    }
  }

  damageMonster(m, dmg) {
    if (m.dead) return false
    m.hp -= dmg
    m.flash = 0.16
    const hp = m.group.position.clone(); hp.y += 1.1
    this.burst(hp, 0xff9aaa, 10, 2.4, 0.6)
    if (m.hp <= 0) {
      m.dead = true
      const p = m.group.position.clone(); p.y += 0.8
      this.burst(p, m.def.color, m.boss ? 70 : 26, m.boss ? 6 : 3.6, 1.6)
      return true
    }
    return false
  }

  removeMonster(m) {
    this.scene.remove(m.group)
    this.monsters = this.monsters.filter(x => x !== m)
  }

  clearMonsters() {
    for (const m of this.monsters) this.scene.remove(m.group)
    this.monsters = []
  }

  // -------------------------------------------------------------------------
  // lighting / resize / render
  // -------------------------------------------------------------------------
  setDayNight(dayProgress, day, trial) {
    const p = dayProgress
    // 0 = dawn, .25 = noon, .5 = dusk, .75 = midnight
    const daylight = clamp(Math.cos(p * Math.PI * 2) * 0.5 + 0.5, 0, 1)
    const night = 1 - clamp(daylight * 1.5 - 0.1, 0, 1)
    this.night = night
    const sunAngle = p * Math.PI * 2
    this.sun.position.set(Math.cos(sunAngle) * 16, Math.max(2, Math.sin(sunAngle + 0.5) * 16), Math.sin(sunAngle) * 12)
    this.sun.intensity = 0.3 + daylight * 2.0
    this.sun.color.setHSL(0.11, 0.55, 0.55 + daylight * 0.25)
    this.hemi.intensity = 0.13 + daylight * 0.6
    this.hemi.color.setHSL(0.55, 0.4, 0.25 + daylight * 0.45)
    this.rim.intensity = 0.3 + night * 0.4
    this.underLight.intensity = 5 + night * 5
    this.scene.fog.color.setRGB(0.0035 + daylight * 0.006, 0.006 + daylight * 0.011, 0.009 + daylight * 0.014)
    this.scene.fog.density = 0.013 + night * 0.01
    this.scene.background.setRGB(0.003 + daylight * 0.007, 0.005 + daylight * 0.012, 0.009 + daylight * 0.016)
    this.stars.material.opacity = 0.09 + night * 0.82
    this.skyShell.material.uniforms.uNight.value = night
    this.voidUniforms.uNight.value = night
    this.dust.material.opacity = 0.25 + night * 0.35
    if (this.fires.length) for (const f of this.fires) f.light.intensity = (2.4 + night * 5.2) + Math.sin(this.time * 13) * 0.7
  }

  update(dt, now) {
    this.time = now
    this.voidUniforms.uTime.value = now
    this.voidPlane.position.y = VOID_Y + Math.sin(now * 0.4) * 0.03
    this.stars.rotation.y = now * 0.002
    this.skyShell.rotation.y = now * 0.001
    this.dust.rotation.y = now * 0.001
    this.updateDust(now)
    this.updateEffects(dt)
    this.updateRipples(dt)
    this.updateTrees(now, dt)
    this.updateProps(now, dt)
    this.updateChests(dt)
    for (const c of this.chests) {
      if (c.state === 'idle' && Math.random() < dt * 1.6) {
        this.burst({ x: c.x + rand(-0.4, 0.4), y: c.targetY + rand(0.2, 0.9), z: c.z + rand(-0.4, 0.4) }, new THREE.Color(RARITY[c.rarity]?.color || '#fff').getHex(), 1, 0.6, 0.8)
      }
    }
    if (this.bobber.visible) {
      this.bobber.rotation.y = now * 0.7
      const ring = this.bobber.userData.ring
      if (ring) ring.rotation.z = now
    }
    if (this.castRing.visible) {
      this.castInner.rotation.y = -now
      this.castOuter.rotation.y = now * 0.6
    }
    // held item sway
    if (this.hand) {
      const t = now
      this.hand.position.y = this.handBaseY + Math.sin(t * 1.5) * 0.006
      this.hand.rotation.z = Math.sin(t * 1.1) * 0.012
    }
  }

  cinematic(now) {
    const a = now * 0.115 + 0.7
    this.camera.position.set(Math.cos(a) * 11.8, 5.9 + Math.sin(now * 0.2) * 0.35, Math.sin(a) * 11.8)
    this.camera.lookAt(-2.2, 0.45, 0)
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // Portrait screens crop the horizontal field of view hard. Pull the
    // held tool toward the centre and shrink it so the rod stays on screen.
    if (this.hand) {
      if (this.camera.aspect < 0.65) {
        // Phone portrait: very tight horizontal FOV.
        this.hand.position.set(0.05, -0.32, -0.6)
        this.hand.scale.setScalar(0.58)
        this.handBaseY = -0.32
      } else if (this.camera.aspect < 0.95) {
        // Tablet / squarish viewport: pull in a little, keep it right of centre.
        this.hand.position.set(0.16, -0.3, -0.62)
        this.hand.scale.setScalar(0.72)
        this.handBaseY = -0.3
      } else {
        this.hand.position.set(0.4, -0.4, -0.66)
        this.hand.scale.setScalar(1)
        this.handBaseY = -0.4
      }
    }
  }

  render() { this.renderer.render(this.scene, this.camera) }
}
