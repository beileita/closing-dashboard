<template>
  <div ref="el" class="fixed inset-0 z-0 pointer-events-none"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { store } from '../data/store'

const el = ref(null)
let raf, renderer, scene, camera, points, onResize, mat

onMounted(async () => {
  const THREE = await import('three')
  const w = window.innerWidth, h = window.innerHeight
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, w/h, 1, 1000)
  camera.position.z = 240

  const cnt = 250
  const pos = new Float32Array(cnt * 3)
  for(let i=0;i<cnt;i++) {
    pos[i*3] = (Math.random()-0.5)*700
    pos[i*3+1] = (Math.random()-0.5)*460
    pos[i*3+2] = (Math.random()-0.5)*360
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const particleColor = store.theme === 'dark' ? 0x00c26e : 0x008A4C
  mat = new THREE.PointsMaterial({
    color: particleColor,
    size: 2.0,
    transparent: true,
    opacity: store.theme === 'dark' ? 0.25 : 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  points = new THREE.Points(geo, mat)
  scene.add(points)

  renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  if(el.value) el.value.appendChild(renderer.domElement)

  const animate = () => {
    raf = requestAnimationFrame(animate)
    points.rotation.y += 0.0005
    points.rotation.x += 0.0002
    renderer.render(scene, camera)
  }
  animate()

  onResize = () => {
    const W=window.innerWidth, H=window.innerHeight
    camera.aspect = W/H; camera.updateProjectionMatrix()
    renderer.setSize(W, H)
  }
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if(onResize) window.removeEventListener('resize', onResize)
  if(renderer) renderer.dispose()
})
</script>
