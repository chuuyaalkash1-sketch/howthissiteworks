import { useEffect, useRef, useState } from "react";

const vertexShader = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 uTexel;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const copyFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
void main() { outColor = texture(uTexture, vUv); }`;

const clearFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform float uValue;
void main() { outColor = texture(uTexture, vUv) * uValue; }`;

const splatFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
uniform float uAspect;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  float falloff = exp(-dot(p, p) / max(uRadius, 0.000001));
  vec3 base = texture(uTarget, vUv).rgb;
  outColor = vec4(base + uColor * falloff, 1.0);
}`;

const advectionFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uVelocityTexel;
uniform vec2 uSourceTexel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - uDt * velocity * uVelocityTexel;
  vec4 value = texture(uSource, clamp(coord, vec2(0.001), vec2(0.999)));
  outColor = value * uDissipation;
}`;

const divergenceFragment = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const pressureFragment = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + T + B - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const gradientFragment = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const curlFragment = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  outColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const vorticityFragment = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main() {
  float L = abs(texture(uCurl, vL).x);
  float R = abs(texture(uCurl, vR).x);
  float T = abs(texture(uCurl, vT).x);
  float B = abs(texture(uCurl, vB).x);
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(T - B, R - L);
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy;
  outColor = vec4(velocity + force * uDt, 0.0, 1.0);
}`;

const displayFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uDensity;
uniform float uExposure;
void main() {
  vec3 color = texture(uDensity, vUv).rgb;
  color = 1.0 - exp(-color * uExposure);
  float glow = max(max(color.r, color.g), color.b);
  color += glow * 0.06;
  color = pow(color, vec3(0.88));
  vec2 q = vUv - 0.5;
  float vignette = smoothstep(0.86, 0.18, dot(q, q));
  color *= 0.68 + 0.32 * vignette;
  outColor = vec4(color, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader error: ${log}`);
  }
  return shader;
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexShader));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program error: ${log}`);
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const values = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
  return values[i % 6];
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

export default function WebGLFluid({ compact = false, quality = "high" }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(false);
  const [settings, setSettings] = useState({
    force: 5600,
    radius: 18,
    smokeLife: 996,
    velocityLife: 988,
    swirl: 24,
    pressure: 20,
    brightness: 118,
    color: "#9fe4d0",
    rainbow: true,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      setError("WebGL2 is not supported in this browser.");
      return undefined;
    }
    if (!gl.getExtension("EXT_color_buffer_float")) {
      setError("Floating-point WebGL textures are not supported on this device.");
      return undefined;
    }

    let frameId = 0;
    let lastTime = performance.now();
    let hue = 0.42;
    let pointer = { down: false, moved: false, x: 0.5, y: 0.5, px: 0.5, py: 0.5 };
    let config = settings;
    let isPaused = paused;

    const programs = {
      copy: createProgram(gl, copyFragment),
      clear: createProgram(gl, clearFragment),
      splat: createProgram(gl, splatFragment),
      advect: createProgram(gl, advectionFragment),
      divergence: createProgram(gl, divergenceFragment),
      pressure: createProgram(gl, pressureFragment),
      gradient: createProgram(gl, gradientFragment),
      curl: createProgram(gl, curlFragment),
      vorticity: createProgram(gl, vorticityFragment),
      display: createProgram(gl, displayFragment),
    };

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function bindProgram(entry, texel) {
      gl.useProgram(entry.program);
      if (entry.uniforms.uTexel) gl.uniform2f(entry.uniforms.uTexel, texel[0], texel[1]);
    }

    function makeTarget(width, height, filter = gl.LINEAR) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { texture, fbo, width, height, texel: [1 / width, 1 / height] };
    }

    function makeDouble(width, height, filter = gl.LINEAR) {
      let read = makeTarget(width, height, filter);
      let write = makeTarget(width, height, filter);
      return {
        get read() { return read; },
        get write() { return write; },
        swap() { const temp = read; read = write; write = temp; },
      };
    }

    let velocity;
    let density;
    let pressure;
    let divergence;
    let curl;

    function blit(target) {
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.width, target.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 2.5 : 2);
      const width = Math.max(2, Math.round(rect.width * dpr));
      const height = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width === width && canvas.height === height && velocity) return;
      canvas.width = width;
      canvas.height = height;
      const aspect = width / height;
      const simBase = window.innerWidth < 700 ? 132 : quality === "high" ? 192 : 144;
      const dyeBase = window.innerWidth < 700 ? 640 : quality === "high" ? 1152 : 768;
      const simW = aspect >= 1 ? Math.round(simBase * aspect) : simBase;
      const simH = aspect >= 1 ? simBase : Math.round(simBase / aspect);
      const dyeW = aspect >= 1 ? Math.round(dyeBase * aspect) : dyeBase;
      const dyeH = aspect >= 1 ? dyeBase : Math.round(dyeBase / aspect);
      velocity = makeDouble(simW, simH, gl.LINEAR);
      density = makeDouble(dyeW, dyeH, gl.LINEAR);
      pressure = makeDouble(simW, simH, gl.NEAREST);
      divergence = makeTarget(simW, simH, gl.NEAREST);
      curl = makeTarget(simW, simH, gl.NEAREST);
      for (let i = 0; i < 7; i += 1) {
        const x = 0.15 + Math.random() * 0.7;
        const y = 0.2 + Math.random() * 0.55;
        const color = hsvToRgb((hue + i * 0.11) % 1, 0.52, 0.8);
        splat(x, y, (Math.random() - 0.5) * 900, (Math.random() - 0.5) * 700, color);
      }
    }

    function texture(unit, target, location) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.uniform1i(location, unit);
    }

    function splat(x, y, dx, dy, color) {
      const aspect = canvas.width / canvas.height;
      const radius = Math.pow(config.radius / 100, 2) * 0.35;

      bindProgram(programs.splat, velocity.read.texel);
      texture(0, velocity.read, programs.splat.uniforms.uTarget);
      gl.uniform2f(programs.splat.uniforms.uPoint, x, y);
      gl.uniform3f(programs.splat.uniforms.uColor, dx, dy, 0);
      gl.uniform1f(programs.splat.uniforms.uRadius, radius);
      gl.uniform1f(programs.splat.uniforms.uAspect, aspect);
      blit(velocity.write);
      velocity.swap();

      bindProgram(programs.splat, density.read.texel);
      texture(0, density.read, programs.splat.uniforms.uTarget);
      gl.uniform2f(programs.splat.uniforms.uPoint, x, y);
      gl.uniform3f(programs.splat.uniforms.uColor, color[0], color[1], color[2]);
      gl.uniform1f(programs.splat.uniforms.uRadius, radius * 1.4);
      gl.uniform1f(programs.splat.uniforms.uAspect, aspect);
      blit(density.write);
      density.swap();
    }

    function step(dt) {
      bindProgram(programs.curl, velocity.read.texel);
      texture(0, velocity.read, programs.curl.uniforms.uVelocity);
      blit(curl);

      bindProgram(programs.vorticity, velocity.read.texel);
      texture(0, velocity.read, programs.vorticity.uniforms.uVelocity);
      texture(1, curl, programs.vorticity.uniforms.uCurl);
      gl.uniform1f(programs.vorticity.uniforms.uCurlStrength, config.swirl);
      gl.uniform1f(programs.vorticity.uniforms.uDt, dt);
      blit(velocity.write);
      velocity.swap();

      bindProgram(programs.divergence, velocity.read.texel);
      texture(0, velocity.read, programs.divergence.uniforms.uVelocity);
      blit(divergence);

      bindProgram(programs.clear, pressure.read.texel);
      texture(0, pressure.read, programs.clear.uniforms.uTexture);
      gl.uniform1f(programs.clear.uniforms.uValue, 0.8);
      blit(pressure.write);
      pressure.swap();

      bindProgram(programs.pressure, pressure.read.texel);
      texture(1, divergence, programs.pressure.uniforms.uDivergence);
      const iterations = Math.max(8, Math.round(config.pressure));
      for (let i = 0; i < iterations; i += 1) {
        texture(0, pressure.read, programs.pressure.uniforms.uPressure);
        blit(pressure.write);
        pressure.swap();
      }

      bindProgram(programs.gradient, velocity.read.texel);
      texture(0, pressure.read, programs.gradient.uniforms.uPressure);
      texture(1, velocity.read, programs.gradient.uniforms.uVelocity);
      blit(velocity.write);
      velocity.swap();

      bindProgram(programs.advect, velocity.read.texel);
      texture(0, velocity.read, programs.advect.uniforms.uVelocity);
      texture(1, velocity.read, programs.advect.uniforms.uSource);
      gl.uniform2f(programs.advect.uniforms.uVelocityTexel, ...velocity.read.texel);
      gl.uniform2f(programs.advect.uniforms.uSourceTexel, ...velocity.read.texel);
      gl.uniform1f(programs.advect.uniforms.uDt, dt);
      gl.uniform1f(programs.advect.uniforms.uDissipation, config.velocityLife / 1000);
      blit(velocity.write);
      velocity.swap();

      bindProgram(programs.advect, density.read.texel);
      texture(0, velocity.read, programs.advect.uniforms.uVelocity);
      texture(1, density.read, programs.advect.uniforms.uSource);
      gl.uniform2f(programs.advect.uniforms.uVelocityTexel, ...velocity.read.texel);
      gl.uniform2f(programs.advect.uniforms.uSourceTexel, ...density.read.texel);
      gl.uniform1f(programs.advect.uniforms.uDt, dt);
      gl.uniform1f(programs.advect.uniforms.uDissipation, config.smokeLife / 1000);
      blit(density.write);
      density.swap();
    }

    function render() {
      bindProgram(programs.display, density.read.texel);
      texture(0, density.read, programs.display.uniforms.uDensity);
      gl.uniform1f(programs.display.uniforms.uExposure, config.brightness / 100);
      blit(null);
    }

    function addPointerSplat() {
      if (!pointer.moved) return;
      pointer.moved = false;
      const dx = (pointer.x - pointer.px) * config.force;
      const dy = (pointer.y - pointer.py) * config.force;
      hue = (hue + 0.0035) % 1;
      const color = config.rainbow ? hsvToRgb(hue, 0.55, 0.9) : hexToRgb(config.color);
      splat(pointer.x, pointer.y, dx, dy, color.map((v) => v * 0.65));
    }

    function update(time) {
      resize();
      const dt = Math.min((time - lastTime) / 1000, 0.0167);
      lastTime = time;
      if (!isPaused) {
        addPointerSplat();
        step(dt);
      }
      render();
      frameId = requestAnimationFrame(update);
    }

    function locate(event) {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      pointer.x = Math.max(0, Math.min(1, x));
      pointer.y = Math.max(0, Math.min(1, y));
      pointer.moved = true;
    }

    function onPointerDown(event) {
      pointer.down = true;
      locate(event);
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      canvas.setPointerCapture?.(event.pointerId);
    }
    function onPointerMove(event) {
      if (event.pointerType === "mouse" || pointer.down) locate(event);
    }
    function onPointerUp() { pointer.down = false; }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", resize);

    engineRef.current = {
      setSettings(next) { config = next; },
      setPaused(next) { isPaused = next; },
      clear() {
        [velocity?.read, velocity?.write, density?.read, density?.write, pressure?.read, pressure?.write].forEach((target) => {
          if (!target) return;
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
          gl.viewport(0, 0, target.width, target.height);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        });
      },
    };

    resize();
    frameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", resize);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => { engineRef.current?.setSettings(settings); }, [settings]);
  useEffect(() => { engineRef.current?.setPaused(paused); }, [paused]);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  return (
    <div className={`smoke-fluid-page ${compact ? "compact" : ""}`}>
      <canvas ref={canvasRef} className="smoke-fluid-canvas" />
      <div className="smoke-fluid-vignette" />
      {!compact && <div className="smoke-fluid-heading">
        <p className="eyebrow">3/S WEBGL LAB</p>
        <h1>Smoke field</h1>
        <p>Move the cursor or drag to shape the flow.</p>
      </div>}

      {error && <div className="smoke-webgl-error">{error}</div>}

      {!compact && <button className="smoke-settings-toggle" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide settings" : "Settings"}
      </button>}

      {!compact && open && (
        <aside className="smoke-controls">
          <div className="smoke-controls-title">
            <div><p className="eyebrow">GPU FLOW CONTROLS</p><h2>Smoke</h2></div>
            <button onClick={() => setOpen(false)} aria-label="Close settings">×</button>
          </div>
          <label>Force <strong>{settings.force}</strong><input type="range" min="1500" max="9000" step="100" value={settings.force} onChange={(e) => update("force", Number(e.target.value))} /></label>
          <label>Brush size <strong>{settings.radius}</strong><input type="range" min="5" max="34" value={settings.radius} onChange={(e) => update("radius", Number(e.target.value))} /></label>
          <label>Smoke life <strong>{settings.smokeLife}</strong><input type="range" min="970" max="999" value={settings.smokeLife} onChange={(e) => update("smokeLife", Number(e.target.value))} /></label>
          <label>Velocity life <strong>{settings.velocityLife}</strong><input type="range" min="950" max="999" value={settings.velocityLife} onChange={(e) => update("velocityLife", Number(e.target.value))} /></label>
          <label>Swirl <strong>{settings.swirl}</strong><input type="range" min="0" max="50" value={settings.swirl} onChange={(e) => update("swirl", Number(e.target.value))} /></label>
          <label>Pressure <strong>{settings.pressure}</strong><input type="range" min="8" max="32" value={settings.pressure} onChange={(e) => update("pressure", Number(e.target.value))} /></label>
          <label>Brightness <strong>{settings.brightness}%</strong><input type="range" min="60" max="180" value={settings.brightness} onChange={(e) => update("brightness", Number(e.target.value))} /></label>
          <div className="smoke-color-row">
            <label className="smoke-color-picker">Color<input type="color" value={settings.color} disabled={settings.rainbow} onChange={(e) => update("color", e.target.value)} /></label>
            <label className="smoke-check"><input type="checkbox" checked={settings.rainbow} onChange={(e) => update("rainbow", e.target.checked)} /> Gradient</label>
          </div>
          <div className="smoke-actions">
            <button onClick={() => setPaused((value) => !value)}>{paused ? "Continue" : "Pause"}</button>
            <button onClick={() => engineRef.current?.clear()}>Clear</button>
          </div>
        </aside>
      )}
    </div>
  );
}
