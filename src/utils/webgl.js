// 检测浏览器是否支持 WebGL(3D 地图与粒子背景依赖)
export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')))
  } catch (e) {
    return false
  }
}
