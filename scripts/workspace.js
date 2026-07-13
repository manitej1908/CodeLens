/* ============================================================
   CODELENS — Workspace Engine
   Monaco Editor · File Persistence · Terminal · AI · Visualizer
   ============================================================ */

'use strict';

// ══════════════════════════════════════════════
// CONSTANTS & CONFIG
// ══════════════════════════════════════════════
const STORAGE_KEY = 'codelens_workspace_v2';
const AUTOSAVE_DELAY = 1000; // ms

// ── Backend API base URL ──────────────────────────────────
// Relative path works whether served by Express or opened via file://
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// ── Session ID for server-side saves ───────────────────────
let _sessionId = localStorage.getItem('codelens_session_id') || null;

const LANG_MAP = {
  '.py':   { monaco: 'python',     label: 'Python',     icon: '🐍' },
  '.js':   { monaco: 'javascript', label: 'JavaScript', icon: '🟨' },
  '.ts':   { monaco: 'typescript', label: 'TypeScript', icon: '🔷' },
  '.cpp':  { monaco: 'cpp',        label: 'C++',        icon: '⚡' },
  '.c':    { monaco: 'c',          label: 'C',          icon: '©️' },
  '.java': { monaco: 'java',       label: 'Java',       icon: '☕' },
  '.go':   { monaco: 'go',         label: 'Go',         icon: '🐹' },
  '.rs':   { monaco: 'rust',       label: 'Rust',       icon: '🦀' },
  '.md':   { monaco: 'markdown',   label: 'Markdown',   icon: '📝' },
  '.html': { monaco: 'html',       label: 'HTML',       icon: '🌐' },
  '.css':  { monaco: 'css',        label: 'CSS',        icon: '🎨' },
};

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
const state = {
  files: [],          // { id, name, lang, ext, icon, monacoLang, content, modified }
  activeId: null,
  aiMode: 'mentor',
  activeAiTab: 'explain',
  execSteps: [],
  execIdx: 0,
  execPlaying: false,
  execTimer: null,
  terminalOpen: false,
  terminalHeight: 200,
  monacoReady: false,
  conversation: [],   // { role, content }
};

let monacoEditor = null;
let monacoModels = {};   // id -> monaco.editor.ITextModel
let autosaveTimer = null;
let _idSeq = Date.now();

function uid() { return `f_${++_idSeq}`; }

// ══════════════════════════════════════════════
// PERSISTENCE — localStorage
// ══════════════════════════════════════════════
function saveToStorage() {
  try {
    const data = {
      files: state.files.map(f => ({
        id: f.id, name: f.name, lang: f.lang, ext: f.ext,
        icon: f.icon, monacoLang: f.monacoLang,
        content: monacoModels[f.id]?.getValue() ?? f.content,
        modified: false,
      })),
      activeId: state.activeId,
      aiMode: state.aiMode,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateSaveStatus('saved');
  } catch (e) {
    console.warn('[CodeLens] Storage write failed:', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.files)) return false;
    state.files = data.files;
    state.activeId = data.activeId || (data.files[0]?.id ?? null);
    state.aiMode = data.aiMode || 'mentor';
    return state.files.length > 0;
  } catch (e) {
    console.warn('[CodeLens] Storage read failed:', e);
    return false;
  }
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveToStorage(), AUTOSAVE_DELAY);
  updateSaveStatus('unsaved');
}

function updateSaveStatus(status) {
  const el = document.getElementById('editor-save-status');
  if (!el) return;
  if (status === 'saved') {
    el.textContent = '● Saved';
    el.style.color = 'var(--accent-emerald)';
    el.style.borderColor = 'rgba(16,185,129,0.2)';
  } else {
    el.textContent = '● Unsaved';
    el.style.color = 'var(--accent-amber)';
    el.style.borderColor = 'rgba(245,158,11,0.2)';
  }
}

// ══════════════════════════════════════════════
// MONACO EDITOR INITIALIZATION
// ══════════════════════════════════════════════
function initMonaco() {
  require.config({
    paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
  });

  require(['vs/editor/editor.main'], () => {
    state.monacoReady = true;

    // Define CodeLens dark theme
    monaco.editor.defineTheme('codelens-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment',     foreground: '546e7a', fontStyle: 'italic' },
        { token: 'keyword',     foreground: 'c792ea', fontStyle: 'bold' },
        { token: 'string',      foreground: 'c3e88d' },
        { token: 'number',      foreground: 'f78c6c' },
        { token: 'type',        foreground: 'ffcb6b' },
        { token: 'function',    foreground: '82aaff' },
        { token: 'variable',    foreground: 'f07178' },
        { token: 'operator',    foreground: '89ddff' },
        { token: 'delimiter',   foreground: '89ddff' },
        { token: 'identifier',  foreground: 'eeffff' },
      ],
      colors: {
        'editor.background':           '#080b14',
        'editor.foreground':           '#f1f5f9',
        'editor.lineHighlightBackground': '#111827',
        'editor.selectionBackground':  '#7c6ee840',
        'editor.inactiveSelectionBackground': '#7c6ee820',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#7c6ee8',
        'editorCursor.foreground':     '#7c6ee8',
        'editor.findMatchBackground':  '#f59e0b30',
        'editor.findMatchHighlightBackground': '#f59e0b18',
        'editorWidget.background':     '#0d1117',
        'editorWidget.border':         '#ffffff10',
        'editorSuggestWidget.background': '#0d1117',
        'editorSuggestWidget.border':  '#ffffff10',
        'editorSuggestWidget.selectedBackground': '#7c6ee820',
        'editorBracketMatch.background': '#7c6ee830',
        'editorBracketMatch.border':   '#7c6ee8',
        'scrollbarSlider.background':  '#ffffff18',
        'scrollbarSlider.hoverBackground': '#7c6ee840',
        'scrollbarSlider.activeBackground': '#7c6ee860',
        'editorGutter.background':     '#0d1117',
        'minimap.background':          '#0d1117',
      }
    });

    // Create editor instance
    monacoEditor = monaco.editor.create(
      document.getElementById('monaco-container'),
      {
        value: '',
        language: 'python',
        theme: 'codelens-dark',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontLigatures: true,
        lineHeight: 22,
        letterSpacing: 0.3,
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        automaticLayout: true,
        tabSize: 4,
        insertSpaces: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        renderWhitespace: 'none',
        padding: { top: 16, bottom: 16 },
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        suggest: {
          showKeywords: true,
          showSnippets: true,
          showClasses: true,
          showFunctions: true,
          showVariables: true,
          showModules: true,
        },
        quickSuggestions: { other: true, comments: false, strings: false },
        parameterHints: { enabled: true },
        formatOnPaste: true,
        formatOnType: false,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        folding: true,
        showFoldingControls: 'always',
        contextmenu: true,
        mouseWheelZoom: true,
        renderLineHighlight: 'all',
      }
    );

    // Register C/C++ completions (custom)
    registerCustomCompletions();

    // Wire editor events
    monacoEditor.onDidChangeModelContent(() => {
      const file = getActiveFile();
      if (!file) return;
      file.content = monacoEditor.getValue();
      file.modified = true;
      scheduleAutosave();
      updateEditorStats();
      markTabModified(file.id, true);
    });

    monacoEditor.onDidChangeCursorPosition(e => {
      document.getElementById('editor-position').textContent =
        `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      document.getElementById('status-ln').textContent = e.position.lineNumber;
      document.getElementById('status-col').textContent = e.position.column;
    });

    // Add Ctrl+S save action
    monacoEditor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => saveAll()
    );

    // Load saved state or show empty
    const restored = loadFromStorage();
    if (restored && state.files.length > 0) {
      // Rebuild monaco models from saved data
      state.files.forEach(f => {
        monacoModels[f.id] = monaco.editor.createModel(f.content || '', f.monacoLang || 'plaintext');
      });
      renderFileTree();
      renderTabBar();
      if (state.activeId && state.files.find(f => f.id === state.activeId)) {
        setActiveFile(state.activeId, false);
      } else if (state.files.length > 0) {
        setActiveFile(state.files[0].id, false);
      }
      terminalLog('info', `[CodeLens] Session restored. ${state.files.length} file(s) loaded.`);
    } else {
      showEmptyState();
    }

    // Apply AI mode
    updateAiModeLabel();
    console.log('%c CodeLens Monaco Ready 🔭 ', 'background:#7c6ee8;color:#fff;padding:4px 8px;border-radius:4px;font-weight:bold');
  });
}

// ══════════════════════════════════════════════
// CUSTOM COMPLETIONS
// ══════════════════════════════════════════════
function registerCustomCompletions() {
  // C++ completions
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['#', ':', '<', '.'],
    provideCompletionItems(model, position) {
      const word   = model.getWordUntilPosition(position);
      const range  = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const line   = model.getLineContent(position.lineNumber);
      const items  = [];

      if (line.trim().startsWith('#include')) {
        const headers = ['<iostream>','<vector>','<string>','<algorithm>','<map>','<set>','<unordered_map>','<queue>','<stack>','<list>','<deque>','<array>','<cmath>','<cstdlib>','<cstring>','<cassert>','<climits>','<fstream>','<sstream>','<utility>','<numeric>','<functional>','<memory>','<thread>','<mutex>','<chrono>'];
        headers.forEach(h => items.push({ label: h, kind: monaco.languages.CompletionItemKind.Module, insertText: h, range, detail: 'C++ Header' }));
      }

      const snippets = [
        { label: 'for',    insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}', doc: 'For loop' },
        { label: 'while',  insertText: 'while (${1:condition}) {\n\t$0\n}',                           doc: 'While loop' },
        { label: 'if',     insertText: 'if (${1:condition}) {\n\t$0\n}',                              doc: 'If statement' },
        { label: 'cout',   insertText: 'std::cout << ${1:value} << std::endl;',                       doc: 'Console output' },
        { label: 'cin',    insertText: 'std::cin >> ${1:variable};',                                   doc: 'Console input' },
        { label: 'vector', insertText: 'std::vector<${1:int}> ${2:v};',                               doc: 'STL vector' },
        { label: 'main',   insertText: 'int main() {\n\t$0\n\treturn 0;\n}',                          doc: 'Main function' },
        { label: 'class',  insertText: 'class ${1:Name} {\npublic:\n\t$0\n};',                        doc: 'Class definition' },
        { label: 'struct', insertText: 'struct ${1:Name} {\n\t$0\n};',                                doc: 'Struct definition' },
        { label: 'func',   insertText: '${1:void} ${2:functionName}(${3:params}) {\n\t$0\n}',         doc: 'Function definition' },
      ];
      snippets.forEach(s => items.push({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: s.doc,
        range,
      }));

      return { suggestions: items };
    }
  });

  // Python completions
  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', ' ', '('],
    provideCompletionItems(model, position) {
      const word  = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      const snippets = [
        { label: 'def',        insertText: 'def ${1:function_name}(${2:params}):\n\t$0',                 doc: 'Function definition' },
        { label: 'class',      insertText: 'class ${1:ClassName}:\n\tdef __init__(self):\n\t\t$0',        doc: 'Class definition' },
        { label: 'for',        insertText: 'for ${1:item} in ${2:iterable}:\n\t$0',                      doc: 'For loop' },
        { label: 'while',      insertText: 'while ${1:condition}:\n\t$0',                                 doc: 'While loop' },
        { label: 'if',         insertText: 'if ${1:condition}:\n\t$0',                                    doc: 'If statement' },
        { label: 'ifelse',     insertText: 'if ${1:condition}:\n\t$0\nelse:\n\tpass',                     doc: 'If-else block' },
        { label: 'try',        insertText: 'try:\n\t$0\nexcept ${1:Exception} as e:\n\tprint(e)',         doc: 'Try-except' },
        { label: 'lambda',     insertText: 'lambda ${1:x}: ${2:x}',                                       doc: 'Lambda function' },
        { label: 'listcomp',   insertText: '[${1:expr} for ${2:item} in ${3:iterable}]',                  doc: 'List comprehension' },
        { label: 'print',      insertText: 'print(${1:value})',                                            doc: 'Print statement' },
        { label: 'range',      insertText: 'range(${1:start}, ${2:stop})',                                 doc: 'Range object' },
        { label: 'enumerate',  insertText: 'enumerate(${1:iterable})',                                     doc: 'Enumerate' },
        { label: 'len',        insertText: 'len(${1:obj})',                                                doc: 'Length' },
        { label: 'sorted',     insertText: 'sorted(${1:iterable}, key=${2:None})',                         doc: 'Sort' },
        { label: 'import',     insertText: 'import ${1:module}',                                           doc: 'Import module' },
        { label: 'from',       insertText: 'from ${1:module} import ${2:name}',                            doc: 'From import' },
      ];
      return { suggestions: snippets.map(s => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: s.doc,
        range,
      }))};
    }
  });
}

// ══════════════════════════════════════════════
// FILE MANAGEMENT
// ══════════════════════════════════════════════
function getLangConfig(ext) {
  return LANG_MAP[ext] || { monaco: 'plaintext', label: ext.replace('.','').toUpperCase() || 'Text', icon: '📄' };
}

function createFile(name, ext) {
  const cfg = getLangConfig(ext);
  const id  = uid();
  const file = {
    id, name, lang: cfg.label, ext,
    icon: cfg.icon, monacoLang: cfg.monaco,
    content: getDefaultSnippet(cfg.monaco),
    modified: false,
  };
  state.files.push(file);

  if (state.monacoReady) {
    monacoModels[id] = monaco.editor.createModel(file.content, cfg.monaco);
  }

  renderFileTree();
  renderTabBar();
  setActiveFile(id, true);
  saveToStorage();
  terminalLog('info', `Created ${name}`);
  return file;
}

function getDefaultSnippet(lang) {
  const snippets = {
    python:     '# Write your Python code here\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n',
    javascript: '// Write your JavaScript code here\n\nfunction main() {\n    \n}\n\nmain();\n',
    typescript: '// Write your TypeScript code here\n\nfunction main(): void {\n    \n}\n\nmain();\n',
    cpp:        '#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
    c:          '#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n',
    java:       'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n',
    go:         'package main\n\nimport "fmt"\n\nfunc main() {\n    \n}\n',
    rust:       'fn main() {\n    \n}\n',
    markdown:   '# My Notes\n\n',
  };
  return snippets[lang] || '';
}

function deleteFile(id) {
  const idx  = state.files.findIndex(f => f.id === id);
  if (idx === -1) return;
  const name = state.files[idx].name;

  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  state.files.splice(idx, 1);
  if (monacoModels[id]) { monacoModels[id].dispose(); delete monacoModels[id]; }

  if (state.activeId === id) {
    state.activeId = state.files.length ? state.files[Math.max(0, idx - 1)].id : null;
  }

  renderFileTree();
  renderTabBar();
  if (state.activeId) setActiveFile(state.activeId, false);
  else showEmptyState();

  saveToStorage();
  terminalLog('warn', `Deleted ${name}`);
}

function duplicateFile(id) {
  const src = state.files.find(f => f.id === id);
  if (!src) return;
  const baseName = src.name.replace(src.ext, '');
  const newName  = `${baseName}_copy${src.ext}`;
  const content  = monacoModels[id]?.getValue() ?? src.content;

  const cfg    = getLangConfig(src.ext);
  const newId  = uid();
  const newFile = { id: newId, name: newName, lang: src.lang, ext: src.ext, icon: src.icon, monacoLang: src.monacoLang, content, modified: false };
  state.files.push(newFile);

  if (state.monacoReady) {
    monacoModels[newId] = monaco.editor.createModel(content, cfg.monaco);
  }

  renderFileTree();
  renderTabBar();
  setActiveFile(newId, true);
  saveToStorage();
  terminalLog('info', `Duplicated → ${newName}`);
}

function renameFile(id, newName) {
  const file = state.files.find(f => f.id === id);
  if (!file) return;

  const ext   = newName.includes('.') ? '.' + newName.split('.').pop() : file.ext;
  const cfg   = getLangConfig(ext);
  const oldName = file.name;

  file.name = newName;
  file.ext  = ext;
  file.lang = cfg.label;
  file.icon = cfg.icon;
  file.monacoLang = cfg.monaco;

  // Switch Monaco model language if changed
  if (state.monacoReady && monacoModels[id]) {
    monaco.editor.setModelLanguage(monacoModels[id], cfg.monaco);
  }

  renderFileTree();
  renderTabBar();
  if (state.activeId === id) updateEditorHeader(file);
  saveToStorage();
  terminalLog('info', `Renamed ${oldName} → ${newName}`);
}

function getActiveFile() {
  return state.files.find(f => f.id === state.activeId) || null;
}

function setActiveFile(id, animate = true) {
  state.activeId = id;
  const file = getActiveFile();
  if (!file) { showEmptyState(); return; }

  // Show editor
  document.getElementById('editor-empty-state').style.display = 'none';
  const pane = document.getElementById('editor-pane');
  pane.style.display = 'flex';

  // Switch Monaco model
  if (state.monacoReady && monacoEditor) {
    if (!monacoModels[id]) {
      monacoModels[id] = monaco.editor.createModel(file.content || '', file.monacoLang || 'plaintext');
    }
    monacoEditor.setModel(monacoModels[id]);
    monacoEditor.focus();
  }

  updateEditorHeader(file);
  renderFileTree();
  renderTabBar();
  updateEditorStats();
  resetTimeline();
  document.title = `CodeLens — ${file.name}`;
}

function showEmptyState() {
  const pane = document.getElementById('editor-pane');
  pane.style.display = 'none';
  document.getElementById('editor-empty-state').style.display = 'flex';
  if (state.monacoReady && monacoEditor) monacoEditor.setModel(null);
  document.title = 'CodeLens — Workspace';
  updateStatusLang(null);
  resetTimeline();
}

function updateEditorHeader(file) {
  const iconEl  = document.getElementById('editor-lang-icon');
  const labelEl = document.getElementById('editor-lang-label');
  const bread   = document.getElementById('breadcrumb-file');
  if (iconEl)  iconEl.textContent  = file.icon;
  if (labelEl) labelEl.textContent = file.lang;
  if (bread)   bread.textContent   = file.name;
  updateStatusLang(file);
  updateSaveStatus('saved');
}

function updateStatusLang(file) {
  const el = document.getElementById('status-lang');
  if (el) el.innerHTML = file
    ? `<span>${file.icon}</span><strong>${file.lang}</strong>`
    : `<span>📄</span><strong>No file</strong>`;
}

function updateEditorStats() {
  const model = monacoEditor?.getModel();
  if (!model) return;
  const lines = model.getLineCount();
  const el = document.getElementById('status-lines');
  if (el) el.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
}

function markTabModified(id, isModified) {
  const tab = document.getElementById(`tab_${id}`);
  if (!tab) return;
  const dot = tab.querySelector('.tab-modified-dot');
  if (dot) dot.style.display = isModified ? 'inline-block' : 'none';
}

function saveAll() {
  state.files.forEach(f => { f.modified = false; markTabModified(f.id, false); });
  saveToStorage();
  updateSaveStatus('saved');
  terminalLog('info', 'All files saved.');
  // Toast notification
  if (window.AIEngine?.showToast) {
    window.AIEngine.showToast('All files saved', 'success', 2500);
  }
  // Also persist to backend (non-blocking)
  saveToBackend();
}

// ── Backend save (POST /api/save) ────────────────────────────
async function saveToBackend() {
  try {
    const files = state.files.map(f => ({
      id:         f.id,
      name:       f.name,
      lang:       f.lang,
      ext:        f.ext,
      icon:       f.icon,
      monacoLang: f.monacoLang,
      content:    monacoModels[f.id]?.getValue() ?? f.content,
      modified:   false,
    }));
    const res = await fetch(`${API_BASE}/api/save`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ files, sessionId: _sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sessionId) {
        _sessionId = data.sessionId;
        localStorage.setItem('codelens_session_id', _sessionId);
      }
    }
  } catch (err) {
    console.warn('[CodeLens] Backend save skipped (server unavailable):', err.message);
  }
}

// ══════════════════════════════════════════════
// RENDER FILE TREE
// ══════════════════════════════════════════════
function renderFileTree() {
  const list = document.getElementById('file-list');
  if (!list) return;

  const empty = document.getElementById('empty-sidebar-msg');

  if (!state.files.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = state.files.map(f => `
    <div class="file-item${f.id === state.activeId ? ' active' : ''}"
         data-id="${f.id}" role="treeitem" aria-selected="${f.id === state.activeId}" tabindex="0"
         id="ftree_${f.id}">
      <span class="file-icon">${f.icon}</span>
      <span class="file-name">${f.name}</span>
      ${f.modified ? '<span class="file-modified-dot"></span>' : ''}
      <div class="file-item-actions">
        <button class="file-action-btn" data-action="rename" data-id="${f.id}" title="Rename">✏</button>
        <button class="file-action-btn" data-action="duplicate" data-id="${f.id}" title="Duplicate">⧉</button>
        <button class="file-action-btn danger" data-action="delete" data-id="${f.id}" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.file-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.file-action-btn')) return;
      setActiveFile(el.dataset.id);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveFile(el.dataset.id); }
    });
  });

  list.querySelectorAll('.file-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'delete')    deleteFile(id);
      else if (action === 'rename')    openRenameDialog(id);
      else if (action === 'duplicate') duplicateFile(id);
    });
  });
}

// ══════════════════════════════════════════════
// RENDER TAB BAR
// ══════════════════════════════════════════════
function renderTabBar() {
  const bar = document.getElementById('tab-bar');
  if (!bar) return;

  bar.innerHTML = state.files.map(f => `
    <div class="tab${f.id === state.activeId ? ' active' : ''}"
         data-id="${f.id}" role="tab" aria-selected="${f.id === state.activeId}"
         id="tab_${f.id}" tabindex="0">
      ${f.icon}
      <span class="tab-label">${f.name}</span>
      <span class="tab-modified-dot" style="display:${f.modified?'inline-block':'none'};width:6px;height:6px;border-radius:50%;background:var(--accent-amber);margin-left:2px;flex-shrink:0"></span>
      <button class="tab-close" data-id="${f.id}" aria-label="Close ${f.name}" title="Close">×</button>
    </div>
  `).join('');

  bar.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('tab-close')) return;
      setActiveFile(el.dataset.id);
    });
  });
  bar.querySelectorAll('.tab-close').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteFile(btn.dataset.id);
    });
  });
}

// ══════════════════════════════════════════════
// NEW FILE DIALOG
// ══════════════════════════════════════════════
let _newExt = '.py';
const defaultNames = { '.py':'main.py','.js':'index.js','.ts':'main.ts','.cpp':'main.cpp','.c':'main.c','.java':'Main.java','.go':'main.go','.rs':'main.rs','.md':'notes.md' };

function openNewFileDialog() {
  _newExt = '.py';
  const overlay = document.getElementById('new-file-overlay');
  const input   = document.getElementById('new-file-input');
  overlay.classList.add('open');
  input.value = '';
  input.placeholder = 'main.py';
  input.focus();
  document.querySelectorAll('.lang-picker-btn').forEach(b => {
    b.classList.toggle('active-lang', b.dataset.ext === '.py');
  });
}

function closeNewFileDialog() { document.getElementById('new-file-overlay')?.classList.remove('open'); }

function confirmNewFile() {
  const input = document.getElementById('new-file-input');
  let name = input.value.trim();
  if (!name) name = defaultNames[_newExt] || `untitled${_newExt}`;
  if (!name.includes('.')) name += _newExt;
  closeNewFileDialog();
  createFile(name, _newExt);
}

document.querySelectorAll('.lang-picker-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    _newExt = btn.dataset.ext;
    document.querySelectorAll('.lang-picker-btn').forEach(b => b.classList.remove('active-lang'));
    btn.classList.add('active-lang');
    const input = document.getElementById('new-file-input');
    if (input) input.placeholder = defaultNames[_newExt] || `file${_newExt}`;
  });
});

document.getElementById('new-file-confirm')?.addEventListener('click', confirmNewFile);
document.getElementById('new-file-cancel')?.addEventListener('click',  closeNewFileDialog);
document.getElementById('new-file-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter')  confirmNewFile();
  if (e.key === 'Escape') closeNewFileDialog();
});
document.getElementById('new-file-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeNewFileDialog(); });

['sidebar-new-btn','file-new-inline','empty-new-file-btn','new-tab-btn'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', openNewFileDialog);
});

// ══════════════════════════════════════════════
// RENAME DIALOG
// ══════════════════════════════════════════════
let _renameId = null;

function openRenameDialog(id) {
  _renameId = id;
  const file = state.files.find(f => f.id === id);
  const overlay = document.getElementById('rename-overlay');
  const input   = document.getElementById('rename-input');
  overlay.classList.add('open');
  if (input) { input.value = file?.name || ''; input.select(); input.focus(); }
}
function closeRenameDialog() { document.getElementById('rename-overlay')?.classList.remove('open'); _renameId = null; }
function confirmRename() {
  const name = document.getElementById('rename-input')?.value.trim();
  if (name && _renameId) renameFile(_renameId, name);
  closeRenameDialog();
}

document.getElementById('rename-confirm')?.addEventListener('click', confirmRename);
document.getElementById('rename-cancel')?.addEventListener('click',  closeRenameDialog);
document.getElementById('rename-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter')  confirmRename();
  if (e.key === 'Escape') closeRenameDialog();
});
document.getElementById('rename-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeRenameDialog(); });

// ══════════════════════════════════════════════
// TERMINAL
// ══════════════════════════════════════════════
const termHistory = [];
let termHistIdx  = -1;

function toggleTerminal() {
  state.terminalOpen = !state.terminalOpen;
  const pane    = document.getElementById('terminal-pane');
  const divider = document.getElementById('terminal-divider');
  const edPane  = document.getElementById('editor-pane');
  const emptyEl = document.getElementById('editor-empty-state');

  if (state.terminalOpen) {
    pane.style.display    = 'flex';
    divider.style.display = 'flex';
    pane.style.height     = `${state.terminalHeight}px`;
    terminalLog('info', 'Terminal opened. Note: Live execution requires a backend compiler service.');
    document.getElementById('terminal-input')?.focus();
  } else {
    pane.style.display    = 'none';
    divider.style.display = 'none';
  }

  if (state.monacoReady && monacoEditor) monacoEditor.layout();
}

function terminalLog(type, msg) {
  const body = document.getElementById('terminal-body');
  if (!body) return;
  const colors = { info: 'var(--text-secondary)', warn: 'var(--accent-amber)', error: 'var(--accent-rose)', success: 'var(--accent-emerald)', output: 'var(--text-primary)' };
  const prefix = { info: '$', warn: '⚠', error: '✖', success: '✔', output: '>' };
  const div = document.createElement('div');
  div.className = 'terminal-line';
  div.style.color = colors[type] || 'var(--text-secondary)';
  div.innerHTML = `<span class="terminal-line-prefix" style="color:var(--accent-primary)">${prefix[type] || '$'}</span> <span>${escHtml(msg)}</span>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function terminalClear() {
  const body = document.getElementById('terminal-body');
  if (body) body.innerHTML = '';
}

function handleTerminalCommand(cmd) {
  termHistory.unshift(cmd);
  termHistIdx = -1;
  terminalLog('output', `$ ${cmd}`);

  const parts = cmd.trim().split(/\s+/);
  const verb  = parts[0].toLowerCase();

  if (verb === 'clear' || verb === 'cls') { terminalClear(); return; }
  if (verb === 'help') {
    terminalLog('info', 'Available commands: help · clear · ls · echo · version · run (requires backend)');
    return;
  }
  if (verb === 'ls' || verb === 'dir') {
    if (state.files.length === 0) { terminalLog('info', '(no files in workspace)'); return; }
    state.files.forEach(f => terminalLog('output', `  ${f.icon} ${f.name}`));
    return;
  }
  if (verb === 'echo') { terminalLog('output', parts.slice(1).join(' ')); return; }
  if (verb === 'version') { terminalLog('info', 'CodeLens Workspace v2.0 — Monaco 0.45, AI-powered'); return; }
  if (verb === 'run') {
    const file = getActiveFile();
    if (!file) { terminalLog('error', 'No file selected.'); return; }
    const code = state.monacoReady && monacoEditor ? monacoEditor.getValue() : file.content;
    if (!code.trim()) { terminalLog('error', 'File is empty — nothing to run.'); return; }
    terminalLog('info', `Running ${file.name}…`);
    fetch(`${API_BASE}/api/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, lang: file.monacoLang }),
    })
    .then(r => r.json())
    .then(data => {
      if (data.output) data.output.split('\n').forEach(line => terminalLog('output', line));
      if (data.error)  data.error.split('\n').forEach(line  => terminalLog('error',  line));
      if (data.note)   terminalLog('warn', data.note);
      terminalLog('info', `Finished in ${data.executionTime ?? 0}ms`);
    })
    .catch(err => {
      terminalLog('error', `Run failed: ${err.message}`);
      terminalLog('warn', 'Is the CodeLens server running? Start it with: npm run dev');
    });
    return;
  }
  if (verb === 'save') { saveAll(); return; }

  terminalLog('error', `Unknown command: "${verb}". Type "help" for available commands.`);
}

document.getElementById('terminal-toggle-btn')?.addEventListener('click', toggleTerminal);
document.getElementById('terminal-close-btn')?.addEventListener('click', toggleTerminal);
document.getElementById('terminal-clear-btn')?.addEventListener('click', terminalClear);

document.getElementById('terminal-input')?.addEventListener('keydown', e => {
  const input = e.currentTarget;
  if (e.key === 'Enter') {
    const cmd = input.value.trim();
    if (cmd) handleTerminalCommand(cmd);
    input.value = '';
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    termHistIdx = Math.min(termHistIdx + 1, termHistory.length - 1);
    input.value = termHistory[termHistIdx] || '';
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    termHistIdx = Math.max(termHistIdx - 1, -1);
    input.value = termHistIdx >= 0 ? termHistory[termHistIdx] : '';
  }
});

// Draggable divider
(function initDrag() {
  const divider = document.getElementById('terminal-divider');
  if (!divider) return;
  let dragging = false, startY = 0, startH = 0;

  divider.addEventListener('mousedown', e => {
    dragging = true;
    startY   = e.clientY;
    startH   = parseInt(document.getElementById('terminal-pane').style.height) || 200;
    document.body.style.userSelect   = 'none';
    document.body.style.cursor       = 'row-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const delta  = startY - e.clientY;
    const newH   = Math.max(80, Math.min(startH + delta, window.innerHeight * 0.6));
    state.terminalHeight = newH;
    document.getElementById('terminal-pane').style.height = `${newH}px`;
    if (state.monacoReady && monacoEditor) monacoEditor.layout();
  });

  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.userSelect = ''; document.body.style.cursor = ''; }
  });
})();

// ══════════════════════════════════════════════
// AI PANEL
// ══════════════════════════════════════════════
function setAiStatus(msg, color = 'var(--accent-emerald)') {
  const label = document.getElementById('ai-mode-label');
  const dot   = document.getElementById('ai-status-dot');
  if (label) label.textContent = msg;
  if (label) label.style.color = color;
  const dotEl = dot?.querySelector('span:first-child');
  if (dotEl) dotEl.style.background = color;
  const statusEl = document.getElementById('status-ai');
  if (statusEl) statusEl.innerHTML = `🧠 AI <strong>${msg}</strong>`;
}

function updateAiModeLabel() {
  const labels = { mentor: 'Mentor Mode', beginner: 'Beginner Mode', interview: 'Interview Mode' };
  setAiStatus(labels[state.aiMode] || 'Ready');
}

document.querySelectorAll('.ai-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.aiMode = btn.dataset.mode;
    document.querySelectorAll('.ai-mode-btn').forEach(b => b.classList.remove('active-mode'));
    btn.classList.add('active-mode');
    updateAiModeLabel();
    state.conversation = [];
  });
});

function switchAiTab(tab) {
  state.activeAiTab = tab;
  document.querySelectorAll('.ai-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.aiTab === tab);
    t.setAttribute('aria-selected', t.dataset.aiTab === tab);
  });
}

document.querySelectorAll('.ai-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchAiTab(tab.dataset.aiTab);
    const file = getActiveFile();
    if (!file) return;
    if (tab.dataset.aiTab === 'mentor') renderMentorPanel();
    else if (tab.dataset.aiTab === 'vars') renderVarsPanel(file);
    else if (tab.dataset.aiTab === 'viz') renderVizPanel(file);
  });
});

// ── AI Content Builders ───────────────────────
function renderAiContent(html) {
  const el = document.getElementById('ai-content');
  if (el) { el.innerHTML = html; }
}

function renderAiLoading() {
  renderAiContent(`
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px 20px">
      <div style="width:36px;height:36px;border:3px solid var(--border-subtle);border-top-color:var(--accent-primary);border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <div style="font-size:13px;color:var(--text-muted)">Analyzing your code…</div>
    </div>
  `);
  setAiStatus('Analyzing…', 'var(--accent-amber)');
}

function renderAiError(msg) {
  renderAiContent(`
    <div class="ai-explanation-block" style="border-color:rgba(244,63,94,0.3);background:rgba(244,63,94,0.05)">
      <div class="ai-block-label" style="color:var(--accent-rose)">⚠ Error</div>
      <div class="ai-block-text">${escHtml(msg)}</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="document.getElementById('run-analysis-btn').click()">↺ Retry</button>
    </div>
  `);
  setAiStatus('Error', 'var(--accent-rose)');
}

// ── Deep Code Analysis (Groq-powered) ───────────────────
async function analyzeCode(file) {
  if (!file) {
    renderAiError('No file selected. Create a file first.');
    return;
  }

  // Always pull the latest content from Monaco
  const code = (state.monacoReady && monacoEditor) ? monacoEditor.getValue() : file.content;
  if (!code.trim()) {
    renderAiError('No code to analyze. Write some code first.');
    return;
  }
  file.content = code;

  // ── Loading state ─────────────────────────────────────
  renderAiLoading();
  setAiStatus('Calling Groq AI…', 'var(--accent-amber)');

  // Build local analysis for the execution timeline (Visualizer still needs it)
  try {
    const localAnalysis = deepAnalyze(file);
    state.execSteps     = buildExecSteps(file, localAnalysis);
    state.execIdx       = 0;
    renderTimeline();
  } catch {}

  // ── POST /api/explain ──────────────────────────────────
  try {
    const language = file.monacoLang || 'unknown';

    const res = await fetch(`${API_BASE}/api/explain`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, language }),
      signal:  AbortSignal.timeout(45000),
    });

    // ── Error state ─────────────────────────────────────────
    if (!res.ok) {
      let errMsg = `Server error ${res.status}.`;
      try {
        const errData = await res.json();
        if (errData.missingKey) {
          renderAiError(
            'Groq API key is not set.\n\n' +
            '1. Get a free key at https://console.groq.com/\n' +
            '2. Open .env and set: GROQ_API_KEY=your_key_here\n' +
            '3. Restart the server: npm run dev'
          );
          setAiStatus('Key missing', 'var(--accent-rose)');
          return;
        }
        errMsg = errData.error || errMsg;
      } catch {}
      renderAiError(errMsg);
      setAiStatus('Error', 'var(--accent-rose)');
      return;
    }

    // ── Success state ──────────────────────────────────────
    const data = await res.json();
    renderGroqExplainPanel(file, data);
    setAiStatus('Ready', 'var(--accent-emerald)');
    terminalLog('success', `Groq AI analysis complete — ${file.name}`);

  } catch (err) {
    // ── Network / timeout error ────────────────────────────
    let msg = err.message || 'Unknown error';
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      msg = 'Request timed out (45 s). Try a shorter snippet or check your connection.';
    } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ECONNREFUSED')) {
      msg = 'Cannot reach the server.\nIs it running? Start with: npm run dev';
    }
    renderAiError(msg);
    setAiStatus('Error', 'var(--accent-rose)');
    console.error('[CodeLens] AI analysis error:', err);
  }
}

// ── Deep Code Parser (client-side, no backend needed) ──
function deepAnalyze(file) {
  const code  = file.content;
  const lines = code.split('\n');
  const lang  = file.monacoLang || 'plaintext';

  const result = {
    lang,
    lineCount: lines.length,
    charCount: code.length,
    functions: [],
    classes:   [],
    loops:     [],
    conditions:[],
    variables: [],
    imports:   [],
    recursion: false,
    hasArrays: false,
    complexity: { time: 'O(1)', space: 'O(1)' },
    errors:    [],
  };

  lines.forEach((line, i) => {
    const ln = line.trim();
    const lineNum = i + 1;

    // Functions
    const pyFn  = ln.match(/^def\s+([a-zA-Z_]\w*)\s*\(/);
    const jsFn  = ln.match(/^(?:function\s+([a-zA-Z_]\w*)|(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s*)?\(|([a-zA-Z_]\w*)\s*=\s*(?:async\s*)?\()/);
    const cppFn = ln.match(/^(?:int|void|bool|string|float|double|auto|char)\s+([a-zA-Z_]\w*)\s*\(/);
    const javaFn= ln.match(/^(?:public|private|protected|static|\s)*\s+\w+\s+([a-zA-Z_]\w*)\s*\(/);
    const fnName = pyFn?.[1] || jsFn?.[1] || jsFn?.[2] || jsFn?.[3] || cppFn?.[1] || javaFn?.[1];
    if (fnName && fnName !== 'if' && fnName !== 'for' && fnName !== 'while' && fnName !== 'main') {
      result.functions.push({ name: fnName, line: lineNum });
    }

    // Classes
    const cls = ln.match(/^class\s+([a-zA-Z_]\w*)/);
    if (cls) result.classes.push({ name: cls[1], line: lineNum });

    // Loops
    if (/^(for|while|do)\b/.test(ln)) result.loops.push({ type: ln.split(/\s/)[0], line: lineNum });

    // Conditions
    if (/^(if|else\s+if|elif|switch)\b/.test(ln)) result.conditions.push({ line: lineNum });

    // Variables
    const pyVar  = ln.match(/^([a-zA-Z_]\w*)\s*=(?!=)\s*(.+)/);
    const cppVar = ln.match(/^(?:int|float|double|string|bool|char|auto)\s+([a-zA-Z_]\w*)\s*(?:=\s*(.+))?;/);
    if (pyVar && !/^(if|else|while|for|def|class|return|import|from|pass|break|continue)/.test(ln)) {
      result.variables.push({ name: pyVar[1], value: pyVar[2]?.trim().substring(0,30), line: lineNum });
    }
    if (cppVar) result.variables.push({ name: cppVar[1], value: cppVar[2]?.trim().substring(0,30), line: lineNum });

    // Imports
    if (/^(import|#include|using|from|require|use\s)/.test(ln)) result.imports.push({ text: ln, line: lineNum });

    // Arrays
    if (/\[/.test(ln) || /vector|array|list\b/.test(ln)) result.hasArrays = true;

    // Recursion detection
    result.functions.forEach(fn => {
      if (fn.name && ln.includes(fn.name + '(') && lineNum > fn.line) result.recursion = true;
    });
  });

  // Complexity inference
  const loopDepth = Math.max(1, result.loops.length);
  if (result.recursion) {
    result.complexity = { time: 'O(2ⁿ)', space: 'O(n)' };
  } else if (loopDepth >= 3) {
    result.complexity = { time: 'O(n³)', space: 'O(1)' };
  } else if (loopDepth >= 2) {
    result.complexity = { time: 'O(n²)', space: 'O(1)' };
  } else if (loopDepth === 1) {
    result.complexity = { time: 'O(n)', space: 'O(1)' };
  }
  if (result.hasArrays && !result.recursion) result.complexity.space = 'O(n)';

  return result;
}

// ── Render Explain Panel ──────────────────────
function renderExplainPanel(file, a) {
  const modeBlock = {
    mentor:    `<div class="ai-mode-note mentor-note">🧑‍🏫 <strong>Mentor Mode:</strong> I'll guide your thinking, not just give answers. Ask me follow-up questions below!</div>`,
    beginner:  `<div class="ai-mode-note beginner-note">🌱 <strong>Beginner Mode:</strong> I'll explain everything in plain, simple language. No jargon!</div>`,
    interview: `<div class="ai-mode-note interview-note">🎯 <strong>Interview Mode:</strong> Evaluating this code the way a FAANG interviewer would.</div>`,
  }[state.aiMode] || '';

  const fnList  = a.functions.length ? a.functions.map(f => `<span class="chip" style="font-family:var(--font-mono)">${f.name}()</span>`).join(' ') : '<span style="color:var(--text-muted)">None detected</span>';
  const clsList = a.classes.length   ? a.classes.map(c => `<span class="chip" style="font-family:var(--font-mono)">${c.name}</span>`).join(' ')    : '<span style="color:var(--text-muted)">None</span>';
  const impList = a.imports.length   ? a.imports.map(i => `<div style="font-family:var(--font-mono);font-size:11px;color:var(--accent-cyan)">${escHtml(i.text.substring(0,50))}</div>`).join('') : '<span style="color:var(--text-muted)">None</span>';

  const timeColor  = a.complexity.time.startsWith('O(2') ? 'var(--accent-rose)' : a.complexity.time === 'O(n²)' ? 'var(--accent-amber)' : 'var(--accent-emerald)';
  const spaceColor = a.complexity.space === 'O(1)' ? 'var(--accent-emerald)' : 'var(--accent-amber)';

  const begEx = state.aiMode === 'beginner'
    ? `<div class="ai-explanation-block" style="border-color:rgba(16,185,129,0.2)">
        <div class="ai-block-label" style="color:var(--accent-emerald)">📖 Plain English</div>
        <div class="ai-block-text">
          Think of your code like a recipe. ${a.functions.length ? `The <strong>functions</strong> are the recipe steps.` : ''} 
          ${a.loops.length ? `The <strong>loops</strong> mean "do this again and again until we're done".` : ''} 
          ${a.recursion ? `<strong>Recursion</strong> means the recipe calls itself — like a mirror reflecting a mirror! It can be powerful but needs a stopping condition (base case) or it loops forever.` : ''}
        </div>
      </div>` : '';

  const intEx = state.aiMode === 'interview'
    ? `<div class="ai-explanation-block" style="border-color:rgba(245,158,11,0.2)">
        <div class="ai-block-label" style="color:var(--accent-amber)">🎯 Interview Evaluation</div>
        <div class="ai-block-text">
          <ul style="list-style:disc;padding-left:16px;display:flex;flex-direction:column;gap:5px">
            <li>Time complexity is <strong style="color:${timeColor}">${a.complexity.time}</strong> — ${a.complexity.time === 'O(n²)' ? 'watch for this in large inputs; interviewer will ask if you can do better.' : a.complexity.time.startsWith('O(2') ? 'exponential — definitely needs optimization with memoization or DP.' : 'acceptable for most cases.'}</li>
            <li>Code structure: ${a.functions.length > 0 ? '✅ Good use of functions' : '⚠ No function decomposition — refactor into helper functions for production code'}.</li>
            <li>Edge cases to mention: empty input, single element, negative numbers, overflow.</li>
            <li>Follow-up question to expect: "Can this be done in ${a.complexity.time === 'O(n²)' ? 'O(n log n)' : 'O(1) space'}?"</li>
          </ul>
        </div>
      </div>` : '';

  renderAiContent(`
    ${modeBlock}

    <div class="ai-explanation-block">
      <div class="ai-block-label">📋 Summary</div>
      <div class="ai-block-text">
        <strong style="color:var(--text-primary)">${file.lang}</strong> · ${a.lineCount} lines · ${a.charCount} chars
        ${a.functions.length ? `· <strong style="color:var(--accent-blue)">${a.functions.length} function${a.functions.length>1?'s':''}</strong>` : ''}
        ${a.loops.length     ? `· <strong style="color:var(--accent-cyan)">${a.loops.length} loop${a.loops.length>1?'s':''}</strong>` : ''}
        ${a.recursion        ? `· <strong style="color:var(--accent-amber)">Recursion detected</strong>` : ''}
        ${a.classes.length   ? `· <strong style="color:var(--accent-emerald)">${a.classes.length} class${a.classes.length>1?'es':''}</strong>` : ''}
      </div>
    </div>

    <div class="ai-explanation-block">
      <div class="ai-block-label">⚡ Complexity</div>
      <div class="ai-block-text">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="background:var(--bg-overlay);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">TIME</div>
            <div style="font-family:var(--font-mono);font-weight:700;font-size:16px;color:${timeColor}">${a.complexity.time}</div>
          </div>
          <div style="background:var(--bg-overlay);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">SPACE</div>
            <div style="font-family:var(--font-mono);font-weight:700;font-size:16px;color:${spaceColor}">${a.complexity.space}</div>
          </div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">
          ${a.recursion ? '⚠ Exponential time. Consider memoization or dynamic programming.' :
            a.loops.length >= 2 ? `Nested loops detected (${a.loops.length}). Check if O(n²) is avoidable for your use case.` :
            a.loops.length === 1 ? 'Linear pass. Good for most practical inputs.' :
            'Constant time — no loops or recursion detected.'}
        </div>
      </div>

    <div class="ai-explanation-block" style="border-color:rgba(244,63,94,0.2);background:rgba(244,63,94,0.04)">
      <div class="ai-block-label" style="color:var(--accent-rose)">⚠ Common Mistakes</div>
      <div class="ai-block-text">
        <ul style="list-style:disc;padding-left:16px;display:flex;flex-direction:column;gap:5px;font-size:13px">
          ${a.loops.length ? '<li>Off-by-one errors in loop bounds — always verify start/end conditions</li>' : ''}
          ${a.recursion ? '<li>Missing base case — will cause stack overflow on large inputs</li>' : ''}
          ${a.functions.length ? '<li>Not returning a value from non-void functions</li>' : ''}
          <li>Not handling empty input, null, or negative edge cases</li>
          <li>Mutating a collection while iterating over it</li>
        </ul>
      </div>
    </div>

    <div class="ai-explanation-block" style="border-color:rgba(16,185,129,0.2);background:rgba(16,185,129,0.04)">
      <div class="ai-block-label" style="color:var(--accent-emerald)">💡 Suggestions</div>
      <div class="ai-block-text">
        <ul style="list-style:disc;padding-left:16px;display:flex;flex-direction:column;gap:5px;font-size:13px">
          ${a.recursion ? '<li>Add memoization to cache repeated recursive calls</li>' : ''}
          ${a.loops.length >= 2 ? '<li>Consider extracting the inner loop into a helper function for readability</li>' : ''}
          ${!a.functions.length && a.lineCount > 10 ? '<li>Decompose into smaller, named functions for reusability and testing</li>' : ''}
          <li>Add input validation at the beginning of each function</li>
          <li>Write unit tests covering: normal input, edge cases, and large inputs</li>
          <li>Add docstrings / JSDoc comments for every public function</li>
        </ul>
      </div>
    </div>

    <div class="ai-explanation-block">
      <div class="ai-block-label">🔗 Related Concepts</div>
      <div class="ai-block-text">
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${a.recursion ? '<span class="chip">Memoization</span><span class="chip">Dynamic Programming</span><span class="chip">Call Stack</span>' : ''}
          ${a.loops.length ? '<span class="chip">Loop Invariants</span><span class="chip">Iteration</span><span class="chip">Complexity</span>' : ''}
          ${a.hasArrays ? '<span class="chip">Array Traversal</span><span class="chip">Pointer Arithmetic</span>' : ''}
          ${a.classes.length ? '<span class="chip">OOP</span><span class="chip">Encapsulation</span><span class="chip">Polymorphism</span>' : ''}
          <span class="chip">Algorithm Design</span>
          <span class="chip">Code Review</span>
        </div>
      </div>
    </div>

    <div style="font-size:12px;color:var(--text-muted);text-align:center;padding:4px 0 12px">
      Ask a follow-up question in the chat below ↓
    </div>
  `);
}

// ── Variables Panel ───────────────────────────
function renderVarsPanel(file) {
  const a = deepAnalyze(file);
  const uniqueVars = a.variables.filter((v,i,arr) => arr.findIndex(x=>x.name===v.name)===i).slice(0,15);

  renderAiContent(`
    <div class="viz-panel">
      <div class="viz-panel-title">📋 Variables (${uniqueVars.length} detected)</div>
      ${uniqueVars.length ? `
        <table class="var-table">
          <thead><tr><th>Name</th><th>Type</th><th>Value</th><th>Line</th></tr></thead>
          <tbody>${uniqueVars.map(v => `
            <tr>
              <td><span class="var-name">${v.name}</span></td>
              <td><span class="var-type-badge">${inferType(v.value)}</span></td>
              <td style="font-family:var(--font-mono);color:var(--accent-cyan);font-size:11px">${escHtml((v.value||'—').substring(0,20))}</td>
              <td style="color:var(--text-muted)">${v.line}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      ` : '<div style="color:var(--text-muted);font-size:13px">No variable assignments detected.</div>'}
    </div>

    <div class="viz-panel" style="margin-top:12px">
      <div class="viz-panel-title">📚 Call Stack</div>
      <div class="stack-viz">
        <div class="stack-frame"><span class="stack-frame-name">__main__</span><span class="stack-frame-line">entry</span></div>
        ${a.functions.slice(0,3).reverse().map((f,i) => `
          <div class="stack-frame${i===0?' active':''}">
            <span class="stack-frame-name">${f.name}()</span>
            <span class="stack-frame-line">line ${f.line}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="viz-panel" style="margin-top:12px">
      <div class="viz-panel-title">🧩 Memory Snapshot</div>
      <div class="memory-grid">
        ${uniqueVars.slice(0,8).map((v,i) => `
          <div class="memory-cell${i===0?' active':' occupied'}">
            <div class="memory-addr">0x${(0x100+i*4).toString(16).toUpperCase()}</div>
            <div class="memory-val">${escHtml(String(v.name))}</div>
          </div>`).join('')}
        <div class="memory-cell"><div class="memory-addr">…</div><div class="memory-val">—</div></div>
      </div>
    </div>
  `);
}

// ── Visualization Panel ───────────────────────
// ── Visualization Panel — now uses VisualizationEngine ──
function renderVizPanel(file) {
  if (window.Visualizer) {
    const analysis = deepAnalyze(file);
    const execState = {
      stepIdx: state.execIdx,
      steps:   state.execSteps.length
               ? state.execSteps
               : window.Visualizer.buildExecutionTimeline(file.content, file.monacoLang, analysis),
    };
    const container = document.getElementById('ai-content');
    if (container) {
      container.innerHTML = '';
      const engine = new window.Visualizer.VisualizationEngine(container);
      engine.render(file, analysis, execState);
    }
  } else {
    // Fallback to original
    _renderVizPanelLegacy(file);
  }
}

// ── Legacy viz fallback (if visualizer.js fails to load) ──
function _renderVizPanelLegacy(file) {
  renderAiContent(`
    <div class="viz-panel">
      <div class="viz-panel-title">⚠️ Visualization Engine Missing</div>
      <div style="font-size:13px;color:var(--text-secondary);padding:12px">
        The advanced visualization module (<code>visualizer.js</code>) was not detected. Please ensure all scripts are loaded correctly.
      </div>
    </div>
  `);
}

// ── Mentor Panel ──────────────────────────────
function renderMentorPanel() {
  switchAiTab('mentor');
  const existing = document.getElementById('mentor-messages');
  if (existing) return; // Already rendered, just switch tab

  const intros = {
    mentor:    `Hey! I can see you're working on <strong>${getActiveFile()?.name || 'your code'}</strong>. Before I explain anything — <strong style="color:var(--accent-glow)">what do you think this code does?</strong> Take a guess! 💡`,
    beginner:  `Welcome! I'll make sure everything is crystal clear. <strong style="color:var(--accent-emerald)">What part of the code looks confusing?</strong> No question is too basic here 🌱`,
    interview: `Let's treat this like a FAANG interview. <strong style="color:var(--accent-amber)">Walk me through your code's approach</strong> — time complexity, data structures used, and edge cases. 🎯`,
  };

  renderAiContent(`
    <div class="mentor-messages" id="mentor-messages">
      <div class="mentor-msg">
        <div class="mentor-avatar">🔭</div>
        <div class="mentor-bubble">${intros[state.aiMode] || intros.mentor}</div>
      </div>
    </div>
  `);
}

// ── Send AI message ───────────────────────────
const mentorPools = {
  mentor: [
    (file, q) => `Good question! Before I answer: <strong>what do you think happens on line ${getActiveFile()?.content.split('\n').length}?</strong> Reason through it — you likely know more than you think.`,
    (file, q) => `You're close! The key insight is: ${q.toLowerCase().includes('loop') ? 'every loop has an <strong>invariant</strong> — a property that stays true each iteration. Can you identify it?' : q.toLowerCase().includes('recursion') ? 'recursion needs two things: a <strong>base case</strong> and a <strong>recursive step</strong>. Which is missing or wrong in yours?' : '<strong>what would happen if you traced through with a specific example?</strong> Try input [3, 1, 2].'}`,
    () => `That's exactly the right instinct. Now push further: <strong>what happens at the boundary cases?</strong> Empty input, single element, already sorted, reversed — does your code handle all of these?`,
    () => `Perfect reasoning! One final challenge: <strong>can you reduce the complexity by one level?</strong> If it's O(n²), aim for O(n log n). What data structure or technique would help?`,
    () => `You've mastered this concept! Apply it: <strong>write a unit test</strong> that would catch a bug in this code. What edge case would expose a failure?`,
  ],
  beginner: [
    () => `Great question! Think of it like this: a variable is just a named box that holds a value. When we say <code>x = 5</code>, we're putting the number 5 into a box called "x". Does that make sense?`,
    () => `No worries at all! Loops are just instructions that say "do this again and again until a condition is false" — like telling someone to keep stirring a pot until the soup boils. 🍲`,
    () => `You're doing great! Functions are mini-programs inside your program. They take input, do something specific, and return output — just like a vending machine: you put in coins (input) and get a snack (output) 🎰`,
    () => `Excellent progress! You're thinking like a programmer now. The next step is to trace through your code with a simple example like [1, 2, 3] and write down what each variable holds at each step.`,
    () => `Brilliant! You've got the core idea. Remember: the best programmers aren't the ones who memorize everything — they're the ones who know how to think through problems step by step. You're doing that! 🎉`,
  ],
  interview: [
    (file, q) => `Good, but be precise. An interviewer would ask: <strong>what is the exact time complexity and why?</strong> Walk through your reasoning using Big O notation, not just the answer.`,
    () => `Correct! Now the follow-up: <strong>how does this scale to 10⁶ elements?</strong> Will your solution TLE (Time Limit Exceeded)? What would you optimize first?`,
    () => `Solid answer. A senior interviewer would push further: <strong>what are the space-time trade-offs of your approach vs. a hash map approach?</strong> When would you choose each?`,
    () => `That's production-level thinking. Now: <strong>how would you test this in a real codebase?</strong> List at least 5 test cases — include happy path, edge cases, and adversarial inputs.`,
    () => `Excellent! You've covered the critical points. To close the loop: <strong>can you write the optimized version in pseudocode?</strong> Then we can discuss implementation details.`,
  ],
};

let _mentorIdx = 0;

function handleMentorSend(msg) {
  if (!msg.trim()) return;

  switchAiTab('mentor');
  if (!document.getElementById('mentor-messages')) renderMentorPanel();

  setTimeout(() => {
    const messages = document.getElementById('mentor-messages');
    if (!messages) return;

    state.conversation.push({ role: 'user', content: msg });

    messages.insertAdjacentHTML('beforeend', `
      <div class="mentor-msg user-msg" style="animation:fade-up .3s ease both">
        <div class="user-avatar">👤</div>
        <div class="user-bubble">${escHtml(msg)}</div>
      </div>`);

    const typingId = `t_${Date.now()}`;
    messages.insertAdjacentHTML('beforeend', `
      <div class="mentor-msg" id="${typingId}">
        <div class="mentor-avatar">🔭</div>
        <div class="mentor-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
      </div>`);

    const content = document.getElementById('ai-content');
    if (content) content.scrollTop = content.scrollHeight;

    // Compute reply delay based on message length (feels natural)
    const delay = 700 + Math.min(msg.length * 8, 1200);

    setTimeout(() => {
      const typing = document.getElementById(typingId);
      if (typing) typing.remove();

      let reply;
      if (window.AIEngine) {
        // Use new context-aware AI engine
        const file     = getActiveFile();
        const analysis = file ? deepAnalyze(file) : { functions:[], loops:[], variables:[], conditions:[], recursion:false, hasArrays:false, complexity:{time:'O(1)',space:'O(1)'}, lineCount:0 };
        reply = window.AIEngine.generateAIResponse(
          msg,
          file,
          analysis,
          state.aiMode,
          state.conversation
        );
      } else {
        // Legacy fallback
        const pool  = mentorPools[state.aiMode] || mentorPools.mentor;
        reply = pool[_mentorIdx % pool.length](getActiveFile(), msg);
        _mentorIdx++;
      }

      state.conversation.push({ role: 'assistant', content: reply });

      messages.insertAdjacentHTML('beforeend', `
        <div class="mentor-msg" style="animation:fade-up .3s ease both">
          <div class="mentor-avatar">🔭</div>
          <div class="mentor-bubble">${reply}</div>
        </div>`);

      if (content) content.scrollTop = content.scrollHeight;
    }, delay);
  }, state.activeAiTab !== 'mentor' ? 150 : 0);
}

const mentorInput   = document.getElementById('mentor-input');
const mentorSendBtn = document.getElementById('mentor-send-btn');

function doSend() {
  if (!mentorInput) return;
  const msg = mentorInput.value.trim();
  if (!msg) return;
  mentorInput.value = '';
  handleMentorSend(msg);
}

mentorSendBtn?.addEventListener('click', doSend);
mentorInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });

// ── Analyze button ─────────────────────────────
document.getElementById('run-analysis-btn')?.addEventListener('click', () => {
  const file = getActiveFile();
  if (!file) { openNewFileDialog(); return; }
  if (!file.content.trim()) {
    if (state.monacoReady && monacoEditor) file.content = monacoEditor.getValue();
    if (!file.content.trim()) { alert('Please write some code first, then click Analyze.'); return; }
  }
  switchAiTab('explain');
  analyzeCode(file);
});

// ── Visualize button ───────────────────────────
document.getElementById('visualize-btn')?.addEventListener('click', () => {
  const file = getActiveFile();
  if (!file) { openNewFileDialog(); return; }
  if (state.monacoReady && monacoEditor) file.content = monacoEditor.getValue();
  if (!file.content.trim()) { alert('Please write some code first.'); return; }
  switchAiTab('viz');
  renderVizPanel(file);
  const a = deepAnalyze(file);
  state.execSteps = buildExecSteps(file, a);
  state.execIdx   = 0;
  renderTimeline();
  setTimeout(() => {
    const btn = document.getElementById('tl-play');
    if (btn) btn.click();
  }, 300);
});

// ── Quick action buttons ───────────────────────
document.getElementById('quick-explain-btn')?.addEventListener('click', () => document.getElementById('run-analysis-btn')?.click());
document.getElementById('quick-complexity-btn')?.addEventListener('click', () => document.getElementById('run-analysis-btn')?.click());
document.getElementById('quick-suggest-btn')?.addEventListener('click', () => document.getElementById('run-analysis-btn')?.click());

document.getElementById('ai-clear-btn')?.addEventListener('click', () => {
  state.conversation = [];
  _mentorIdx = 0;
  renderAiContent(document.getElementById('ai-welcome')?.outerHTML || '');
  switchAiTab('explain');
});

// ══════════════════════════════════════════════
// EXECUTION TIMELINE
// ══════════════════════════════════════════════
function buildExecSteps(file, analysis) {
  const lines = file.content.split('\n');
  const steps = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;
    if (steps.length >= 20) return;

    let label = `Ln ${i+1}`;
    if (/^def\s/.test(trimmed) || /^function\s/.test(trimmed)) label = `Define fn`;
    else if (/^for\s/.test(trimmed) || /^for\s*\(/.test(trimmed))   label = `Loop start`;
    else if (/^while\s/.test(trimmed))                               label = `While loop`;
    else if (/^if\s/.test(trimmed) || /^if\s*\(/.test(trimmed))     label = `Condition`;
    else if (/^return\s/.test(trimmed))                              label = `Return`;
    else if (/=(?!=)/.test(trimmed))                                 label = `Assign`;
    else if (/print\(|cout|printf/.test(trimmed))                    label = `Output`;

    steps.push({ lineNum: i + 1, code: trimmed.substring(0,30), label });
  });

  return steps.length ? steps : [{ lineNum: 1, code: '(empty)', label: 'No steps' }];
}

function resetTimeline() {
  state.execSteps  = [];
  state.execIdx    = 0;
  state.execPlaying= false;
  clearInterval(state.execTimer);
  renderTimeline();
}

function renderTimeline() {
  const progress = document.getElementById('timeline-progress');
  const label    = document.getElementById('tl-step-label');
  const stepsEl  = document.getElementById('timeline-steps');
  const total    = state.execSteps.length;
  const idx      = state.execIdx;

  const pct = total > 0 ? ((idx + 1) / total) * 100 : 0;
  if (progress) progress.style.width = `${pct}%`;
  if (label)    label.textContent    = total > 0 ? `Step ${idx + 1} / ${total}` : 'No steps';

  if (stepsEl) {
    stepsEl.innerHTML = state.execSteps.map((s, i) =>
      `<div class="timeline-step${i === idx ? ' active' : ''}" data-i="${i}">${s.label}</div>`
    ).join('');
    stepsEl.querySelectorAll('.timeline-step').forEach(el => {
      el.addEventListener('click', () => { state.execIdx = parseInt(el.dataset.i); renderTimeline(); highlightLine(); });
    });
  }

  highlightLine();
}

function highlightLine() {
  const step = state.execSteps[state.execIdx];
  if (!step || !state.monacoReady || !monacoEditor) return;
  monacoEditor.revealLineInCenter(step.lineNum);
  // Highlight the line (decorations)
  monacoEditor.deltaDecorations(
    monacoEditor.getModel()?._execDecorations || [],
    [{
      range: new monaco.Range(step.lineNum, 1, step.lineNum, 1),
      options: {
        isWholeLine: true,
        className: 'exec-line-highlight',
        glyphMarginClassName: 'exec-line-glyph',
      }
    }]
  );
}

document.getElementById('tl-prev')?.addEventListener('click', () => {
  if (state.execIdx > 0) { state.execIdx--; renderTimeline(); }
});
document.getElementById('tl-next')?.addEventListener('click', () => {
  if (state.execIdx < state.execSteps.length - 1) { state.execIdx++; renderTimeline(); }
});
document.getElementById('tl-play')?.addEventListener('click', function() {
  state.execPlaying = !state.execPlaying;
  this.innerHTML = state.execPlaying ? '⏸ Pause' : '▶ Run';
  if (state.execPlaying) {
    if (!state.execSteps.length) {
      const file = getActiveFile();
      if (file) { const a = deepAnalyze(file); state.execSteps = buildExecSteps(file, a); state.execIdx = 0; }
    }
    state.execTimer = setInterval(() => {
      if (state.execIdx >= state.execSteps.length - 1) {
        clearInterval(state.execTimer); state.execPlaying = false;
        document.getElementById('tl-play').innerHTML = '▶ Run';
      } else {
        state.execIdx++;
        renderTimeline();
      }
    }, 700);
  } else {
    clearInterval(state.execTimer);
  }
});

document.getElementById('timeline-track')?.addEventListener('click', e => {
  const rect = e.currentTarget.getBoundingClientRect();
  state.execIdx = Math.round(((e.clientX - rect.left) / rect.width) * Math.max(0, state.execSteps.length - 1));
  renderTimeline();
});

// ══════════════════════════════════════════════
// COMMAND PALETTE
// ══════════════════════════════════════════════
const COMMANDS = [
  { icon:'📄', label:'New File',              sub:'Create a new file (Ctrl+N)',         action: openNewFileDialog,                        kbd:['Ctrl','N'] },
  { icon:'💾', label:'Save All',              sub:'Save all open files (Ctrl+S)',        action: saveAll,                                  kbd:['Ctrl','S'] },
  { icon:'🧠', label:'Analyze Code',          sub:'Run AI analysis on current file',    action: () => document.getElementById('run-analysis-btn')?.click(), kbd:['Ctrl','A'] },
  { icon:'▶',  label:'Visualize',             sub:'Start visual execution (Ctrl+R)',     action: () => document.getElementById('visualize-btn')?.click(),     kbd:['Ctrl','R'] },
  { icon:'⊟',  label:'Toggle Terminal',       sub:'Show/hide the terminal panel',       action: toggleTerminal,                           kbd:['Ctrl','`'] },
  { icon:'💬', label:'Open Mentor Chat',      sub:'Ask your AI programming mentor',     action: () => { switchAiTab('mentor'); renderMentorPanel(); }         },
  { icon:'📊', label:'Show Variables',        sub:'View variable state panel',          action: () => { const f=getActiveFile(); if(f){switchAiTab('vars'); renderVarsPanel(f);} } },
  { icon:'🌱', label:'Beginner Mode',         sub:'AI explains in plain English',       action: () => document.getElementById('mode-beginner')?.click()       },
  { icon:'🎯', label:'Interview Mode',        sub:'FAANG-style AI coaching',            action: () => document.getElementById('mode-interview')?.click()      },
  { icon:'🏠', label:'Go to Landing Page',    sub:'Return to CodeLens homepage',        action: () => { window.location.href='index.html'; }                   },
  { icon:'⬜', label:'Clear Editor',          sub:'Clear current file content',         action: () => document.getElementById('editor-clear-btn')?.click()    },
  { icon:'↺',  label:'Reset Timeline',        sub:'Reset execution timeline',           action: resetTimeline                                                  },
];

let _cmdIdx = 0, _cmdFiltered = [...COMMANDS];

function openCmdPalette() {
  document.getElementById('cmd-overlay')?.classList.add('open');
  const input = document.getElementById('cmd-input');
  if (input) { input.value = ''; input.focus(); }
  _cmdIdx = 0; _cmdFiltered = [...COMMANDS];
  renderCmds('');
}
function closeCmdPalette() { document.getElementById('cmd-overlay')?.classList.remove('open'); }

function renderCmds(q) {
  q = q.toLowerCase();
  _cmdFiltered = COMMANDS.filter(c => c.label.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q));
  const el = document.getElementById('cmd-results');
  if (!el) return;
  if (!_cmdFiltered.length) { el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No commands found</div>'; return; }
  el.innerHTML = _cmdFiltered.map((c,i) => `
    <div class="cmd-item${i===_cmdIdx?' selected':''}" data-i="${i}" role="option">
      <div class="cmd-item-icon">${c.icon}</div>
      <div style="flex:1"><div class="cmd-item-label">${c.label}</div><div class="cmd-item-sub">${c.sub}</div></div>
      ${c.kbd ? `<div class="cmd-item-kbd">${c.kbd.map(k=>`<span class="kbd">${k}</span>`).join('')}</div>` : ''}
    </div>`).join('');
  el.querySelectorAll('.cmd-item').forEach(item => item.addEventListener('click', () => { closeCmdPalette(); setTimeout(() => _cmdFiltered[parseInt(item.dataset.i)]?.action(), 50); }));
}

document.getElementById('cmd-input')?.addEventListener('input', e => { _cmdIdx=0; renderCmds(e.target.value); });
document.getElementById('cmd-input')?.addEventListener('keydown', e => {
  if (e.key==='ArrowDown')  { e.preventDefault(); _cmdIdx=Math.min(_cmdIdx+1,_cmdFiltered.length-1); renderCmds(document.getElementById('cmd-input').value); }
  if (e.key==='ArrowUp')    { e.preventDefault(); _cmdIdx=Math.max(_cmdIdx-1,0);                      renderCmds(document.getElementById('cmd-input').value); }
  if (e.key==='Enter')      { closeCmdPalette(); setTimeout(() => _cmdFiltered[_cmdIdx]?.action(), 50); }
  if (e.key==='Escape')     { closeCmdPalette(); }
});
document.getElementById('cmd-overlay')?.addEventListener('click', e => { if (e.target===e.currentTarget) closeCmdPalette(); });
document.getElementById('cmd-palette-btn')?.addEventListener('click', openCmdPalette);

// ══════════════════════════════════════════════
// ICON RAIL
// ══════════════════════════════════════════════
document.querySelectorAll('.rail-btn[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const file = getActiveFile();
    const panel = btn.dataset.panel;
    if (panel === 'viz')    { if (file) { switchAiTab('viz');    renderVizPanel(file); } }
    if (panel === 'mentor') { switchAiTab('mentor'); renderMentorPanel(); }
  });
});

// ══════════════════════════════════════════════
// SAVE SYSTEM
// ══════════════════════════════════════════════
document.getElementById('save-btn')?.addEventListener('click', saveAll);

document.getElementById('editor-clear-btn')?.addEventListener('click', () => {
  if (state.monacoReady && monacoEditor && monacoEditor.getModel()) {
    if (confirm('Clear the editor content?')) {
      monacoEditor.setValue('');
      const file = getActiveFile();
      if (file) { file.content = ''; file.modified = true; scheduleAutosave(); }
    }
  }
});

// ══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key === 'k') { e.preventDefault(); openCmdPalette(); }
  if (mod && e.key === 'n') { e.preventDefault(); openNewFileDialog(); }
  if (mod && e.key === 's') { e.preventDefault(); saveAll(); }
  if (mod && e.key === 'r') { e.preventDefault(); document.getElementById('visualize-btn')?.click(); }
  if (mod && e.key === '`') { e.preventDefault(); toggleTerminal(); }
  if (e.key === 'Escape') { closeCmdPalette(); closeNewFileDialog(); closeRenameDialog(); }
  if (e.altKey && e.key === 'ArrowRight') document.getElementById('tl-next')?.click();
  if (e.altKey && e.key === 'ArrowLeft')  document.getElementById('tl-prev')?.click();
});

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function inferType(val) {
  if (!val) return 'auto';
  if (/^-?\d+$/.test(val)) return 'int';
  if (/^-?\d+\.\d+$/.test(val)) return 'float';
  if (/^["']/.test(val)) return 'str';
  if (/^\[/.test(val)) return 'list';
  if (/^\{/.test(val)) return 'dict';
  if (val==='True'||val==='False'||val==='true'||val==='false') return 'bool';
  return 'auto';
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener('beforeunload', () => { saveToStorage(); });

// Monaco setup runs in initMonaco() which is called after loader.js fires
window.addEventListener('load', () => {
  if (typeof require !== 'undefined') {
    initMonaco();
  } else {
    console.error('[CodeLens] Monaco loader not available. Check CDN connection.');
    terminalLog('error', 'Monaco editor failed to load. Check your internet connection.');
  }
  // Initialize ripples and toast container
  setTimeout(() => {
    if (window.AIEngine?.initRipples) window.AIEngine.initRipples();
  }, 500);
});

