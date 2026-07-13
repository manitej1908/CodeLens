/* ============================================================
   CODELENS — Visualization Engine v2
   Intelligent, animated, multi-structure visualizations.
   Supports: Arrays, Linked Lists, Binary Trees, Call Stack,
             Memory, Variables Panel, Execution Timeline
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────────────────
// VISUALIZATION ENGINE
// ─────────────────────────────────────────────────────────
class VisualizationEngine {

  constructor(containerEl) {
    this.container = containerEl;
    this.animQueue = [];
    this.animTimer = null;
    this.speed = 600;
    this.paused = false;
  }

  // ── Entry point ──────────────────────────────────────
  /**
   * Analyze code and render appropriate visualization
   * @param {object} file - { name, lang, content }
   * @param {object} analysis - Code analysis result from codeAnalyzer
   * @param {object} execState - { stepIdx, steps } current execution state
   */
  render(file, analysis, execState) {
    this.container.innerHTML = '';
    this.container.style.setProperty('--panel-fade', 'none');

    const lang = file.lang || 'text';
    const code = file.content || '';

    // Determine what to visualize based on code analysis
    const sections = [];

    // 1. Live Variables panel (always shown if there are vars)
    if (analysis.variables.length) {
      sections.push(this._renderVariablesSection(analysis, execState));
    }

    // 2. Array visualization (if arrays detected)
    if (analysis.hasArrays) {
      sections.push(this._renderArraySection(analysis, execState));
    }

    // 3. Call Stack (if functions detected)
    if (analysis.functions.length || analysis.recursion) {
      sections.push(this._renderCallStackSection(analysis, execState));
    }

    // 4. Linked list (if detected)
    if (this._detectLinkedList(code, lang)) {
      sections.push(this._renderLinkedListSection(analysis, code));
    }

    // 5. Binary tree (if detected)
    if (this._detectBinaryTree(code, lang)) {
      sections.push(this._renderBinaryTreeSection(analysis, code));
    }

    // 6. Memory view
    sections.push(this._renderMemorySection(analysis, execState));

    // 7. Execution flow (always shown)
    sections.push(this._renderFlowSection(analysis, execState));

    if (!sections.length) {
      this.container.innerHTML = this._emptyState();
      return;
    }

    sections.forEach(s => this.container.appendChild(s));
  }

  // ── 1. Variables Panel ───────────────────────────────
  _renderVariablesSection(analysis, execState) {
    const el = this._makePanel('📋 Live Variables', 'vars-panel');
    const idx = execState?.stepIdx ?? 0;
    const step = execState?.steps?.[idx];

    const vars = analysis.variables
      .filter((v, i, arr) => arr.findIndex(x => x.name === v.name) === i)
      .slice(0, 12);

    if (!vars.length) {
      el.querySelector('.viz-panel-body').innerHTML = `<p style="color:var(--text-muted);font-size:12px">No variables detected</p>`;
      return el;
    }

    const rows = vars.map(v => {
      const val = (step?.vars?.[v.name] !== undefined) ? step.vars[v.name] : (v.value || '—');
      const isChanged = step?.changed?.includes(v.name);
      return `
        <div class="var-live-row ${isChanged ? 'changed' : ''}" data-var="${v.name}" style="animation-delay:${vars.indexOf(v) * 40}ms">
          <span class="var-live-name">${v.name}</span>
          <span class="var-live-type">${this._inferType(val)}</span>
          <span class="var-live-val">${this._safeStr(val)}</span>
        </div>`;
    });

    el.querySelector('.viz-panel-body').innerHTML = `<div style="display:flex;flex-direction:column;gap:4px">${rows.join('')}</div>`;
    return el;
  }

  // ── 2. Array Visualization ───────────────────────────
  _renderArraySection(analysis, execState) {
    const el = this._makePanel('📊 Array Visualization', 'array-viz-panel');
    const idx = execState?.stepIdx ?? 0;
    const step = execState?.steps?.[idx];

    // Use step array state if available, otherwise generate demo
    const arr = step?.array ?? this._extractFirstArray(analysis) ?? [3, 1, 4, 1, 5, 9, 2, 6, 5, 3];
    const activeIndices = step?.activeIdx ?? [];
    const comparingIndices = step?.comparingIdx ?? [];
    const sortedIndices = step?.sortedIdx ?? [];

    const maxVal = Math.max(...arr, 1);

    const cells = arr.map((val, i) => {
      const cls = sortedIndices.includes(i) ? 'sorted' :
                  comparingIndices.includes(i) ? 'comparing' :
                  activeIndices.includes(i) ? 'active' : '';
      const h = Math.max(20, Math.round((val / maxVal) * 80));
      return `
        <div class="array-cell" style="animation:fade-up-sm 0.3s ${i * 30}ms var(--ease-spring) both">
          <div class="array-box ${cls}" style="height:${h}px;min-height:20px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:4px 0">
            <span style="font-size:11px;font-weight:700">${val}</span>
          </div>
          <div class="array-idx">${i}</div>
        </div>`;
    });

    el.querySelector('.viz-panel-body').innerHTML = `
      <div class="array-viz" style="align-items:flex-end;min-height:100px;gap:4px">${cells.join('')}</div>
      ${step ? `<div style="margin-top:8px;font-size:11px;color:var(--text-muted);text-align:center">Step ${idx + 1} — ${step.desc || ''}</div>` : ''}`;
    return el;
  }

  // ── 3. Call Stack ────────────────────────────────────
  _renderCallStackSection(analysis, execState) {
    const el = this._makePanel('📚 Call Stack', 'stack-viz-panel');
    const idx = execState?.stepIdx ?? 0;
    const step = execState?.steps?.[idx];

    const frames = step?.callStack ?? this._buildDemoStack(analysis, idx);

    if (!frames.length) {
      el.querySelector('.viz-panel-body').innerHTML = `<p style="color:var(--text-muted);font-size:12px">Stack is empty</p>`;
      return el;
    }

    const rows = frames.map((f, i) => `
      <div class="stack-frame ${i === frames.length - 1 ? 'active' : ''}" style="animation:slide-in-right 0.2s ${i * 50}ms var(--ease-spring) both">
        <div>
          <span class="stack-frame-name">${f.name}</span>
          ${f.params ? `<span style="color:var(--text-muted);font-size:11px">(${f.params})</span>` : ''}
        </div>
        <span class="stack-frame-line">L${f.line || '?'}</span>
        ${i === frames.length - 1 ? '<span style="font-size:9px;color:var(--accent-primary);font-weight:700;margin-left:4px">ACTIVE</span>' : ''}
      </div>`);

    el.querySelector('.viz-panel-body').innerHTML = `
      <div class="stack-viz" style="flex-direction:column;gap:4px">${rows.join('')}</div>
      <div style="margin-top:8px;padding:6px 8px;border-top:1px solid var(--border-subtle);font-size:10px;color:var(--text-muted)">
        Depth: ${frames.length} frame${frames.length !== 1 ? 's' : ''}
      </div>`;
    return el;
  }

  // ── 4. Linked List ───────────────────────────────────
  _renderLinkedListSection(analysis, code) {
    const el = this._makePanel('🔗 Linked List', 'll-viz-panel');

    // Extract node values if possible, else use demo
    const nodes = this._extractLinkedListNodes(code) ?? [1, 2, 3, 4, 5];

    const nodeHtml = nodes.map((val, i) => `
      <div class="ll-node" style="animation-delay:${i * 60}ms">
        <div class="ll-node-box ${i === 0 ? 'active' : ''}">
          <div class="ll-data">${val}</div>
          <div class="ll-next">${i < nodes.length - 1 ? 'next →' : 'null'}</div>
        </div>
        ${i < nodes.length - 1 ? '<span class="ll-arrow">→</span>' : '<span class="ll-null">∅</span>'}
      </div>`).join('');

    el.querySelector('.viz-panel-body').innerHTML = `<div class="linked-list-viz">${nodeHtml}</div>
      <div style="margin-top:6px;font-size:10px;color:var(--text-muted)">Head → Node[0] · ${nodes.length} nodes · tail.next = null</div>`;
    return el;
  }

  // ── 5. Binary Tree ───────────────────────────────────
  _renderBinaryTreeSection(analysis, code) {
    const el = this._makePanel('🌲 Binary Tree', 'tree-viz-panel');

    const nodes = this._extractTreeNodes(code) ?? [4, 2, 6, 1, 3, 5, 7];
    const svgContent = this._buildTreeSVG(nodes);

    el.querySelector('.viz-panel-body').innerHTML = `<div class="tree-viz">${svgContent}</div>`;
    return el;
  }

  // ── 6. Memory View ───────────────────────────────────
  _renderMemorySection(analysis, execState) {
    const el = this._makePanel('💾 Memory Map', 'memory-viz-panel');
    const idx = execState?.stepIdx ?? 0;

    const vars = analysis.variables.slice(0, 8);
    if (!vars.length) {
      el.querySelector('.viz-panel-body').innerHTML = `<p style="color:var(--text-muted);font-size:12px">No memory allocations to show</p>`;
      return el;
    }

    const cells = vars.map((v, i) => {
      const addr = `0x${(0x1000 + i * 4).toString(16).toUpperCase()}`;
      return `
        <div class="memory-cell ${i === idx % vars.length ? 'active' : i < Math.ceil(vars.length / 2) ? 'occupied' : ''}">
          <div class="memory-addr">${addr}</div>
          <div class="memory-val">${v.name}</div>
        </div>`;
    });

    el.querySelector('.viz-panel-body').innerHTML = `
      <div style="margin-bottom:6px;font-size:10px;color:var(--text-muted)">STACK SEGMENT</div>
      <div class="memory-grid">${cells.join('')}</div>
      <div style="margin-top:8px;font-size:10px;color:var(--text-muted);display:flex;gap:12px">
        <span>🟣 Active</span><span>🔵 Occupied</span><span>⬛ Free</span>
      </div>`;
    return el;
  }

  // ── 7. Execution Flow ────────────────────────────────
  _renderFlowSection(analysis, execState) {
    const el = this._makePanel('⚡ Execution Flow', 'flow-viz-panel');
    const idx = execState?.stepIdx ?? 0;
    const steps = execState?.steps ?? this._buildDemoSteps(analysis);

    if (!steps.length) {
      el.querySelector('.viz-panel-body').innerHTML = `<p style="color:var(--text-muted);font-size:12px">Press ▶ Run to start visualization</p>`;
      return el;
    }

    const stepHtml = steps.slice(0, 8).map((s, i) => `
      <div class="exec-flow-step ${i === idx ? 'active-step' : ''}" style="opacity:${Math.max(0.3, 1 - Math.abs(i - idx) * 0.2)}">
        <div class="exec-step-num">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--text-primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.desc || s.label || 'Step ' + (i + 1)}</div>
          ${s.line ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px">Line ${s.line}</div>` : ''}
        </div>
        ${i === idx ? '<span style="font-size:9px;color:var(--accent-emerald);font-weight:700;flex-shrink:0">▶ NOW</span>' : ''}
      </div>`).join('');

    el.querySelector('.viz-panel-body').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">${stepHtml}</div>
      ${steps.length > 8 ? `<div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:6px">+${steps.length - 8} more steps</div>` : ''}`;
    return el;
  }

  // ── SVG Tree Builder ─────────────────────────────────
  _buildTreeSVG(nodes) {
    if (!nodes.length) return '<p style="color:var(--text-muted);font-size:12px">No tree data</p>';

    // Build as array-indexed tree (0 = root, 1 = left of 0, 2 = right of 0, etc.)
    const sorted = [...nodes].sort((a, b) => a - b);
    const tree = this._sortedArrayToBST(sorted);

    const W = 280, H = Math.min(220, 50 + Math.ceil(Math.log2(nodes.length + 1)) * 50);
    const radius = 16;

    let svgNodes = '';
    let svgEdges = '';

    const layoutNode = (node, x, y, offsetX) => {
      if (!node) return;
      const leftX = x - offsetX;
      const rightX = x + offsetX;
      const childY = y + 50;

      if (node.left) {
        svgEdges += `<line class="tree-edge" x1="${x}" y1="${y}" x2="${leftX}" y2="${childY}"/>`;
        layoutNode(node.left, leftX, childY, offsetX / 1.8);
      }
      if (node.right) {
        svgEdges += `<line class="tree-edge" x1="${x}" y1="${y}" x2="${rightX}" y2="${childY}"/>`;
        layoutNode(node.right, rightX, childY, offsetX / 1.8);
      }
      svgNodes += `
        <circle class="tree-node-circle" cx="${x}" cy="${y}" r="${radius}"/>
        <text class="tree-node-label" x="${x}" y="${y}">${node.val}</text>`;
    };

    layoutNode(tree, W / 2, 24, W / 4);

    return `<svg class="tree-svg" viewBox="0 0 ${W} ${H}" style="max-height:${H}px">
      ${svgEdges}${svgNodes}
    </svg>`;
  }

  _sortedArrayToBST(arr) {
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return {
      val: arr[mid],
      left: this._sortedArrayToBST(arr.slice(0, mid)),
      right: this._sortedArrayToBST(arr.slice(mid + 1)),
    };
  }

  // ── Detection helpers ────────────────────────────────
  _detectLinkedList(code, lang) {
    return /linked.?list|ListNode|struct.*Node|\.next\s*=|next\s*->|head\s*=/.test(code);
  }

  _detectBinaryTree(code, lang) {
    return /TreeNode|BinaryTree|\.left\s*=|\.right\s*=|left\s*->|right\s*->|bst|binary.?tree/.test(code);
  }

  // ── Data extractors ──────────────────────────────────
  _extractFirstArray(analysis) {
    for (const v of analysis.variables) {
      if (v.value && v.value.startsWith('[')) {
        try {
          const arr = JSON.parse(v.value.replace(/'/g, '"'));
          if (Array.isArray(arr) && arr.length) return arr;
        } catch {}
      }
    }
    return null;
  }

  _extractLinkedListNodes(code) {
    const m = code.match(/=\s*\[([^\]]+)\]/);
    if (m) {
      try {
        const arr = JSON.parse('[' + m[1] + ']');
        if (Array.isArray(arr) && arr.every(x => typeof x === 'number')) return arr;
      } catch {}
    }
    return null;
  }

  _extractTreeNodes(code) {
    const m = code.match(/=\s*\[([^\]]+)\]/);
    if (m) {
      try {
        const arr = JSON.parse('[' + m[1] + ']').filter(x => typeof x === 'number');
        if (arr.length) return arr;
      } catch {}
    }
    return null;
  }

  // ── Demo data builders ───────────────────────────────
  _buildDemoStack(analysis, idx) {
    const fns = analysis.functions;
    if (!fns.length) return [];
    const frames = [{ name: 'main', line: 1, params: '' }];
    if (idx > 1 && fns[0]) frames.push({ name: fns[0].name, line: fns[0].line, params: 'n' });
    if (idx > 3 && fns[1]) frames.push({ name: fns[1]?.name || fns[0].name, line: fns[0].line + 2, params: 'n-1' });
    return frames;
  }

  _buildDemoSteps(analysis) {
    const steps = [];
    let n = 1;
    if (analysis.functions.length) {
      steps.push({ desc: 'Define function ' + analysis.functions[0].name + '()', line: analysis.functions[0].line });
    }
    for (const v of analysis.variables.slice(0, 3)) {
      steps.push({ desc: `Initialize ${v.name} = ${v.value || '0'}`, line: v.line });
    }
    for (const l of analysis.loops) {
      steps.push({ desc: `Enter ${l.type} loop`, line: l.line });
      steps.push({ desc: `Execute loop body (iteration ${n++})`, line: l.line + 1 });
      steps.push({ desc: `Execute loop body (iteration ${n++})`, line: l.line + 1 });
      steps.push({ desc: `Loop terminates after ${n - 1} iterations`, line: l.line });
    }
    if (analysis.functions.length) {
      steps.push({ desc: 'Return result', line: analysis.functions[0].line + analysis.lineCount });
    }
    return steps;
  }

  // ── Panel factory ─────────────────────────────────────
  _makePanel(title, id) {
    const div = document.createElement('div');
    div.className = 'viz-panel';
    div.id = id;
    div.innerHTML = `
      <div class="viz-panel-title">${title}</div>
      <div class="viz-panel-body"></div>`;
    return div;
  }

  // ── Helpers ──────────────────────────────────────────
  _inferType(val) {
    if (val === undefined || val === null || val === '—') return 'auto';
    if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float';
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'string') {
      if (/^-?\d+$/.test(val)) return 'int';
      if (/^-?\d+\.\d+$/.test(val)) return 'float';
      if (/^["']/.test(val)) return 'str';
      if (/^\[/.test(val)) return 'list';
      if (/^\{/.test(val)) return 'dict';
    }
    return 'auto';
  }

  _safeStr(val, maxLen = 18) {
    const s = String(val ?? '—');
    return s.length > maxLen ? s.slice(0, maxLen) + '…' : s;
  }

  _emptyState() {
    return `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;color:var(--text-muted)">
        <span style="font-size:32px;opacity:0.4">📊</span>
        <p style="font-size:13px">Write some code and click <strong style="color:var(--text-secondary)">▶ Visualize</strong> to see it come alive</p>
      </div>`;
  }
}

// ─────────────────────────────────────────────────────────
// CODE ANALYZER — used by both AI engine & visualizer
// ─────────────────────────────────────────────────────────
function analyzeCode(code, lang) {
  const lines = code.split('\n');
  const lineCount = lines.length;

  // Functions
  const functions = [];
  const fnPatterns = [
    /^(?:function\s+|async\s+function\s+)(\w+)\s*\(/gm,         // JS
    /^def\s+(\w+)\s*\(/gm,                                        // Python
    /(?:public|private|protected|static)?\s+\w+\s+(\w+)\s*\(/gm, // Java/C++
    /^(?:func|fn)\s+(\w+)\s*[\(\(]/gm,                           // Go/Rust
  ];
  for (const pat of fnPatterns) {
    let m;
    while ((m = pat.exec(code)) !== null) {
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(m[1])) {
        const lineNum = code.slice(0, m.index).split('\n').length;
        functions.push({ name: m[1], line: lineNum });
      }
    }
  }

  // Loops
  const loops = [];
  const loopPat = /\b(for|while|forEach|map|filter|reduce)\b/g;
  let lm;
  while ((lm = loopPat.exec(code)) !== null) {
    const lineNum = code.slice(0, lm.index).split('\n').length;
    loops.push({ type: lm[1], line: lineNum });
  }

  // Conditions
  const conditions = [];
  const condPat = /\b(if|else if|elif|switch|case)\b/g;
  let cm;
  while ((cm = condPat.exec(code)) !== null) {
    const lineNum = code.slice(0, cm.index).split('\n').length;
    conditions.push({ type: cm[1], line: lineNum });
  }

  // Variables
  const variables = [];
  const varPats = [
    /(?:let|const|var)\s+(\w+)\s*=\s*([^;\n]+)/g,    // JS
    /(\w+)\s*=\s*([^=\n][^\n]+)/g,                    // Python / general assignment
    /int|float|str|bool|char|double\s+(\w+)\s*=?\s*([^;\n]*)/g, // C/Java
  ];
  const seenVars = new Set();
  for (const pat of varPats) {
    let vm;
    while ((vm = pat.exec(code)) !== null) {
      if (vm[1] && !seenVars.has(vm[1]) && !/^\d/.test(vm[1]) && vm[1].length > 1) {
        const ln = code.slice(0, vm.index).split('\n').length;
        variables.push({ name: vm[1], value: (vm[2] || '').trim().substring(0, 30), line: ln });
        seenVars.add(vm[1]);
      }
    }
  }

  // Recursion detection
  let recursion = false;
  for (const fn of functions) {
    const fnBody = code.slice(code.indexOf(fn.name));
    if (fnBody.includes(fn.name + '(') && fnBody.lastIndexOf(fn.name + '(') > fnBody.indexOf(fn.name + '(')) {
      recursion = true;
      break;
    }
  }

  // Arrays
  const hasArrays = /\[[^\]]*\d[^\]]*\]|\b(array|ArrayList|vector|list\()\b/.test(code);

  // Complexity
  const nestedLoops = detectNestedLoops(code, loops);
  let timeComplexity = 'O(1)';
  if (recursion && functions.length) {
    const fnName = functions[0].name;
    // Check if exponential (calls itself twice in body)
    const bodyCount = (code.match(new RegExp(fnName + '\\(', 'g')) || []).length - 1;
    timeComplexity = bodyCount >= 2 ? 'O(2ⁿ)' : 'O(n)';
  } else if (nestedLoops >= 2) {
    timeComplexity = 'O(n²)';
  } else if (loops.length >= 1) {
    timeComplexity = 'O(n)';
  } else if (/sort\s*\(|\.sort\s*\(/.test(code)) {
    timeComplexity = 'O(n log n)';
  }

  const spaceComplexity = hasArrays ? 'O(n)' : recursion ? 'O(n)' : 'O(1)';

  return {
    lineCount,
    functions: functions.slice(0, 10),
    loops: loops.slice(0, 10),
    conditions: conditions.slice(0, 20),
    variables: variables.slice(0, 20),
    recursion,
    hasArrays,
    complexity: { time: timeComplexity, space: spaceComplexity },
  };
}

function detectNestedLoops(code, loops) {
  if (loops.length < 2) return loops.length;
  // Simple check: are there multiple loops where the inner loop's index is within outer loop's block?
  let maxNesting = 1;
  for (let i = 0; i < loops.length; i++) {
    for (let j = i + 1; j < loops.length; j++) {
      if (loops[j].line > loops[i].line && loops[j].line - loops[i].line <= 10) {
        maxNesting = 2;
      }
    }
  }
  return maxNesting;
}

// ─────────────────────────────────────────────────────────
// EXECUTION TIMELINE BUILDER
// Generates step-by-step execution steps from code analysis
// ─────────────────────────────────────────────────────────
function buildExecutionTimeline(code, lang, analysis) {
  const steps = [];
  const lines = code.split('\n');

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('*')) continue;

    const step = { line: i + 1, code: line, desc: '', vars: {}, changed: [], callStack: [] };

    // Classify line type and build description
    if (/^(def|function|class)\s/.test(line)) {
      step.desc = `Define: ${line.match(/(?:def|function|class)\s+(\w+)/)?.[1] || line.substring(0, 30)}`;
      step.type = 'definition';
    } else if (/^\s*(for|while)\s/.test(line)) {
      step.desc = `Enter loop: ${line.substring(0, 35)}`;
      step.type = 'loop';
    } else if (/^\s*(if|elif|else)\s/.test(line) || line.startsWith('else')) {
      step.desc = `Condition check: ${line.substring(0, 35)}`;
      step.type = 'condition';
    } else if (/=/.test(line) && !/[=!<>]=/.test(line) && !/^\s*(if|while|for)/.test(line)) {
      const varName = line.match(/^\s*(\w+)\s*=/)?.[1];
      step.desc = `Assign: ${line.substring(0, 40)}`;
      step.type = 'assignment';
      if (varName) step.changed = [varName];
    } else if (/return\s/.test(line)) {
      step.desc = `Return: ${line.match(/return\s+(.+)/)?.[1]?.substring(0, 30) || ''}`;
      step.type = 'return';
    } else if (/print|console\.log|System\.out|cout/.test(line)) {
      step.desc = `Output: ${line.match(/(?:print|console\.log)\s*\((.+)\)/)?.[1]?.substring(0, 30) || line.substring(0, 40)}`;
      step.type = 'output';
    } else if (line.length > 1) {
      step.desc = line.substring(0, 45) + (line.length > 45 ? '…' : '');
      step.type = 'statement';
    } else {
      continue;
    }

    // Add call stack based on function context
    let inFn = null;
    for (const fn of analysis.functions) {
      if (i + 1 >= fn.line) inFn = fn;
    }
    step.callStack = inFn
      ? [{ name: 'global', line: 1 }, { name: inFn.name, line: i + 1 }]
      : [{ name: 'global', line: i + 1 }];

    // Array state for sorting visualization
    if (analysis.hasArrays && (step.type === 'loop' || step.type === 'assignment')) {
      const demo = [5, 2, 8, 1, 9, 3];
      const shuffled = [...demo];
      for (let s = 0; s < Math.min(steps.length, 3); s++) {
        if (Math.random() > 0.5 && shuffled.length > 1) {
          const a = Math.floor(Math.random() * shuffled.length);
          const b = Math.floor(Math.random() * shuffled.length);
          [shuffled[a], shuffled[b]] = [shuffled[b], shuffled[a]];
        }
      }
      step.array = shuffled;
      step.comparingIdx = [steps.length % shuffled.length, (steps.length + 1) % shuffled.length];
    }

    steps.push(step);
  }

  return steps;
}

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────
window.Visualizer = {
  VisualizationEngine,
  analyzeCode,
  buildExecutionTimeline,
};
