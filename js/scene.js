/* anon scene: one faceless bust in the dark, then the crowd it hides in. A scan line (the trackers) passes over
   every face and finds nothing. Scroll picks the shot; the loop eases toward it. */
import * as THREE from '/vendor/three.module.min.js';

async function loadBust(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf); const nv = dv.getUint32(0, true), ni = dv.getUint32(4, true);
  const pos = new Float32Array(buf, 8, nv * 3); const idx = new Uint16Array(buf, 8 + nv * 12, ni);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals(); return g;
}

export async function createScene(canvas, opt = {}) {
  const mobile = !!opt.mobile;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  const DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x040405); scene.fog = new THREE.Fog(0x040405, 2.2, 13);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 60);
  const [hi, lo] = await Promise.all([loadBust('/models/bust.bin'), loadBust('/models/bust-lo.bin')]);

  // the scan: a thin band of light at one height, on every surface it crosses
  const U = { uScanY: { value: -5 }, uScanK: { value: 0 }, uTime: { value: 0 } };
  function material(base) {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.46, metalness: 0.0, side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 wpos = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpos = instanceMatrix * wpos;
          #endif
          vWP = (modelMatrix * wpos).xyz;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uScanY; uniform float uScanK;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sd = abs(vWP.y - uScanY);
          totalEmissiveRadiance += vec3(0.85, 0.92, 1.0) * (smoothstep(0.0035, 0.0006, sd) * 3.2 + smoothstep(0.05, 0.0, sd) * 0.08) * uScanK;`);
    };
    return m;
  }
  const hero = new THREE.Mesh(hi, material(0xd8d8d4)); hero.position.set(0, 0, 0); scene.add(hero);

  // the crowd: everyone else, all the same, all facing you
  const N = mobile ? 110 : 260; const crowd = new THREE.InstancedMesh(lo, material(0xb8b8b6), N);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  let k = 0; const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let row = 1; k < N; row++) {
    const z = -0.62 * row, n = 5 + row * 2;
    for (let i = 0; i < n && k < N; i++) {
      const x = (i - (n - 1) / 2) * 0.5 + (row % 2 ? 0.25 : 0) + (rnd() - 0.5) * 0.08;
      if (Math.abs(x) < 0.3 && row === 1) continue;
      p.set(x, 0, z + (rnd() - 0.5) * 0.12); e.set((rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.25, 0); q.setFromEuler(e);
      M.compose(p, q, sc); crowd.setMatrixAt(k++, M);
    }
  }
  crowd.count = k; scene.add(crowd);

  // light: a soft key on the one in front, rims that cut everyone out of the black
  const key = new THREE.SpotLight(0xffffff, 0, 6, 0.42, 0.75, 1.2); key.position.set(-0.9, 1.2, 1.4); key.target = hero; scene.add(key);
  const rimR = new THREE.DirectionalLight(0xdde6ff, 0); rimR.position.set(2.4, 1.2, -2.0); scene.add(rimR);
  const rimL = new THREE.DirectionalLight(0xdde6ff, 0); rimL.position.set(-2.4, 1.0, -1.8); scene.add(rimL);
  const fill = new THREE.HemisphereLight(0x8890a0, 0x050505, 0); scene.add(fill);

  // shots: camera position, target, how lit the one in front is, how strong the scan is
  const SHOTS = {
    intro:   { p: [0, 0.2, 4.6],  t: [0, 0.1, 0],    key: 0,   rim: 0.0, fill: 0.0, scan: 1 },
    hero:    { p: [0, 0.15, 2.55], t: [0, 0.1, 0],  key: 26,  rim: 1.6, fill: 0.10, scan: 0.0 },
    watched: { p: [0, 0.95, 3.6],  t: [0, -0.05, -2.2], key: 14, rim: 2.2, fill: 0.16, scan: 0.0 },
    scan:    { p: [1.7, 0.32, 2.2], t: [-0.6, 0.12, -3], key: 8,  rim: 2.4, fill: 0.12, scan: 1 },
    steps:   { p: [-1.3, 0.22, 1.5], t: [0.5, 0.1, -2.5], key: 10, rim: 2.0, fill: 0.1, scan: 0.35 },
    app:     { p: [0, 0.4, 5.2],   t: [0, 0.18, -4],  key: 4,   rim: 1.2, fill: 0.06, scan: 0 },
    end:     { p: [0, 0.16, 2.2],  t: [0, 0.12, -8],  key: 18,  rim: 2.4, fill: 0.12, scan: 1 },
  };
  const cur = { p: new THREE.Vector3(...SHOTS.intro.p), t: new THREE.Vector3(...SHOTS.intro.t), key: 0, rim: 0, fill: 0, scan: 0 };
  const goal = { p: cur.p.clone(), t: cur.t.clone(), key: 0, rim: 0, fill: 0, scan: 0 };
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  function go(a, b, f) {
    const sa = SHOTS[a] || SHOTS.hero, sb = SHOTS[b] || sa; const e2 = f * f * (3 - 2 * f);
    goal.p.copy(A.fromArray(sa.p)).lerp(B.fromArray(sb.p), e2); goal.t.copy(A.fromArray(sa.t)).lerp(B.fromArray(sb.t), e2);
    for (const kk of ['key', 'rim', 'fill', 'scan']) goal[kk] = sa[kk] + (sb[kk] - sa[kk]) * e2;
  }
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', ev => { pointer.x = ev.clientX / innerWidth - 0.5; pointer.y = ev.clientY / innerHeight - 0.5; }, { passive: true });

  let W = 0, H = 0;
  function resize() { W = innerWidth; H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W / H < 0.8 ? 44 : 30; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock(); let running = true, raf = 0, introT = -1, scanPhase = 0, flash = 0;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) loop(); });

  function step(dt) {
    const t = clock.elapsedTime; U.uTime.value = t;
    const kk = 1 - Math.pow(0.002, dt);
    cur.p.lerp(goal.p, kk); cur.t.lerp(goal.t, kk);
    for (const q2 of ['key', 'rim', 'fill', 'scan']) cur[q2] += (goal[q2] - cur[q2]) * kk;
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3); pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
    camera.position.copy(cur.p); camera.position.x += pointer.sx * 0.08 + (reduce ? 0 : Math.sin(t * 0.21) * 0.02); camera.position.y += -pointer.sy * 0.04;
    camera.lookAt(cur.t);
    // the one in front turns a little toward you
    hero.rotation.y += ((pointer.sx * 0.5 + (reduce ? 0 : Math.sin(t * 0.3) * 0.06)) - hero.rotation.y) * Math.min(1, dt * 2.5);
    hero.rotation.x += ((pointer.sy * 0.18) - hero.rotation.x) * Math.min(1, dt * 2.5);
    let lightK = 1;
    if (introT >= 0) { introT += dt; lightK = Math.min(1, Math.max(0, (introT - 0.9) / 1.4)); if (introT > 4) introT = -1; }
    key.intensity = cur.key * lightK * (1 + flash * 0.6); rimR.intensity = cur.rim * lightK; rimL.intensity = cur.rim * 0.75 * lightK; fill.intensity = cur.fill * lightK;
    // the scan sweeps down the faces, again and again
    if (!reduce) scanPhase += dt * (introT >= 0 ? 0.55 : 0.32);
    const ph = scanPhase % 1; U.uScanY.value = 0.32 - ph * 0.5; U.uScanK.value = cur.scan * Math.sin(Math.PI * ph) * (introT >= 0 ? 1 : 0.9);
    flash *= Math.pow(0.05, dt);
  }
  function loop() { cancelAnimationFrame(raf); const tick = () => { if (!running) return; const dt = Math.min(0.05, clock.getDelta()); step(dt); renderer.render(scene, camera); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
  loop();
  return {
    go, camera,
    intro() { introT = 0; scanPhase = 0; },
    settle() { cur.p.copy(goal.p); cur.t.copy(goal.t); for (const q2 of ['key', 'rim', 'fill', 'scan']) cur[q2] = goal[q2]; },
    flash() { flash = 1; },
  };
}
