/* ============================================================
   CODELENS — Landing Page JS
   Scroll reveal · Nav · FAQ accordion · Algo animation · Demo
   Particles · Hero live vars · Upcoming features
   ============================================================ */

'use strict';

// ══════════════════════════════════════════════
// HERO PARTICLE SYSTEM
// ══════════════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById('hero-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animId;

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function randomParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.5 + 0.15,
      hue: Math.random() < 0.6 ? 252 : (Math.random() < 0.5 ? 220 : 170),
    };
  }

  function initParticleSet() {
    particles = [];
    const count = Math.min(Math.floor((W * H) / 6000), 120);
    for (let i = 0; i < count; i++) particles.push(randomParticle());
  }

  function drawConnections() {
    const maxDist = 120;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.12;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(124,110,232,${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function draw() {
    if (document.hidden) {
      animId = requestAnimationFrame(draw);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},80%,75%,${p.alpha})`;
      ctx.fill();
    });
    animId = requestAnimationFrame(draw);
  }

  const ro = new ResizeObserver(() => { resize(); initParticleSet(); });
  ro.observe(canvas.parentElement);
  resize();
  initParticleSet();
  draw();
})();

// ══════════════════════════════════════════════
// HERO LIVE VARIABLE TICKER
// ══════════════════════════════════════════════
(function initHeroTicker() {
  const data = [64, 34, 25, 12, 22, 11, 90];
  const actions = ['comparing…', 'swapping!', 'no swap', 'bubbling up', 'sorted ✓', 'next pass…'];
  let i = 0, j = 0, pass = 0;
  const n = data.length;
  const arr = [...data];

  function tickStep() {
    if (document.hidden) return;
    const elI   = document.getElementById('hvc-i-val');
    const elJ   = document.getElementById('hvc-j-val');
    const elArr = document.getElementById('hvc-arr-val');
    const elAct = document.getElementById('hvc-action');
    const chipI = document.getElementById('hvc-i');
    const chipJ = document.getElementById('hvc-j');
    const chipArr = document.getElementById('hvc-arr');
    if (!elI) return;

    if (j < n - pass - 1) {
      const swap = arr[j] > arr[j + 1];
      if (swap) [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];

      elI.textContent   = pass;
      elJ.textContent   = j;
      elArr.textContent = arr[j];
      if (elAct) elAct.textContent = swap ? 'swapping!' : 'no swap';
      if (elAct) elAct.style.color = swap ? 'var(--accent-amber)' : 'var(--accent-emerald)';

      // Flash updated chip
      [chipI, chipJ, chipArr].forEach(c => c && c.classList.remove('updated'));
      if (swap && chipArr) { chipArr.classList.add('updated'); setTimeout(() => chipArr.classList.remove('updated'), 500); }
      j++;
    } else {
      pass++;
      j = 0;
      if (pass >= n - 1) { pass = 0; arr.splice(0, n, ...data); }
      if (elAct) { elAct.textContent = 'next pass…'; elAct.style.color = 'var(--accent-primary)'; }
    }
  }

  setInterval(tickStep, 900);
})();

// ══════════════════════════════════════════════
// SCROLL REVEAL
// ══════════════════════════════════════════════
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ══════════════════════════════════════════════
// NAV — Scroll Behaviour
// ══════════════════════════════════════════════
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 60) nav.classList.add('nav-scrolled');
  else nav.classList.remove('nav-scrolled');
}, { passive: true });

// ══════════════════════════════════════════════
// HERO DEMO — Animated Array
// ══════════════════════════════════════════════
const demoArray = [38, 27, 43, 3, 9, 82, 10];
let demoStep = 0;
let demoI = 0, demoJ = 0;
const demoArrCopy = [...demoArray];

function renderDemoArray(arr, highlighted = []) {
  const container = document.getElementById('demo-array-viz');
  if (!container) return;
  container.innerHTML = arr.map((v, i) => {
    const isActive = highlighted.includes(i);
    return `<div class="array-cell">
      <div class="array-box ${isActive ? 'comparing' : ''}" style="transition:all 0.4s">${v}</div>
      <div class="array-idx">${i}</div>
    </div>`;
  }).join('');
}

function renderDemoBars(arr, highlighted = []) {
  const container = document.getElementById('demo-bar-chart');
  if (!container) return;
  const max = Math.max(...arr);
  container.innerHTML = arr.map((v, i) => {
    const h = Math.round((v / max) * 80);
    const cls = highlighted.includes(i) ? 'comparing' : '';
    return `<div class="demo-bar ${cls}" style="height:${h}px"></div>`;
  }).join('');
}

function demoBubbleStep() {
  if (document.hidden) return;
  const n = demoArrCopy.length;
  if (demoI >= n - 1) {
    renderDemoArray(demoArrCopy);
    renderDemoBars(demoArrCopy);
    demoI = 0; demoJ = 0;
    document.getElementById('demo-pass-count').textContent = '1 / 7';
    return;
  }
  if (demoJ < n - demoI - 1) {
    if (demoArrCopy[demoJ] > demoArrCopy[demoJ + 1]) {
      [demoArrCopy[demoJ], demoArrCopy[demoJ + 1]] = [demoArrCopy[demoJ + 1], demoArrCopy[demoJ]];
    }
    renderDemoArray(demoArrCopy, [demoJ, demoJ + 1]);
    renderDemoBars(demoArrCopy, [demoJ, demoJ + 1]);
    demoJ++;
  } else {
    demoI++;
    demoJ = 0;
    document.getElementById('demo-pass-count').textContent = `${demoI + 1} / 7`;
  }
}

renderDemoArray(demoArray, [3, 4]);
renderDemoBars(demoArray, [3, 4]);
setInterval(demoBubbleStep, 1200);

// ══════════════════════════════════════════════
// FEATURE ARRAY DEMO — animate continuously
// ══════════════════════════════════════════════
const featureArr = [5, 2, 8, 1, 9, 3, 7];
let fIdx = 0;

function renderFeatureArray(arr, activeIdx) {
  const container = document.getElementById('feature-array-demo');
  if (!container) return;
  container.innerHTML = arr.map((v, i) => {
    const cls = i === activeIdx ? 'active' : (i < activeIdx ? 'sorted' : '');
    return `<div class="array-cell">
      <div class="array-box ${cls}">${v}</div>
      <div class="array-idx">${i}</div>
    </div>`;
  }).join('');
}

function animateFeatureArray() {
  if (document.hidden) return;
  renderFeatureArray(featureArr, fIdx);
  const vi = document.getElementById('var-i');
  const vj = document.getElementById('var-j');
  if (vi) vi.textContent = Math.floor(fIdx / featureArr.length * 3);
  if (vj) vj.textContent = fIdx;
  fIdx = (fIdx + 1) % featureArr.length;
}
renderFeatureArray(featureArr, 2);
setInterval(animateFeatureArray, 1400);

// ══════════════════════════════════════════════
// HOW IT WORKS — Preview Tabs & Steps
// ══════════════════════════════════════════════
const previewContents = {
  paste: `
    <div style="background:var(--bg-overlay);border-radius:8px;padding:16px;border:1px solid var(--border-subtle)">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:10px">📋 Paste Any Code</div>
      <div style="font-family:var(--font-mono);font-size:12px;line-height:22px">
        <span class="code-keyword">def</span> <span class="code-function">fibonacci</span>(<span class="code-param">n</span>):<br/>
        &nbsp;&nbsp;&nbsp;&nbsp;<span class="code-keyword">if</span> n &lt;= <span class="code-number">1</span>:<br/>
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="code-keyword">return</span> n<br/>
        &nbsp;&nbsp;&nbsp;&nbsp;<span class="code-keyword">return</span> <span class="code-function">fibonacci</span>(n-<span class="code-number">1</span>) + <span class="code-function">fibonacci</span>(n-<span class="code-number">2</span>)<span class="cursor"></span>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <span class="chip">Python</span>
      <span class="chip">JavaScript</span>
      <span class="chip">C++</span>
      <span class="chip">Java</span>
      <span class="chip">Go</span>
      <span class="chip">Rust</span>
    </div>
  `,
  analyze: `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:rgba(124,110,232,0.08);border:1px solid rgba(124,110,232,0.2);border-radius:8px;padding:12px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent-primary);margin-bottom:6px">🧠 AI Analysis</div>
        <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">This is a recursive implementation of Fibonacci. The base cases are <code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);color:var(--accent-cyan)">n=0</code> and <code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);color:var(--accent-cyan)">n=1</code>.</div>
      </div>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-amber);margin-bottom:6px">⚡ Complexity</div>
        <div style="display:flex;gap:12px">
          <span style="font-size:12px;color:var(--text-secondary)">Time: <strong style="color:var(--accent-amber);font-family:var(--font-mono)">O(2ⁿ)</strong></span>
          <span style="font-size:12px;color:var(--text-secondary)">Space: <strong style="color:var(--accent-emerald);font-family:var(--font-mono)">O(n)</strong></span>
        </div>
      </div>
      <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:8px;padding:12px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-rose);margin-bottom:6px">⚠ Issues Found</div>
        <div style="font-size:12px;color:var(--text-secondary)">Exponential time — consider memoization for large inputs.</div>
      </div>
    </div>
  `,
  visualize: `
    <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px">🌳 Recursion Tree (n=5)</div>
    <div style="text-align:center;font-family:var(--font-mono);font-size:11px;line-height:1.8;color:var(--text-secondary)">
      <div style="color:var(--accent-primary);font-weight:700">fib(5)</div>
      <div>├── <span style="color:var(--accent-blue)">fib(4)</span></div>
      <div>│&nbsp;&nbsp;&nbsp;├── <span style="color:var(--accent-blue)">fib(3)</span></div>
      <div>│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── <span style="color:var(--accent-emerald)">fib(2)</span></div>
      <div>│&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── <span style="color:var(--accent-emerald)">fib(1) → 1</span></div>
      <div>│&nbsp;&nbsp;&nbsp;└── <span style="color:var(--accent-emerald)">fib(2) → 1</span></div>
      <div>└── <span style="color:var(--accent-blue)">fib(3)</span></div>
      <div>&nbsp;&nbsp;&nbsp;&nbsp;├── <span style="color:var(--accent-emerald)">fib(2) → 1</span></div>
      <div>&nbsp;&nbsp;&nbsp;&nbsp;└── <span style="color:var(--accent-emerald)">fib(1) → 1</span></div>
    </div>
  `
};

function setPreview(key) {
  const body = document.getElementById('how-preview-body');
  if (body) body.innerHTML = previewContents[key] || '';
  document.querySelectorAll('.how-preview-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.preview === key);
  });
}

document.querySelectorAll('.how-preview-tab').forEach(tab => {
  tab.addEventListener('click', () => setPreview(tab.dataset.preview));
});

// Step hover interactions
document.querySelectorAll('.step-item').forEach(step => {
  step.addEventListener('click', () => {
    document.querySelectorAll('.step-item').forEach(s => s.classList.remove('active'));
    step.classList.add('active');
    const stepMap = { '1': 'paste', '2': 'analyze', '3': 'visualize' };
    setPreview(stepMap[step.dataset.step]);
  });
});

setPreview('paste');

// ══════════════════════════════════════════════
// ALGORITHM SHOWCASE
// ══════════════════════════════════════════════
const algos = {
  bubble: {
    label: 'Bubble Sort',
    complexity: 'O(n²) time · O(1) space',
    lang: 'Python',
    code: [
      { text: '<span class="code-keyword">def</span> <span class="code-function">bubble_sort</span>(<span class="code-param">arr</span>):', indent: 0 },
      { text: '    n = <span class="code-function">len</span>(arr)', indent: 1 },
      { text: '    <span class="code-keyword">for</span> i <span class="code-keyword">in</span> <span class="code-function">range</span>(n):', indent: 1 },
      { text: '        <span class="code-keyword">for</span> j <span class="code-keyword">in</span> <span class="code-function">range</span>(<span class="code-number">0</span>, n-i-<span class="code-number">1</span>):', indent: 2 },
      { text: '            <span class="code-keyword">if</span> arr[j] &gt; arr[j+<span class="code-number">1</span>]:', indent: 3 },
      { text: '                arr[j], arr[j+<span class="code-number">1</span>] = arr[j+<span class="code-number">1</span>], arr[j]', indent: 4 },
      { text: '    <span class="code-keyword">return</span> arr', indent: 1 },
    ],
    initialData: [64, 34, 25, 12, 22, 11, 90],
  },
  binary: {
    label: 'Binary Search',
    complexity: 'O(log n) time · O(1) space',
    lang: 'Python',
    code: [
      { text: '<span class="code-keyword">def</span> <span class="code-function">binary_search</span>(<span class="code-param">arr, target</span>):', indent: 0 },
      { text: '    low, high = <span class="code-number">0</span>, <span class="code-function">len</span>(arr) - <span class="code-number">1</span>', indent: 1 },
      { text: '    <span class="code-keyword">while</span> low &lt;= high:', indent: 1 },
      { text: '        mid = (low + high) // <span class="code-number">2</span>', indent: 2 },
      { text: '        <span class="code-keyword">if</span> arr[mid] == target:', indent: 2 },
      { text: '            <span class="code-keyword">return</span> mid', indent: 3 },
      { text: '        <span class="code-keyword">elif</span> arr[mid] &lt; target:', indent: 2 },
      { text: '            low = mid + <span class="code-number">1</span>', indent: 3 },
      { text: '        <span class="code-keyword">else</span>:', indent: 2 },
      { text: '            high = mid - <span class="code-number">1</span>', indent: 3 },
    ],
    initialData: [11, 22, 25, 34, 50, 64, 90],
  },
  fib: {
    label: 'Fibonacci',
    complexity: 'O(2ⁿ) time · O(n) space',
    lang: 'Python',
    code: [
      { text: '<span class="code-keyword">def</span> <span class="code-function">fib</span>(<span class="code-param">n</span>):', indent: 0 },
      { text: '    <span class="code-comment"># Base cases</span>', indent: 1 },
      { text: '    <span class="code-keyword">if</span> n &lt;= <span class="code-number">1</span>:', indent: 1 },
      { text: '        <span class="code-keyword">return</span> n', indent: 2 },
      { text: '    <span class="code-comment"># Recursive case</span>', indent: 1 },
      { text: '    <span class="code-keyword">return</span> <span class="code-function">fib</span>(n-<span class="code-number">1</span>) + <span class="code-function">fib</span>(n-<span class="code-number">2</span>)', indent: 1 },
    ],
    initialData: [1, 1, 2, 3, 5, 8, 13],
  },
  bfs: {
    label: 'BFS',
    complexity: 'O(V+E) time · O(V) space',
    lang: 'Python',
    code: [
      { text: '<span class="code-keyword">from</span> collections <span class="code-keyword">import</span> deque', indent: 0 },
      { text: '<span class="code-keyword">def</span> <span class="code-function">bfs</span>(<span class="code-param">graph, start</span>):', indent: 0 },
      { text: '    visited = set()', indent: 1 },
      { text: '    queue = deque([start])', indent: 1 },
      { text: '    <span class="code-keyword">while</span> queue:', indent: 1 },
      { text: '        node = queue.popleft()', indent: 2 },
      { text: '        visited.add(node)', indent: 2 },
      { text: '        <span class="code-keyword">for</span> nb <span class="code-keyword">in</span> graph[node]:', indent: 2 },
      { text: '            <span class="code-keyword">if</span> nb <span class="code-keyword">not in</span> visited:', indent: 3 },
      { text: '                queue.append(nb)', indent: 4 },
    ],
    initialData: [3, 7, 12, 19, 28, 45, 60],
  }
};

let currentAlgo = 'bubble';
let algoData = [];
let algoStep = 0;
let algoSteps = [];
let algoTimer = null;
let algoPlaying = false;
let algoSpeed = 600;
let algoComparisons = 0;
let algoSwaps = 0;

function generateBubbleSteps(arr) {
  const a = [...arr], steps = [];
  const n = a.length;
  let comps = 0, swps = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      comps++;
      steps.push({ state: [...a], comparing: [j, j + 1], swapped: false, comps, swps, sortedFrom: n - i });
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swps++;
        steps.push({ state: [...a], comparing: [j, j + 1], swapped: true, comps, swps, sortedFrom: n - i });
      }
    }
  }
  steps.push({ state: [...a], comparing: [], swapped: false, comps, swps, sortedFrom: 0 });
  return steps;
}

function generateBinarySteps(arr) {
  const target = arr[4]; // middle-ish
  let low = 0, high = arr.length - 1;
  const steps = [];
  let comps = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    comps++;
    steps.push({ state: arr, comparing: [mid], low, high, comps, swps: 0 });
    if (arr[mid] === target) break;
    else if (arr[mid] < target) low = mid + 1;
    else high = mid - 1;
  }
  steps.push({ state: arr, comparing: [], comps, swps: 0 });
  return steps;
}

function generateGenericSteps(arr) {
  const steps = [];
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    steps.push({ state: arr, comparing: [i], comps: i + 1, swps: 0 });
  }
  steps.push({ state: arr, comparing: [], comps: n, swps: 0 });
  return steps;
}

function initAlgo(name) {
  currentAlgo = name;
  const cfg = algos[name];
  algoData = [...cfg.initialData];
  algoStep = 0;
  algoPlaying = false;
  algoComparisons = 0;
  algoSwaps = 0;
  clearInterval(algoTimer);

  // Update complexity badge, lang
  document.getElementById('algo-complexity').textContent = cfg.complexity;
  document.getElementById('algo-lang').textContent = cfg.lang;

  // Render code
  const codeEl = document.getElementById('algo-code');
  if (codeEl) {
    codeEl.innerHTML = cfg.code.map((line, idx) =>
      `<div class="code-line" data-line="${idx}" style="border-radius:4px;padding:0 4px">${line.text}</div>`
    ).join('');
  }

  // Generate steps
  if (name === 'bubble') algoSteps = generateBubbleSteps(algoData);
  else if (name === 'binary') algoSteps = generateBinarySteps(algoData);
  else algoSteps = generateGenericSteps(algoData);

  renderAlgoStep(0);

  const playBtn = document.getElementById('algo-play');
  if (playBtn) playBtn.innerHTML = '▶ Play';
}

function renderAlgoStep(idx) {
  if (!algoSteps.length) return;
  const step = algoSteps[Math.min(idx, algoSteps.length - 1)];
  const bars = document.getElementById('sort-bars');
  if (!bars) return;

  const max = Math.max(...step.state);
  bars.innerHTML = step.state.map((v, i) => {
    const h = Math.max(8, Math.round((v / max) * 180));
    let cls = '';
    if (step.comparing && step.comparing.includes(i)) cls = step.swapped ? 'swapping' : 'comparing';
    else if (step.sortedFrom !== undefined && i >= step.sortedFrom) cls = 'sorted';
    return `<div class="sort-bar ${cls}" style="height:${h}px" data-val="${v}"></div>`;
  }).join('');

  document.getElementById('algo-comparisons').textContent = step.comps || 0;
  document.getElementById('algo-swaps').textContent = step.swps || 0;
  document.getElementById('algo-step').textContent = idx;

  // Highlight code line
  const codeLines = document.querySelectorAll('.code-line[data-line]');
  codeLines.forEach(l => l.style.background = '');
  if (step.comparing && step.comparing.length && currentAlgo === 'bubble') {
    const lineIdx = step.swapped ? 5 : 4;
    const target = document.querySelector(`.code-line[data-line="${lineIdx}"]`);
    if (target) target.style.background = 'rgba(124,110,232,0.15)';
  }
}

function algoPlayPause() {
  algoPlaying = !algoPlaying;
  const btn = document.getElementById('algo-play');
  if (algoPlaying) {
    if (btn) btn.innerHTML = '⏸ Pause';
    algoTimer = setInterval(() => {
      if (document.hidden) return;
      if (algoStep >= algoSteps.length - 1) {
        algoStep = 0;
      } else {
        algoStep++;
      }
      renderAlgoStep(algoStep);
    }, algoSpeed);
  } else {
    clearInterval(algoTimer);
    if (btn) btn.innerHTML = '▶ Play';
  }
}

document.getElementById('algo-play')?.addEventListener('click', algoPlayPause);
document.getElementById('algo-reset')?.addEventListener('click', () => {
  clearInterval(algoTimer);
  algoPlaying = false;
  algoStep = 0;
  initAlgo(currentAlgo);
});
document.getElementById('algo-step-btn')?.addEventListener('click', () => {
  if (algoStep < algoSteps.length - 1) algoStep++;
  renderAlgoStep(algoStep);
});

document.querySelectorAll('.algo-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    clearInterval(algoTimer);
    algoPlaying = false;
    document.querySelectorAll('.algo-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    initAlgo(tab.dataset.algo);
  });
});

document.querySelectorAll('.speed-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-option').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    algoSpeed = parseInt(btn.dataset.speed);
    if (algoPlaying) {
      clearInterval(algoTimer);
      algoTimer = setInterval(() => {
        if (document.hidden) return;
        if (algoStep >= algoSteps.length - 1) algoStep = 0;
        else algoStep++;
        renderAlgoStep(algoStep);
      }, algoSpeed);
    }
  });
});

initAlgo('bubble');

// ══════════════════════════════════════════════
// FAQ Accordion
// ══════════════════════════════════════════════
const faqs = [
  {
    q: 'What languages does CodeLens support?',
    a: 'CodeLens currently supports Python, JavaScript, TypeScript, Java, C++, Go, and Rust. We\'re adding more languages regularly based on user requests.'
  },
  {
    q: 'Is the AI a ChatGPT wrapper?',
    a: 'No. CodeLens uses Gemini AI with a custom system prompt engineered for visual, educational, and structured output. It\'s designed to behave like a senior developer — guiding, not spoon-feeding.'
  },
  {
    q: 'Can I use CodeLens for interview preparation?',
    a: 'Absolutely. Many users use CodeLens to deeply understand algorithms and data structures before FAANG interviews. The visual nature makes patterns stick rather than being memorized.'
  },
  {
    q: 'Does it work on mobile?',
    a: 'The landing page is fully responsive. The workspace is optimized for desktop (13"+ screens) for the best learning experience, though tablet support is on the roadmap.'
  },
  {
    q: 'Can instructors use CodeLens in a classroom?',
    a: 'Yes! Our Team plan includes student progress dashboards, custom problem sets, and up to 25 seats. Contact us for university licensing.'
  },
  {
    q: 'How is CodeLens different from Python Tutor?',
    a: 'Python Tutor shows basic step-through execution. CodeLens provides AI-powered explanations, algorithm animations, an AI Mentor that teaches you to think, and a premium learning experience across all major languages.'
  },
  {
    q: 'Is my code safe and private?',
    a: 'Yes. Code you paste is only used to generate visualizations and explanations. We never store or share your code. Enterprise plans include enhanced data privacy guarantees.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No lock-ins, no cancellation fees. Cancel anytime from your dashboard and your subscription ends at the end of the billing period.'
  }
];

const faqGrid = document.getElementById('faq-grid');
if (faqGrid) {
  faqGrid.innerHTML = faqs.map((faq, i) => `
    <div class="accordion-item reveal${i % 2 !== 0 ? ' delay-100' : ''}" id="faq-${i}">
      <button class="accordion-trigger" aria-expanded="false" aria-controls="faq-body-${i}" id="faq-btn-${i}">
        <span>${faq.q}</span>
        <div class="accordion-icon">+</div>
      </button>
      <div class="accordion-content" id="faq-body-${i}" role="region" aria-labelledby="faq-btn-${i}">
        <div class="accordion-body">${faq.a}</div>
      </div>
    </div>
  `).join('');

  // After rendering, observe new reveal elements
  document.querySelectorAll('.accordion-item.reveal').forEach(el => revealObserver.observe(el));

  faqGrid.addEventListener('click', e => {
    const trigger = e.target.closest('.accordion-trigger');
    if (!trigger) return;
    const item = trigger.closest('.accordion-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.accordion-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
    trigger.setAttribute('aria-expanded', !isOpen);
  });
}

// ══════════════════════════════════════════════
// Keyboard shortcut — ⌘K command palette hint
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    // Redirect to workspace for full cmd palette experience
    window.location.href = 'workspace.html';
  }
});

// ══════════════════════════════════════════════
// Smooth active nav link highlight on scroll
// ══════════════════════════════════════════════
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(link => {
        link.style.color = '';
        if (link.getAttribute('href') === '#' + entry.target.id) {
          link.style.color = 'var(--text-primary)';
        }
      });
    }
  });
}, { threshold: 0.3 });
sections.forEach(s => sectionObserver.observe(s));

console.log('%c CodeLens 🔭 ', 'background:#7c6ee8;color:#fff;font-size:16px;font-weight:bold;padding:8px 16px;border-radius:6px');
console.log('%c See your code think. ', 'color:#9d8ff0;font-size:13px');
