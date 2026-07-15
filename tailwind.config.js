/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        tech: {
          bg: '#062018',
          panel: '#0a3526',
          panel2: '#0e4d36',
          border: 'rgba(0,255,156,0.28)',
          green: '#00FF9C',
          green2: '#10F5A0',
          teal: '#00C9B6',
          dim: '#2f6149',
          dimtext: '#5b9a78',
          muted: '#7dbf9c',
          fg: '#e6fff2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 14px rgba(0,255,156,0.65), 0 0 30px rgba(0,255,156,0.32)',
        glowsoft: '0 0 10px rgba(0,255,156,0.4)',
      },
    },
  },
  plugins: [],
}
