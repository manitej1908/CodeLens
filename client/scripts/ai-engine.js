/* ============================================================
   CODELENS — AI Engine v2
   Context-aware, structured, educational AI responses
   No fake placeholders. Every response uses real code context.
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────────
function initToastContainer() {
  if (document.getElementById('toast-container')) return;
  const c = document.createElement('div');
  c.id = 'toast-container';
  document.body.appendChild(c);
}

function showToast(msg, type = 'info', duration = 3500) {
  initToastContainer();
  const icons = { success: '✓', error: '✗', info: '◈', warn: '⚠' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '◈'}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ─────────────────────────────────────────────────────────
// RIPPLE SYSTEM
// ─────────────────────────────────────────────────────────
function addRipple(btn) {
  btn.addEventListener('click', function(e) {
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top  - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}

function initRipples() {
  document.querySelectorAll('.btn').forEach(addRipple);
}

// ─────────────────────────────────────────────────────────
// CONTEXT-AWARE AI ENGINE
// ─────────────────────────────────────────────────────────

/**
 * Main AI response generator — uses code analysis + question intent
 * Returns a structured HTML response string
 */
function generateAIResponse(userQuestion, file, analysis, aiMode, conversationHistory) {
  if (!userQuestion.trim()) return '';

  const q   = userQuestion.toLowerCase().trim();
  const code = file?.content || '';
  const lang = file?.lang || 'Unknown';
  const fname = file?.name || 'your code';

  // ── Detect question intent ─────────────────────────────
  const intent = detectIntent(q);

  // ── Build context-sensitive answer ────────────────────
  let answer = '';

  if (intent === 'complexity') {
    answer = buildComplexityAnswer(q, analysis, aiMode);
  } else if (intent === 'recursion') {
    answer = buildRecursionAnswer(q, analysis, code, aiMode);
  } else if (intent === 'loop') {
    answer = buildLoopAnswer(q, analysis, code, aiMode);
  } else if (intent === 'function') {
    answer = buildFunctionAnswer(q, analysis, code, aiMode);
  } else if (intent === 'variable') {
    answer = buildVariableAnswer(q, analysis, code, aiMode);
  } else if (intent === 'array') {
    answer = buildArrayAnswer(q, analysis, code, aiMode);
  } else if (intent === 'error') {
    answer = buildErrorAnswer(q, analysis, code, aiMode);
  } else if (intent === 'optimize') {
    answer = buildOptimizeAnswer(q, analysis, code, aiMode);
  } else if (intent === 'explain') {
    answer = buildExplainAnswer(q, analysis, code, lang, fname, aiMode);
  } else if (intent === 'datastructure') {
    answer = buildDataStructureAnswer(q, analysis, code, aiMode);
  } else {
    answer = buildGeneralAnswer(q, analysis, code, lang, fname, aiMode, conversationHistory);
  }

  return wrapWithModeHeader(answer, aiMode, conversationHistory.length);
}

// ── Intent detection ───────────────────────────────────
function detectIntent(q) {
  if (/complex|big.?o|o\(n|time.complex|space.complex|efficien/.test(q)) return 'complexity';
  if (/recur|recursive|base.?case|stack.?overflow|fibonacci/.test(q)) return 'recursion';
  if (/loop|for\s|while|itera|traverse/.test(q)) return 'loop';
  if (/function|method|def\s|call|return|param/.test(q)) return 'function';
  if (/variable|var\s|let\s|const\s|assign|value/.test(q)) return 'variable';
  if (/array|list|index|\[\s*\]|vector|element/.test(q)) return 'array';
  if (/error|bug|wrong|broken|fix|debug|crash|exception/.test(q)) return 'error';
  if (/optimiz|improv|faster|better|refactor|clean/.test(q)) return 'optimize';
  if (/explain|what.does|how.does|what.is|describe|tell.me/.test(q)) return 'explain';
  if (/tree|stack|queue|linked.list|graph|heap|hash|pointer/.test(q)) return 'datastructure';
  return 'general';
}

// ── Complexity answer ──────────────────────────────────
function buildComplexityAnswer(q, a, mode) {
  const t = a.complexity.time;
  const s = a.complexity.space;

  const whyTime = t === 'O(2ⁿ)' ? `
    Exponential time because of recursion with overlapping subproblems and ${a.loops.length} nested loops. 
    Each recursive call branches into multiple sub-calls, doubling work at each level.` :
    t === 'O(n²)' ? `
    Quadratic time because of ${a.loops.length} nested loop${a.loops.length > 1 ? 's' : ''}.
    For every element (outer loop), we iterate through all elements again (inner loop) — n × n = n² operations.` :
    t === 'O(n)' ? `
    Linear time because we traverse the data exactly once. Each element is processed in constant time inside the loop.` :
    `Constant time — no loops or recursion. The program executes the same number of operations regardless of input size.`;

  const modeAddition = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Think about this:</strong> If n=1000, ${t} means roughly ${
      t === 'O(n²)' ? '1,000,000' : t === 'O(n)' ? '1,000' : '1'
    } operations. How does this scale to n=1,000,000? Would your solution still be practical?</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Simple explanation:</strong> Think of n as the size of your list. ${
      t === 'O(n²)' ? 'O(n²) means if you double your list, the work becomes 4× harder. Like comparing every student with every other student in a class.' :
      t === 'O(n)' ? 'O(n) is great! Work grows proportionally — double the list, double the work. Like reading a book cover to cover.' :
      'O(1) is perfect! Work stays constant no matter how big your input is.'
    }</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview angle:</strong> State it precisely: "${t} time, ${s} space." Then explain your reasoning. Expect follow-up: "Can you do better?" ${
      t === 'O(n²)' ? 'Hint: often O(n log n) is achievable with sorting/divide-and-conquer.' :
      t === 'O(2ⁿ)' ? 'Hint: memoization or dynamic programming can reduce to O(n²) or O(n).' :
      'You\'re already at near-optimal. Explain why O(n) is a theoretical lower bound here.'
    }</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">⚡ Complexity Analysis</div>
      <div class="ai-block-text">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="background:var(--bg-overlay);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">TIME</div>
            <div style="font-family:var(--font-mono);font-weight:800;font-size:18px;color:${t.includes('2ⁿ') ? 'var(--accent-rose)' : t.includes('n²') ? 'var(--accent-amber)' : 'var(--accent-emerald)'}">${t}</div>
          </div>
          <div style="background:var(--bg-overlay);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">SPACE</div>
            <div style="font-family:var(--font-mono);font-weight:800;font-size:18px;color:${s === 'O(1)' ? 'var(--accent-emerald)' : 'var(--accent-amber)'}">${s}</div>
          </div>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.7">${whyTime}</p>
        ${a.loops.length ? `<p style="margin-top:8px;font-size:12px;color:var(--text-muted)">Detected ${a.loops.length} loop${a.loops.length > 1 ? 's' : ''} at lines: ${a.loops.map(l => l.line).join(', ')}</p>` : ''}
      </div>
    </div>
    ${modeAddition}`;
}

// ── Recursion answer ───────────────────────────────────
function buildRecursionAnswer(q, a, code, mode) {
  const hasRecursion = a.recursion;
  const fns = a.functions.map(f => f.name).join(', ') || 'none detected';

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Mentor challenge:</strong> Before I explain — can you identify which function is recursive? What is its base case? What happens if the base case is missing?</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Beginner tip:</strong> Recursion is when a function calls itself. Think of Russian nesting dolls — each doll opens to reveal a smaller one. The smallest doll (base case) stops the opening!</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview prep:</strong> Always state: (1) base case, (2) recursive step, (3) time complexity, (4) space complexity (call stack depth). Interviewers expect all four.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">🔄 Recursion Analysis</div>
      <div class="ai-block-text">
        ${hasRecursion ? `
          <p style="color:var(--accent-amber);font-size:13px;font-weight:600;margin-bottom:8px">⚠ Recursion detected in this code</p>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.7">
            The function(s) <code style="background:var(--bg-overlay);padding:1px 6px;border-radius:3px;font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan)">${fns}</code> 
            call themselves. This creates a call stack — each call adds a new frame until the base case is reached.
          </p>
          <ul style="list-style:disc;padding-left:16px;margin-top:10px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--text-secondary)">
            <li>Every recursive function needs a <strong style="color:var(--accent-emerald)">base case</strong> (stopping condition)</li>
            <li>Every recursive function needs a <strong style="color:var(--accent-primary)">recursive step</strong> (moves toward base case)</li>
            <li>Current time complexity: <strong style="color:var(--accent-rose);font-family:var(--font-mono)">${a.complexity.time}</strong></li>
            <li>Stack space: <strong style="color:var(--accent-amber);font-family:var(--font-mono)">${a.complexity.space}</strong> (proportional to recursion depth)</li>
          </ul>
          <div style="margin-top:12px;padding:10px;background:rgba(244,63,94,0.07);border:1px solid rgba(244,63,94,0.2);border-radius:8px;font-size:12px;color:var(--text-secondary)">
            ⚠ <strong>Risk:</strong> Deep recursion can cause stack overflow. Consider memoization or converting to iteration for large inputs.
          </div>
        ` : `
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.7">
            No recursion detected in this code. Functions found: <code style="background:var(--bg-overlay);padding:1px 6px;border-radius:3px;font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan)">${fns}</code>
          </p>
          <p style="margin-top:8px;font-size:13px;color:var(--text-secondary);line-height:1.7">
            This code uses iteration (loops) instead. Iterative solutions typically use <strong style="color:var(--accent-emerald)">O(1) stack space</strong> vs recursive <strong style="color:var(--accent-amber)">O(n) stack space</strong>.
          </p>
        `}
      </div>
    </div>
    ${modeText}`;
}

// ── Loop answer ────────────────────────────────────────
function buildLoopAnswer(q, a, code, mode) {
  const loops = a.loops;

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Think about this:</strong> What is the loop invariant — the property that stays true at the start of every iteration? Can you state it clearly?</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Simple explanation:</strong> Loops are instructions that repeat. The loop runs as long as the condition is true, like saying "keep stirring until the sauce thickens." Off-by-one errors are the #1 bug — always check your start and end values!</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview prep:</strong> Identify the loop's contribution to time complexity. State the invariant. Mention potential edge cases: n=0, n=1, already sorted input.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">🔁 Loop Analysis</div>
      <div class="ai-block-text">
        ${loops.length ? `
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Found <strong style="color:var(--accent-primary)">${loops.length}</strong> loop${loops.length > 1 ? 's' : ''} in your code:</p>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${loops.map((l, i) => `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:var(--bg-overlay);border-radius:6px;border:1px solid var(--border-subtle)">
                <span style="font-family:var(--font-mono);font-size:11px;color:var(--accent-amber);font-weight:700">${i === 0 ? 'OUTER' : i === 1 ? 'INNER' : 'LOOP ' + (i+1)}</span>
                <span style="font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan);font-weight:700">${l.type}</span>
                <span style="font-size:11px;color:var(--text-muted)">line ${l.line}</span>
                ${i > 0 ? `<span class="chip" style="font-size:10px;color:var(--accent-rose);border-color:rgba(244,63,94,0.3);background:rgba(244,63,94,0.08);margin-left:auto">Nested O(n²)</span>` : ''}
              </div>`).join('')}
          </div>
          <div style="margin-top:12px;font-size:13px;color:var(--text-secondary);line-height:1.7">
            ${loops.length >= 2 ? '<strong style="color:var(--accent-amber)">Nested loops</strong> found — this is the most common source of O(n²) complexity. Consider if the inner loop can be replaced with a hash map lookup (O(1)) to achieve O(n) overall.' :
            'Single loop — contributes <strong style="color:var(--accent-emerald)">O(n)</strong> time complexity. Clean and efficient.'}
          </div>
        ` : '<p style="font-size:13px;color:var(--text-secondary)">No loops detected. This code runs in O(1) constant time.</p>'}
      </div>
    </div>
    ${modeText}`;
}

// ── Function answer ────────────────────────────────────
function buildFunctionAnswer(q, a, code, mode) {
  const fns = a.functions;

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Mentor question:</strong> What does each function's return type communicate? A function that returns nothing (void/None) has a different responsibility than one that returns a value. Which pattern do you see here?</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Beginner tip:</strong> Functions are mini-programs that take inputs (parameters) and return outputs. Like a coffee machine: you put in coffee beans and water (inputs), it returns coffee (output). Functions should do ONE thing and do it well!</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview prep:</strong> A well-designed function has: (1) single responsibility, (2) clear naming, (3) minimal parameters, (4) documented edge cases. Evaluate each function in this code against these criteria.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">🧩 Function Analysis</div>
      <div class="ai-block-text">
        ${fns.length ? `
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">Found <strong style="color:var(--accent-primary)">${fns.length}</strong> function${fns.length > 1 ? 's' : ''}:</p>
          <div style="display:flex;flex-direction:column;gap:5px">
            ${fns.map(f => `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-overlay);border-radius:6px;border:1px solid var(--border-subtle)">
                <span style="font-family:var(--font-mono);font-size:13px;color:var(--accent-blue);font-weight:700">${f.name}()</span>
                <span style="font-size:11px;color:var(--text-muted)">defined at line ${f.line}</span>
                ${a.recursion && code.includes(f.name + '(') ? '<span class="chip" style="font-size:10px;color:var(--accent-amber);border-color:rgba(245,158,11,0.3);background:rgba(245,158,11,0.08);margin-left:auto">recursive</span>' : ''}
              </div>`).join('')}
          </div>
          ${a.recursion ? `
            <p style="margin-top:10px;font-size:13px;color:var(--accent-amber)">⚠ At least one function appears to call itself recursively.</p>
          ` : ''}
        ` : `
          <p style="font-size:13px;color:var(--text-secondary)">No named functions detected. Code appears to be procedural/inline. Consider decomposing into named functions for readability and reuse.</p>
        `}
      </div>
    </div>
    ${modeText}`;
}

// ── Variable answer ────────────────────────────────────
function buildVariableAnswer(q, a, code, mode) {
  const vars = a.variables.filter((v, i, arr) => arr.findIndex(x => x.name === v.name) === i).slice(0, 10);

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Mentor question:</strong> For each variable, can you state: (1) what it represents semantically, (2) its value range, (3) what happens if it's 0, negative, or null?</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Beginner tip:</strong> Variables are named storage boxes. When you write <code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px">x = 5</code>, you're putting the number 5 in a box called "x". You can look in the box (read) or change what's inside (write) at any time.</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview prep:</strong> Variable naming matters. Reviewers judge code quality by variable names. Replace single letters (except loop counters i/j) with descriptive names like <code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px">maxLength</code>, <code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px">currentNode</code>.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">📋 Variable Analysis (${vars.length} detected)</div>
      <div class="ai-block-text">
        ${vars.length ? `
          <table class="var-table">
            <thead><tr><th>Name</th><th>Type</th><th>Initial Value</th><th>Line</th></tr></thead>
            <tbody>${vars.map(v => `
              <tr>
                <td><span class="var-name">${v.name}</span></td>
                <td><span class="var-type-badge">${inferTypeFromValue(v.value)}</span></td>
                <td style="font-family:var(--font-mono);color:var(--accent-cyan);font-size:11px">${escHtmlAI((v.value || '—').substring(0, 24))}</td>
                <td style="color:var(--text-muted)">${v.line}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        ` : '<p style="font-size:13px;color:var(--text-secondary)">No variable declarations detected.</p>'}
      </div>
    </div>
    ${modeText}`;
}

// ── Array answer ───────────────────────────────────────
function buildArrayAnswer(q, a, code, mode) {
  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Challenge:</strong> Arrays have O(1) access by index but O(n) search. When would you use an array vs a hash map? Trace through an example with your actual data.</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Simple explanation:</strong> An array is like a numbered row of lockers. Locker 0 has the first item, locker 1 has the second, etc. You can jump to any locker instantly (O(1)), but finding a specific item means checking each locker (O(n)).</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview focus:</strong> Know your array operations: access O(1), search O(n), insert/delete O(n). Interviewers often ask: "How would you make this O(n log n) with sorting?" or "Can a hash map replace this array search?"</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">📊 Array/Collection Analysis</div>
      <div class="ai-block-text">
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:10px">
          ${a.hasArrays ? 'Arrays/collections detected in this code.' : 'No arrays detected — this code appears to work with scalar values.'}
        </p>
        ${a.hasArrays ? `
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg-overlay);border-radius:6px;font-size:12px">
              <span style="color:var(--text-muted)">Access by index</span>
              <span style="color:var(--accent-emerald);font-family:var(--font-mono);font-weight:700">O(1)</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg-overlay);border-radius:6px;font-size:12px">
              <span style="color:var(--text-muted)">Linear search</span>
              <span style="color:var(--accent-amber);font-family:var(--font-mono);font-weight:700">O(n)</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg-overlay);border-radius:6px;font-size:12px">
              <span style="color:var(--text-muted)">Space used</span>
              <span style="color:var(--accent-primary);font-family:var(--font-mono);font-weight:700">${a.complexity.space}</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
    ${modeText}`;
}

// ── Error answer ───────────────────────────────────────
function buildErrorAnswer(q, a, code, mode) {
  const commonErrors = [];
  if (a.loops.length >= 2) commonErrors.push({ type: 'Off-by-one error', desc: 'Check nested loop bounds — a common source of index-out-of-bounds.', severity: 'warn' });
  if (a.recursion) commonErrors.push({ type: 'Missing base case', desc: 'Recursive function may overflow stack if base case is missing or unreachable.', severity: 'error' });
  if (a.hasArrays) commonErrors.push({ type: 'Index out of bounds', desc: 'Array access without bounds check will throw at runtime.', severity: 'warn' });
  if (!a.functions.length && a.lineCount > 15) commonErrors.push({ type: 'No decomposition', desc: 'Long procedural code is harder to debug. Extract into named functions.', severity: 'info' });
  commonErrors.push({ type: 'Unhandled edge cases', desc: 'Empty input, null values, negative numbers, single element — always test these.', severity: 'warn' });

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Debugging mindset:</strong> Before fixing a bug, understand WHY it happens. Write a failing test case that reproduces it. Then fix. Then verify the test passes.</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Debugging tip:</strong> Add print statements to see what's happening step by step. Print your variables before and after each key operation. The bug is almost always where you expect it least!</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview process:</strong> Debug out loud. Say "Let me trace through with input [1,2,3]..." Interviewers value your debugging process as much as the solution.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block" style="border-color:rgba(244,63,94,0.2)">
      <div class="ai-block-label" style="color:var(--accent-rose)">🐛 Potential Issues</div>
      <div class="ai-block-text">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${commonErrors.map(e => `
            <div style="padding:10px 12px;background:${e.severity === 'error' ? 'rgba(244,63,94,0.07)' : e.severity === 'warn' ? 'rgba(245,158,11,0.06)' : 'rgba(124,110,232,0.06)'};border:1px solid ${e.severity === 'error' ? 'rgba(244,63,94,0.25)' : e.severity === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(124,110,232,0.2)'};border-radius:8px">
              <div style="font-size:12px;font-weight:700;color:${e.severity === 'error' ? 'var(--accent-rose)' : e.severity === 'warn' ? 'var(--accent-amber)' : 'var(--accent-primary)'};margin-bottom:4px">${e.type}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${e.desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    ${modeText}`;
}

// ── Optimize answer ────────────────────────────────────
function buildOptimizeAnswer(q, a, code, mode) {
  const suggestions = [];
  if (a.complexity.time === 'O(n²)') suggestions.push({ title: 'Reduce to O(n log n)', desc: 'Sort-based approach or divide-and-conquer can often eliminate one nested loop.' });
  if (a.complexity.time === 'O(2ⁿ)') suggestions.push({ title: 'Memoize recursive calls', desc: 'Cache subproblem results in a hash map. Transforms O(2ⁿ) → O(n) time with O(n) space.' });
  if (a.hasArrays && a.loops.length >= 2) suggestions.push({ title: 'Use a hash map for O(1) lookup', desc: 'Replace inner loop search with a hash map. Common pattern for Two Sum and similar problems.' });
  if (!a.functions.length && a.lineCount > 10) suggestions.push({ title: 'Extract helper functions', desc: 'Decompose into small, named functions. Improves readability, testability, and reuse.' });
  if (a.recursion) suggestions.push({ title: 'Consider iterative approach', desc: 'Iteration avoids stack overflow risk and often uses less memory than recursion.' });
  suggestions.push({ title: 'Add input validation', desc: 'Guard against null, empty, or invalid inputs at the start of each function.' });

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Challenge:</strong> Pick one optimization from the list. Implement it, then measure: does the time/space complexity actually improve? Write a benchmark or trace through.</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Start here:</strong> First make it work, then make it readable, then make it fast — in that order. Don't optimize prematurely. Understanding is more important than speed at this stage!</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview strategy:</strong> Present the brute-force solution first, then propose optimizations. Interviewers want to see your thinking process, not just the optimal answer.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block" style="border-color:rgba(16,185,129,0.2)">
      <div class="ai-block-label" style="color:var(--accent-emerald)">💡 Optimization Suggestions</div>
      <div class="ai-block-text">
        <div style="display:flex;flex-direction:column;gap:8px">
          ${suggestions.map((s, i) => `
            <div style="padding:10px 12px;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.15);border-radius:8px">
              <div style="font-size:12px;font-weight:700;color:var(--accent-emerald);margin-bottom:4px">${i + 1}. ${s.title}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${s.desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    ${modeText}`;
}

// ── Explain answer ─────────────────────────────────────
function buildExplainAnswer(q, a, code, lang, fname, mode) {
  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Before I explain:</strong> What do you think this code does? Take 30 seconds to trace through it with a simple input like [3, 1, 2]. Your guess first — then compare with my explanation.</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Plain English first:</strong> Don't worry about the syntax — focus on what the code accomplishes. What problem does it solve? What goes in? What comes out?</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview format:</strong> When asked to explain code, structure your answer: (1) High-level purpose, (2) Key algorithm/data structure, (3) Time complexity, (4) Edge cases.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">📋 Code Explanation</div>
      <div class="ai-block-text">
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:12px">
          <strong style="color:var(--text-primary)">${fname}</strong> — ${lang} · ${a.lineCount} lines
        </p>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${a.functions.length ? `<div style="padding:8px 12px;background:var(--bg-overlay);border-radius:6px;font-size:13px;color:var(--text-secondary)">
            🧩 <strong style="color:var(--text-primary)">Functions:</strong> ${a.functions.map(f => `<code style="background:var(--bg-elevated);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px;color:var(--accent-cyan)">${f.name}()</code>`).join(' ')}
          </div>` : ''}
          ${a.loops.length ? `<div style="padding:8px 12px;background:var(--bg-overlay);border-radius:6px;font-size:13px;color:var(--text-secondary)">
            🔁 <strong style="color:var(--text-primary)">Loops:</strong> ${a.loops.length} ${a.loops.map(l => l.type).join(', ')} loop${a.loops.length > 1 ? 's' : ''} — contributes <strong style="color:var(--accent-amber);font-family:var(--font-mono)">${a.complexity.time}</strong>
          </div>` : ''}
          ${a.recursion ? `<div style="padding:8px 12px;background:rgba(245,158,11,0.07);border-radius:6px;border:1px solid rgba(245,158,11,0.2);font-size:13px;color:var(--text-secondary)">
            🔄 <strong style="color:var(--accent-amber)">Recursion detected</strong> — self-calling function
          </div>` : ''}
          ${a.hasArrays ? `<div style="padding:8px 12px;background:var(--bg-overlay);border-radius:6px;font-size:13px;color:var(--text-secondary)">
            📊 <strong style="color:var(--text-primary)">Collections:</strong> Arrays/lists used — space complexity <strong style="color:var(--accent-primary);font-family:var(--font-mono)">${a.complexity.space}</strong>
          </div>` : ''}
          <div style="padding:8px 12px;background:var(--bg-overlay);border-radius:6px;font-size:13px;color:var(--text-secondary)">
            ⚡ <strong style="color:var(--text-primary)">Complexity:</strong> Time <strong style="color:var(--accent-primary);font-family:var(--font-mono)">${a.complexity.time}</strong> · Space <strong style="color:var(--accent-primary);font-family:var(--font-mono)">${a.complexity.space}</strong>
          </div>
        </div>
      </div>
    </div>
    ${modeText}`;
}

// ── Data structure answer ──────────────────────────────
function buildDataStructureAnswer(q, a, code, mode) {
  const ds = [];
  if (/tree|binary.tree|bst/.test(q)) ds.push({ name: 'Binary Tree', ops: 'insert O(log n), search O(log n), traversal O(n)', desc: 'Hierarchical structure. Each node has at most 2 children. BST property: left < root < right.' });
  if (/stack/.test(q)) ds.push({ name: 'Stack', ops: 'push O(1), pop O(1), peek O(1)', desc: 'LIFO — last in, first out. Used for recursion simulation, undo operations, expression parsing.' });
  if (/queue/.test(q)) ds.push({ name: 'Queue', ops: 'enqueue O(1), dequeue O(1), peek O(1)', desc: 'FIFO — first in, first out. Used for BFS, task scheduling, print queues.' });
  if (/linked.list|linked list/.test(q)) ds.push({ name: 'Linked List', ops: 'insert O(1) at head, search O(n), delete O(n)', desc: 'Nodes linked by pointers. Dynamic size. No random access — must traverse from head.' });
  if (/graph/.test(q)) ds.push({ name: 'Graph', ops: 'BFS/DFS O(V+E), shortest path O(V log V) with Dijkstra', desc: 'Nodes (vertices) connected by edges. Used for networks, paths, dependencies.' });
  if (/hash|dict|map/.test(q)) ds.push({ name: 'Hash Map', ops: 'insert O(1) avg, lookup O(1) avg, delete O(1) avg', desc: 'Key-value storage with O(1) average operations. O(n) worst case on collision.' });
  if (!ds.length) ds.push({ name: 'Array (detected)', ops: 'access O(1), search O(n), insert/delete O(n)', desc: 'Contiguous memory. O(1) random access by index. Common choice for sorting problems.' });

  const modeText = {
    mentor: `<div class="ai-mentor-prompt">💭 <strong>Selection challenge:</strong> Given your problem's operations (what do you do most — search? insert? traverse?), which data structure has the best complexity for your use case?</div>`,
    beginner: `<div class="ai-mentor-prompt">🌱 <strong>Choose by use case:</strong> Need fast lookup? Use hash map. Need ordered data? Use sorted array or BST. Need LIFO? Use stack. Need FIFO? Use queue. The right choice makes everything easier!</div>`,
    interview: `<div class="ai-mentor-prompt">🎯 <strong>Interview tip:</strong> Always justify your data structure choice with complexity analysis. "I chose a hash map because lookups are O(1) average, vs O(log n) for a BST" shows you understand the tradeoffs.</div>`,
  }[mode] || '';

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">🗂 Data Structure Reference</div>
      <div class="ai-block-text">
        ${ds.map(d => `
          <div style="margin-bottom:12px;padding:12px;background:var(--bg-overlay);border-radius:8px;border:1px solid var(--border-subtle)">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:4px">${d.name}</div>
            <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent-cyan);margin-bottom:6px">${d.ops}</div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.6">${d.desc}</div>
          </div>`).join('')}
      </div>
    </div>
    ${modeText}`;
}

// ── General / fallback answer ──────────────────────────
function buildGeneralAnswer(q, a, code, lang, fname, mode, history) {
  const turnCount = history.length;

  const progressRemarks = [
    `Looking at <strong style="color:var(--text-primary)">${fname}</strong> — `,
    `Building on our last point — `,
    `Great question! Going deeper into ${fname} — `,
    `You're asking exactly the right questions. `,
    `This connects to something important — `,
  ];
  const opener = progressRemarks[Math.min(Math.floor(turnCount / 2), progressRemarks.length - 1)];

  const codeInsight = a.functions.length > 0
    ? `this code defines <strong style="color:var(--accent-primary)">${a.functions.map(f => `<code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:11px">${f.name}()</code>`).join(', ')}</strong>`
    : a.loops.length > 0
    ? `this code uses <strong style="color:var(--accent-primary)">${a.loops.length} loop${a.loops.length > 1 ? 's' : ''}</strong> to process data`
    : `this is a <strong style="color:var(--accent-primary)">${lang}</strong> program with ${a.lineCount} lines`;

  const followUpMap = {
    mentor: [
      `Before I answer directly — what's your current understanding? Even a rough guess is a great starting point.`,
      `Interesting angle! ${opener}${codeInsight}. What do you think is the most important line of this code?`,
      `You're developing great intuition. Consider: what would happen if you changed the condition on line ${a.loops[0]?.line || a.conditions[0]?.line || 1}?`,
    ],
    beginner: [
      `Great question! Let me explain in plain terms. ${opener}${codeInsight}. The most important thing to understand here is how the data flows through the program.`,
      `No worries at all! ${opener}${codeInsight}. Let's trace through it step by step with a simple example first.`,
      `You're making excellent progress! ${opener}let me break this down into even simpler pieces.`,
    ],
    interview: [
      `Good question — in an interview context, ${opener}${codeInsight}. State your assumptions first: input constraints, expected output, edge cases.`,
      `Correct instinct! ${opener}${codeInsight}. Now quantify it: time complexity is ${a.complexity.time}, space is ${a.complexity.space}.`,
      `Solid thinking! ${opener}ask yourself: what's the bottleneck? Where does this code spend the most time?`,
    ],
  };

  const pool = followUpMap[mode] || followUpMap.mentor;
  const reply = pool[turnCount % pool.length];

  return `
    <div class="ai-explanation-block">
      <div class="ai-block-label">🔭 AI Mentor Response</div>
      <div class="ai-block-text" style="font-size:13px;line-height:1.8">
        ${reply}
      </div>
    </div>
    <div class="ai-explanation-block" style="border-color:rgba(124,110,232,0.2)">
      <div class="ai-block-label" style="color:var(--text-muted)">📍 Code Context</div>
      <div class="ai-block-text" style="display:flex;flex-wrap:wrap;gap:6px">
        <span class="chip">${lang}</span>
        <span class="chip">${a.lineCount} lines</span>
        <span class="chip" style="color:var(--accent-primary);font-family:var(--font-mono)">${a.complexity.time}</span>
        ${a.functions.length ? `<span class="chip">${a.functions.length} function${a.functions.length > 1 ? 's' : ''}</span>` : ''}
        ${a.loops.length ? `<span class="chip">${a.loops.length} loop${a.loops.length > 1 ? 's' : ''}</span>` : ''}
        ${a.recursion ? '<span class="chip" style="color:var(--accent-amber)">recursive</span>' : ''}
      </div>
    </div>`;
}

// ── Wrap with mode header ──────────────────────────────
function wrapWithModeHeader(answer, mode, turnCount) {
  if (turnCount === 0) {
    const headers = {
      mentor: `<div class="ai-mode-note mentor-note">🧑‍🏫 <strong>Mentor Mode:</strong> I'll guide your thinking with questions and hints. I won't just give you answers — I'll help you discover them.</div>`,
      beginner: `<div class="ai-mode-note beginner-note">🌱 <strong>Beginner Mode:</strong> Everything explained in plain English. No jargon, no rush. Every question is a great question.</div>`,
      interview: `<div class="ai-mode-note interview-note">🎯 <strong>Interview Mode:</strong> Evaluating like a FAANG interviewer. Be precise, justify complexity, think about edge cases.</div>`,
    };
    return (headers[mode] || '') + answer;
  }
  return answer;
}

// ── Helpers ─────────────────────────────────────────────
function escHtmlAI(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function inferTypeFromValue(val) {
  if (!val) return 'auto';
  if (/^-?\d+$/.test(val)) return 'int';
  if (/^-?\d+\.\d+$/.test(val)) return 'float';
  if (/^["']/.test(val)) return 'str';
  if (/^\[/.test(val)) return 'list';
  if (/^\{/.test(val)) return 'dict';
  if (val === 'True' || val === 'False' || val === 'true' || val === 'false') return 'bool';
  if (/^null|None|nullptr/.test(val)) return 'null';
  return 'auto';
}

// ─────────────────────────────────────────────────────────
// GROQ MENTOR — real conversational AI via /api/mentor
// ─────────────────────────────────────────────────────────

/**
 * Send a message to the Groq-powered mentor endpoint.
 * Falls back to local generateAIResponse if server is unavailable.
 *
 * @param {string} question
 * @param {object|null} file  — { name, content, lang, monacoLang }
 * @param {object} analysis   — deepAnalyze result
 * @param {string} aiMode     — 'mentor' | 'beginner' | 'interview'
 * @param {Array}  history    — [{ role, content }]
 * @returns {Promise<string>} HTML string for mentor bubble
 */
async function sendMentorMessage(question, file, analysis, aiMode, history) {
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  try {
    const res = await fetch(`${API_BASE}/api/mentor`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        code:                file?.content || '',
        language:            file?.monacoLang || 'unknown',
        question,
        conversationHistory: history,
        aiMode,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.missingKey) {
        return `<div style="color:var(--accent-rose);font-size:13px;">⚠ Groq API key not set. Add GROQ_API_KEY to .env and restart the server.</div>`;
      }
      // Fall through to local
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.reply || '';

    // Convert plain text + code backticks to HTML
    return formatMentorReply(reply);

  } catch (err) {
    // Server unavailable → use local AI engine
    console.warn('[CodeLens] Mentor API unavailable, using local engine:', err.message);
    return generateAIResponse(question, file, analysis, aiMode, history);
  }
}

/**
 * Format a plain-text Groq reply to safe HTML.
 * Handles `code` backticks and newlines.
 */
function formatMentorReply(text) {
  // Escape HTML first
  let safe = escHtmlAI(text);

  // Convert ```lang ... ``` code blocks to <pre><code>
  safe = safe.replace(/```(\w*)\s*([\s\S]*?)```/g, (_, lang, code) =>
    `<pre style="background:var(--bg-overlay);border:1px solid var(--border-subtle);border-radius:6px;padding:10px 12px;margin:8px 0;overflow-x:auto;font-family:var(--font-mono);font-size:12px;color:var(--text-primary);white-space:pre-wrap">${code.trim()}</pre>`
  );

  // Convert `inline code` to <code>
  safe = safe.replace(/`([^`]+)`/g,
    `<code style="background:var(--bg-overlay);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:12px;color:var(--accent-cyan)">$1</code>`
  );

  // Convert **bold**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert newlines to <br>
  safe = safe.replace(/\n/g, '<br>');

  return safe;
}

// ─────────────────────────────────────────────────────────
// EXPORTS (attached to window for workspace.js)
// ─────────────────────────────────────────────────────────
window.AIEngine = {
  generateAIResponse,
  sendMentorMessage,
  formatMentorReply,
  showToast,
  initRipples,
  inferTypeFromValue,
  escHtmlAI,
};
