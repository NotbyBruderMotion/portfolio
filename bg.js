/* Bruder Motion: page background
   Graphite smoke and soft silver light leaks drawn with a WebGL shader behind all content.
   Drifts slowly, glows toward the cursor, and shifts as you scroll. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cvs = document.createElement('canvas');
  cvs.id = 'bg-smoke';
  cvs.setAttribute('aria-hidden', 'true');
  document.body.prepend(cvs);

  const gl = cvs.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) { cvs.remove(); return; }

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const frag = `
    precision mediump float;
    uniform vec2 res; uniform float t; uniform vec2 mouse; uniform float scroll;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0., a = .5;
      mat2 r = mat2(.8, .6, -.6, .8);
      for (int i = 0; i < 5; i++){ v += a * noise(p); p = r * p * 2.02; a *= .5; }
      return v;
    }
    void main(){
      vec2 uv = gl_FragCoord.xy / res;
      vec2 p0 = (gl_FragCoord.xy - .5 * res) / min(res.x, res.y);
      vec2 p = p0 + vec2(0., scroll * .35);
      float tt = t * .045;
      // domain-warped smoke
      vec2 q = vec2(fbm(p * 1.4 + tt), fbm(p * 1.4 - tt + 4.3));
      vec2 r = vec2(fbm(p * 1.6 + 2.2 * q + vec2(1.7, 9.2) + tt * 1.3), fbm(p * 1.6 + 2.2 * q + vec2(8.3, 2.8) - tt));
      float s = fbm(p * 1.3 + 2.4 * r);
      s = smoothstep(.35, .95, s);
      // cursor glow
      vec2 m = (vec2(mouse.x, res.y - mouse.y) - .5 * res) / min(res.x, res.y);
      float g = exp(-3.2 * length(p0 - m));
      // light leak sweeping from the top-right corner
      float leak = smoothstep(1.1, 0., length(uv - vec2(.95 + .05 * sin(t * .1), 1.05))) * (.6 + .4 * sin(t * .23));
      vec3 deep = vec3(.17, .17, .18);
      vec3 hot  = vec3(.62, .62, .64);
      vec3 col = deep * s * 1.4 + hot * pow(s, 3.) * .55;
      col += hot * g * (.10 + .25 * s);
      col += vec3(.42, .42, .44) * leak * .35;
      // vignette keeps the edges black
      col *= smoothstep(1.25, .25, length(uv - .5) * 1.5);
      col += .02 * (hash(gl_FragCoord.xy + t) - .5);
      gl_FragColor = vec4(col * .5 + vec3(.035), 1.);
    }`;

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cvs.remove(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('res'), uT = U('t'), uMouse = U('mouse'), uScroll = U('scroll');

  // Render at reduced resolution; the smoke is soft so it upscales cleanly
  const SCALE = innerWidth < 760 ? .35 : .5;
  const size = () => {
    cvs.width = Math.max(2, Math.round(innerWidth * SCALE));
    cvs.height = Math.max(2, Math.round(innerHeight * SCALE));
    gl.viewport(0, 0, cvs.width, cvs.height);
    gl.uniform2f(uRes, cvs.width, cvs.height);
  };
  size();
  addEventListener('resize', size);

  let mx = innerWidth * .7, my = innerHeight * .3, smx = mx, smy = my, sc = 0;
  addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  const t0 = performance.now();
  const frame = now => {
    smx += (mx - smx) * .05; smy += (my - smy) * .05;
    sc += (scrollY / innerHeight - sc) * .08;
    gl.uniform1f(uT, (now - t0) / 1000);
    gl.uniform2f(uMouse, smx * SCALE, smy * SCALE);
    gl.uniform1f(uScroll, sc);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce && !document.hidden) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) requestAnimationFrame(frame); });
})();
