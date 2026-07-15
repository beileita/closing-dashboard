<template>
  <div ref="el" class="fixed inset-0 z-0 pointer-events-none"></div>
</template>

<script setup>
// Three.js 漂浮粒子背景(桌面端 3D 氛围;移动端不加载,由 App 控制是否渲染)
import { ref, onMounted, onBeforeUnmount } from 'vue'

const el = ref(null)
let raf, renderer, scene, camera, points, onResize

onMounted(async () => {
  const THREE = await import('three')
  const w = window.innerWidth
  const h = window.innerHeight
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, w / h, 1, 1000)
  camera.position.z = 240

  const cnt = 300
  const pos = new Float32Array(cnt * 3)
  for (let i = 0; i < cnt; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 700
    pos[i * 3 + 1] = (Math.random() - 0.5) * 460
    pos[i * 3 + 2] = (Math.random() - 0.5) * 360
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: 0x00ff9c,
    size: 2.6,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  points = new THREE.Points(geo, mat)
  scene.add(points)

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  if (el.value) el.value.appendChild(renderer.domElement)

  const animate = () => {
    raf = requestAnimationFrame(animate)
    points.rotation.y += 0.0006
    points.rotation.x += 0.00028
    renderer.render(scene, camera)
  }
  animate()

  onResize = () => {
    const W = window.innerWidth
    const H = window.innerHeight
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    renderer.setSize(W, H)
  }
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (onResize) window.removeEventListener('resize', onResize)
  if (renderer) renderer.dispose()
})
</script>
