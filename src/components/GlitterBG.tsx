import { useEffect, useRef } from 'react'

/* Fondo WebGL "glitter" de la intro — MISMA técnica que la referencia de Juan (21st.dev):
   textura de RUIDO muestreada a dos escalas/velocidades, R*G, pow(·,12) para destellos afilados y ×5
   de brillo. Reescrito en WebGL PURO (sin three.js / @react-three/fiber → ~150KB menos de bundle).
   Animación MUCHO MÁS LENTA (Juan). Vive solo mientras la intro está montada → libera el contexto al
   desmontar. No se usa en reduced-motion / Salón frío. */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

// Fragment shader EXACTO de la referencia (uv vía gl_FragCoord; el ruido va en REPEAT → wrap idéntico).
const FRAG = `precision highp float;
uniform float iTime; uniform vec2 iResolution; uniform sampler2D iChannel0;
uniform vec3 uColor;
void main(){
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float result = 0.0;
  result += texture2D(iChannel0, uv * 1.1 + vec2(iTime * -0.005)).r;
  result *= texture2D(iChannel0, uv * 0.9 + vec2(iTime *  0.005)).g;
  result = pow(result, 12.0);          // destellos afilados
  gl_FragColor = vec4(vec3(5.0) * result * uColor, 1.0); // ×5 brillo, teñido al color de acento
}`

const SPEED = 0.2 // « mucho más lenta » (la ref usaba 0.75)

export default function GlitterBG({ color = '#ffffff' }: { color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cvs = ref.current
    if (!cvs) return
    const gl = cvs.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' })
    if (!gl) return
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW) // triángulo full-screen
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    // Textura de RUIDO 512² RGBA aleatoria (igual que generateNoiseTexture de la referencia).
    const SIZE = 512
    const data = new Uint8Array(SIZE * SIZE * 4)
    for (let i = 0; i < SIZE * SIZE; i++) {
      const s = i * 4
      data[s] = Math.random() * 255
      data[s + 1] = Math.random() * 255
      data[s + 2] = Math.random() * 255
      data[s + 3] = 255
    }
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const uTime = gl.getUniformLocation(prog, 'iTime')
    const uRes = gl.getUniformLocation(prog, 'iResolution')
    gl.uniform1i(gl.getUniformLocation(prog, 'iChannel0'), 0)
    // Tinte de las partículas = color de acento (hex → vec3 normalizado). Default blanco = sin teñir.
    const cHex = color.replace('#', '')
    const cN = parseInt(cHex.length === 3 ? cHex.split('').map((x) => x + x).join('') : cHex, 16)
    gl.uniform3f(gl.getUniformLocation(prog, 'uColor'), ((cN >> 16) & 255) / 255, ((cN >> 8) & 255) / 255, (cN & 255) / 255)

    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const t0 = performance.now()
    let raf = 0
    const draw = () => {
      const w = Math.max(1, (cvs.clientWidth * dpr) | 0)
      const h = Math.max(1, (cvs.clientHeight * dpr) | 0)
      if (cvs.width !== w || cvs.height !== h) {
        cvs.width = w
        cvs.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uRes, cvs.width, cvs.height)
      gl.uniform1f(uTime, ((performance.now() - t0) / 1000) * SPEED)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      const ext = gl.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    }
  }, [color])
  return <canvas ref={ref} className="br-glitter" aria-hidden="true" />
}
