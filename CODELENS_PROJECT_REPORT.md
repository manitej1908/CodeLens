# CodeLens: Comprehensive Engineering & Project-Based Learning Report

**Project Title:** CodeLens — Advanced AI-Powered Multi-Language Online Code Editor & Sandboxed Execution Engine  
**Author / Developer:** CodeLens Engineering Team  
**System Architecture:** Frontend (Vercel / Static CDN) + Backend (Express.js / Render Docker Container) + AI Engine (Groq Llama-3.3-70B) + Multi-Language Runtime (Python, C++, C, Java, Node.js)  
**Date:** July 2026  
**Document Purpose:** Complete Engineering Walkthrough, Technical Specification, & Project-Based Learning (PBL) Study Guide  

---

## Table of Contents
1. [Executive Summary & Educational Objectives](#1-executive-summary--educational-objectives)
2. [End-to-End System Architecture & Data Flow](#2-end-to-end-system-architecture--data-flow)
3. [Frontend Engineering: The Virtual Workspace & Monaco Editor](#3-frontend-engineering-the-virtual-workspace--monaco-editor)
4. [Backend Engineering: Sandboxed Multi-Language Execution Engine](#4-backend-engineering-sandboxed-multi-language-execution-engine)
5. [Error Sanitization & Structured Diagnostic Pipeline](#5-error-sanitization--structured-diagnostic-pipeline)
6. [AI Integration Engine: Groq Llama-3.3-70B Versatile](#6-ai-integration-engine-groq-llama-33-70b-versatile)
7. [Cloud Persistence & Session-Based Storage Architecture](#7-cloud-persistence--session-based-storage-architecture)
8. [DevOps & Cloud Deployment: Dockerization, Vercel & Render](#8-devops--cloud-deployment-dockerization-vercel--render)
9. [Project-Based Learning (PBL) Study Guide & Core Engineering Concepts](#9-project-Based-learning-pbl-study-guide--core-engineering-concepts)

---

## 1. Executive Summary & Educational Objectives

### What is CodeLens?
CodeLens is a state-of-the-art, web-based Integrated Development Environment (IDE) designed to bridge the gap between traditional online code runners and advanced AI coding assistants. Unlike simple web run-boxes that merely echo raw terminal output, CodeLens provides a **deeply structured, highly visual, and educational coding experience**. It empowers software engineering students, educators, and developers to write, compile, execute, debug, and understand code across **five major programming languages** (Python, C++, C, Java, and JavaScript) in a secure, sandboxed cloud runtime.

### Why Project-Based Learning (PBL)?
Building an online IDE from scratch touches every layer of modern software engineering. By studying or recreating CodeLens, an engineer learns:
1. **Frontend Virtualization & AMD Module Loading:** Integrating industry-standard editor engines (`monaco-editor` used by VS Code) inside standard web applications without heavy bundlers.
2. **Subprocess & OS Execution Management:** Safely spawning child processes (`child_process.spawn`) to invoke native system compilers (`gcc`, `g++`, `javac`) and interpreters (`python3`, `java`, `node`) while enforcing execution timeouts and memory safety.
3. **Complex Regular Expression Error Parsing:** Translating cryptic compiler stack traces into human-readable line numbers, column numbers, and actionable suggestions.
4. **Large Language Model (LLM) Systems Engineering:** Designing strict system prompts that force LLMs (`llama-3.3-70b-versatile` via Groq) to output reliable, deeply structured JSON rather than unstructured text.
5. **Containerization & Cloud Infrastructure:** Using Docker to encapsulate multi-language toolchains (`OpenJDK 17`, `GCC`, `Python 3`, `Node.js`) into reproducible, cloud-agnostic deployment units.

---

## 2. End-to-End System Architecture & Data Flow

CodeLens operates on a **decoupled, stateless client-server topology** where the frontend acts as a responsive virtual file system and editor, while the backend serves as a secure compute and AI proxy engine.

```
+-----------------------------------------------------------------------------------+
|                              CLIENT TIER (Browser / Vercel)                       |
|  +---------------------+  +----------------------+  +--------------------------+  |
|  |   Monaco Editor     |  | Virtual File System  |  |  Terminal & AI Panels    |  |
|  |  (Code Highlighting |  |  (state.files +      |  |  (Collapsible Cards,     |  |
|  |   & Autocomplete)   |  |   localStorage sync) |  |   Structured AI Output)  |  |
|  +----------+----------+  +----------+-----------+  +-------------+------------+  |
+-------------|------------------------|----------------------------|---------------+
              |                        |                            |
              | [POST /api/run]        | [POST /api/save]           | [POST /api/explain]
              | {code, lang, stdin}    | {files, sessionId}         | [POST /api/mentor]
              v                        v                            v
+-----------------------------------------------------------------------------------+
|                        BACKEND TIER (Express.js / Render Docker)                  |
|  +-----------------------------------------------------------------------------+  |
|  |                           Express.js Router Middleware                      |  |
|  |                 (CORS, Body-Parser 50MB limit, Error Trapping)              |  |
|  +---------------------+---------------------+---------------------------------+  |
|                        |                     |                                    |
|         +--------------v--------------+      +-----------------v---------------+  |
|         |   Multi-Language Execution  |      |         Groq AI Proxy           |  |
|         |      (runRouter - run.js)   |      |  (explain.js & mentor.js routes)|  |
|         +--------------+--------------+      +-----------------+---------------+  |
|                        |                                       |                  |
|         +--------------v--------------+                        |                  |
|         |  OS Temporary Sandbox Dir   |                        | [Secure API Call]|
|         |   (/tmp/codelens_run_xxxx)  |                        | (Never Exposed   |
|         +--------------+--------------+                        |  to Client)      |
|                        |                                       v                  |
|      +-----------------+-----------------+            +------------------------+  |
|      |                 |                 |            |   Groq Cloud API       |  |
|      v                 v                 v            | (Llama-3.3-70B Model)  |  |
|  [python3]         [gcc/g++]      [javac + java]      +------------------------+  |
|  (main.py)         (main.cpp)      (Main.java)                                    |
+-----------------------------------------------------------------------------------+
```

### Security & API Isolation Principle
A fundamental architectural requirement of CodeLens is that **secrets (`GROQ_API_KEY`) must never touch the client browser**. The frontend communicates with the backend using relative or dynamic endpoints (`API_BASE`). The backend injects the secret API key into outgoing server-to-server HTTP requests to Groq Cloud. Even if a malicious user inspects network traffic or browser source code, the API key remains 100% hidden inside the server environment.

---

## 3. Frontend Engineering: The Virtual Workspace & Monaco Editor

### 3.1 Monaco Editor Initialization & Custom Theme
VS Code’s core editor engine (`monaco-editor`) is loaded asynchronously via AMD Loader (`require(['vs/editor/editor.main'])`). Instead of using standard themes, CodeLens registers a custom, high-contrast dark theme named `codelens-dark`:

```javascript
monaco.editor.defineTheme('codelens-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',     foreground: '546e7a', fontStyle: 'italic' },
    { token: 'keyword',     foreground: 'c792ea', fontStyle: 'bold' },
    { token: 'string',      foreground: 'c3e88d' },
    { token: 'number',      foreground: 'f78c6c' },
    { token: 'function',    foreground: '82aaff' },
    { token: 'variable',    foreground: 'f07178' },
  ],
  colors: {
    'editor.background': '#080b14',
    'editorLineNumber.activeForeground': '#7c6ee8',
    'editorCursor.foreground': '#7c6ee8',
    'editor.selectionBackground': '#7c6ee840',
  }
});
```

### 3.2 In-Memory Virtual File System (`state.files`)
Since browser applications cannot directly access the user's local hard drive without explicit File System Access permissions, CodeLens implements an **In-Memory Virtual File System** backed by `localStorage` persistence.

- **File Data Structure:** Every open file is represented as an object:
  ```javascript
  {
    id: "f_172103849102",      // Unique sequence-generated ID
    name: "Main.java",         // User-facing file name
    lang: "Java",              // Display label
    ext: ".java",              // Extension used for compilation rules
    icon: "☕",                // Visual file tree icon
    monacoLang: "java",        // Monaco syntax identifier
    content: "public class...",// Raw code string
    modified: false            // Dirty state flag (*)
  }
  ```
- **Monaco Model Mapping (`monacoModels`)**: To ensure instant, zero-lag tab switching, each file maintains its own isolated `monaco.editor.ITextModel`. When a user clicks a file tab, CodeLens calls `monacoEditor.setModel(monacoModels[file.id])` along with restoring cursor position and scroll view states (`monacoViewStates[id]`).

### 3.3 Dynamic Execution State & Terminal Logging
When the user clicks the **Run** button (`Ctrl+Enter`), the frontend dynamically checks whether the active language requires compilation before execution:

```javascript
const langKey = String(file.monacoLang || file.ext?.replace('.','') || 'python').toLowerCase();
const isCompileLang = langKey === 'cpp' || langKey === 'c++' || langKey === 'c' || langKey === 'java';

if (isCompileLang) {
  terminalLog('info', 'Compiling...');
} else {
  terminalLog('info', 'Running...');
}
```
This UI feedback (`Compiling...` vs `Running...`) provides critical mental models for students to distinguish between **compile-time errors** (syntax, type checking) and **runtime errors** (exceptions, segmentation faults).

---

## 4. Backend Engineering: Sandboxed Multi-Language Execution Engine

The execution engine (`server/routes/run.js`) is the technical heart of CodeLens. When a request arrives at `POST /api/run`, the backend performs an atomic, multi-step lifecycle:

```
[POST /api/run Request]
       |
       v
1. Create Isolated Directory: fs.promises.mkdtemp(os.tmpdir() + '/codelens_run_')
       |
       v
2. Write Code to Disk: writeFile(/tmp/codelens_run_xxxx/Main.java, code)
       |
       +---> [If Java/C++] ---> Step 2A: Compile Subprocess (`javac` / `g++`)
       |                             |
       |                             +-- (Fail) -> Sanitize & Return Compile Error JSON
       |                             +-- (Pass) -> Proceed to Step 2B
       v
3. Execute Subprocess: child_process.spawn / execFile (`java` / `python3` / `./a.out`)
       |-- Inject `stdin` stream via child.stdin.write(stdin)
       |-- Start Timeout Timer (EXEC_TIMEOUT_MS = 10,000 ms)
       v
4. Collect Output & Traps: Capture `stdout`, `stderr`, and `exitCode`
       |
       v
5. Cleanup & Safety: try/finally -> rm(tmpDir, { recursive: true, force: true })
       |
       v
[Return Structured JSON to Client]
```

### 4.1 Why Temporary Directories (`mkdtemp`) are Essential
If all user code were written to a static file like `/app/main.py` or `/app/Main.java`, two concurrent users running code simultaneously would overwrite each other's files, causing severe race conditions and corrupted outputs.
By using `fs.promises.mkdtemp(path.join(os.tmpdir(), 'codelens_run_'))`, the operating system guarantees an **atomic, guaranteed-unique directory** (`/tmp/codelens_run_a8f9d2`) for every single execution request.

### 4.2 Language-Specific Compilation & Execution Rules

#### A. Java (`Main.java`) — Two-Step Execution Pipeline
In Java, public classes must reside in files matching the class name exactly. CodeLens saves Java code as `Main.java` inside the temporary directory.
1. **Compilation Step (`javac`):**
   ```javascript
   const compRes = await runCommand('javac', [codePath], { cwd: tmpDir, timeout: 10000 });
   ```
   If `compRes.exitCode !== 0` or `compRes.stderr` contains `error:`, compilation halts immediately. The raw compiler output (`Main.java:5: error: cannot find symbol`) is passed to `processError()` and returned as `errorType: 'compile'`.
2. **Execution Step (`java`):**
   ```javascript
   const runRes = await runCommand('java', ['-cp', tmpDir, 'Main'], {
     cwd: tmpDir,
     timeout: EXEC_TIMEOUT_MS,
     input: stdin || ''
   });
   ```
   Notice the `-cp tmpDir` (classpath) argument. This tells the JVM to look inside our temporary sandbox for `Main.class`.

#### B. C++ (`main.cpp`) & C (`main.c`) — Binary Generation
1. **Compilation Step (`g++` / `gcc`):**
   ```javascript
   const compRes = await runCommand('g++', [codePath, '-o', outPath], { cwd: tmpDir, timeout: 10000 });
   ```
2. **Execution Step:** The compiled binary (`./a.out` on Linux/macOS or `main.exe` on Windows) is spawned directly inside the temporary sandbox.

#### C. Python (`main.py`) & JavaScript (`main.js`) — Interpreted Execution
Since Python and Node.js do not require pre-compilation, the code is written directly to `main.py` or `main.js` and spawned via `python3` / `node` with `stdin` piped directly into `child.stdin`.

### 4.3 Subprocess Safety & Timeout Protection
To prevent runaway scripts (such as infinite loops `while(true){}`) from consuming 100% of server CPU resources, `runCommand()` wraps node's native `child_process` with strict timeout constraints:

```javascript
if (runRes.err && (runRes.err.killed || runRes.err.signal === 'SIGTERM')) {
  runtimeError = `❌ Runtime Error\n\nExecution timed out (${EXEC_TIMEOUT_MS / 1000}s limit exceeded)`;
  exitCode = 124;
  structuredInfo = { 
    errorType: 'runtime', 
    message: 'Execution timed out', 
    suggestion: 'Avoid infinite loops or long blocking calls.' 
  };
}
```

---

## 5. Error Sanitization & Structured Diagnostic Pipeline

One of the most complex engineering challenges in CodeLens is turning cryptic system stack traces into clean, structured educational feedback.

### 5.1 Stripping Compiler & Path Noise (`sanitizeError`)
When `g++` or `javac` encounters an error, it prints full system file paths (`/tmp/codelens_run_8f9a/Main.java:4: error...` or `C:\Users\admin\AppData\Local\Temp\codelens_run_xxx\main.cpp:12:8:`). If displayed to a student, this looks terrifying and confusing.

`sanitizeError()` executes a series of regular expression replacements to strip path prefixes and compiler internals (`mingw`, `/usr/include`, `bits/stdc++.h`):

```javascript
// Strip absolute Windows and Unix paths down to only the filename
sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s:*?"<>|]*\\(Main\.java|main\.(?:cpp|c|py|js))/gi, '$1');
sanitized = sanitized.replace(/\/[^\s:*?"<>|]*\/(Main\.java|main\.(?:cpp|c|py|js))/gi, '$1');

// Filter out internal compiler stack noise not pointing to the user's file
lines = lines.filter(line => {
  const l = line.toLowerCase();
  if (l.includes('mingw') || l.includes('bits/stdc++.h')) return false;
  if ((l.includes('note:') || l.includes('here')) && !l.includes('main.') && !l.includes('Main.java')) return false;
  return true;
});
```

### 5.2 Structured Diagnostic Extraction (`processError`)
`processError()` inspects the sanitized error string with language-specific regex rules to extract **Line Number**, **Column Number**, **Exact Message**, and **Socratic Suggestions**:

#### Java Error Extraction Logic:
```javascript
if (isJava) {
  // Regex: Main.java:4: error: cannot find symbol
  const javaRegex = /(?:Main\.java):(\d+):(?:(\d+):)?\s*(?:(?:fatal\s+)?error|warning):\s*(.+)/i;
  const match = javaRegex.exec(sanitized);
  if (match) {
    line = parseInt(match[1], 10);
    column = match[2] ? parseInt(match[2], 10) : 1;
    message = match[3].trim();
    codeLine = codeLines[line - 1] || '';

    // Automated Educational Suggestions
    if (message.includes('cannot find symbol')) {
      suggestion = "Check variable/method names or verify necessary 'import' statements are included.";
    } else if (message.includes("class Main is public, should be declared in a file named Main.java")) {
      suggestion = "Ensure your public class is named exactly 'Main'.";
    }
  } else {
    // Check for runtime exceptions (e.g. NullPointerException, ArrayIndexOutOfBoundsException)
    for (let el of exLines) {
      if (el.includes('NullPointerException')) {
        suggestion = "Check for objects that may be null before invoking methods or accessing fields on them.";
      } else if (el.includes('ArrayIndexOutOfBoundsException')) {
        suggestion = "Check loop boundaries and array index access to ensure they are within [0, array.length - 1].";
      }
    }
  }
}
```

#### Why Exactly Matching C++ Structure Matters
By ensuring Java, C++, Python, C, and JavaScript all return the exact same JSON schema (`errorType`, `line`, `column`, `message`, `codeLine`, `suggestion`, `compile errors`, `runtime errors`, `exit code`), the frontend UI renders uniform diagnostic banners regardless of the active language.

---

## 6. AI Integration Engine: Groq Llama-3.3-70B Versatile

CodeLens incorporates generative AI not just as a "chat bot," but as a **code analyzer and debugger that outputs strict UI structures**.

### 6.1 The AI Explain Architecture (`POST /api/explain`)
When the user clicks **Analyze Code**, the backend sends the active code and language to `Groq Llama-3.3-70b-versatile` with an intensive `SYSTEM_PROMPT` (`server/routes/explain.js`):

```text
You are CodeLens AI, an expert code analyzer.
You MUST respond ONLY with a valid JSON object matching this exact schema:
{
  "summary": "High-level 1-2 sentence overview",
  "output": "Predicted stdout or behavior",
  "lineByLine": [ { "line": 1, "code": "int main() {", "explanation": "Defines entry point" } ],
  "variables": { "x": "Stores counter value" },
  "functions": [ { "name": "foo", "params": ["int a"], "returns": "void", "purpose": "..." } ],
  "algorithm": "Step-by-step logic description",
  "timeComplexity": "O(N) - single loop over array",
  "spaceComplexity": "O(1) - auxiliary space",
  "dryRun": "Trace of execution step by step",
  "commonMistakes": [ "Forgetting null check" ],
  "suggestions": [ "Use StringBuilder for string concatenation in loops" ],
  "betterApproach": "Alternative optimal approach",
  "relatedConcepts": [ "Hash Tables", "Two Pointers" ],
  "interviewQuestions": [ "How would you optimize this for 10 million items?" ]
}
```

### 6.2 JSON Recovery & Resilience
Since large language models sometimes wrap JSON inside markdown code blocks (` ```json ... ``` `) despite instructions, CodeLens implements resilient extraction logic:

```javascript
function parseAIResponse(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  // Fallback graceful degradation structure
  return { summary: text, timeComplexity: "Unknown", ... };
}
```

### 6.3 AI Mentor Route (`POST /api/mentor`)
The Mentor endpoint maintains **Contextual Conversation Memory**. The frontend sends the entire `conversationHistory` array along with the student's code and question. The backend prompts Groq with Socratic mentoring instructions: *"Guide the student toward the solution with hints, questions, and conceptual explanations rather than just rewriting their complete code."*

---

## 7. Cloud Persistence & Session-Based Storage Architecture

To allow students to save multi-file workspaces across devices without forcing mandatory database user logins, CodeLens implements a **UUID Session-Based Persistence Architecture** (`POST /api/save`).

```
[Frontend localStorage]                      [Backend Server File System]
+--------------------------+                 +----------------------------+
| 'codelens_session_id'    | --(UUIDv4)----> | /data/011e7d27-d0ea-...json|
| '011e7d27-d0ea-4bd5...'  |                 | [ { name: "Main.java",     |
+--------------------------+                 |     content: "public..." } |
                                             | ]                          |
                                             +----------------------------+
```

When a user clicks **Save Workspace (`Ctrl+S`)**:
1. If no `codelens_session_id` exists in `localStorage`, the backend generates a secure `crypto.randomUUID()`.
2. The entire workspace (`state.files`) is serialized to JSON and stored atomically at `data/<sessionId>.json` inside the backend directory.
3. The generated `sessionId` is returned to the client and saved locally. Next time the user opens CodeLens, the frontend can load their saved files instantly using that `sessionId`.

---

## 8. DevOps & Cloud Deployment: Dockerization, Vercel & Render

### 8.1 Why Containerization (`Docker`) is Critical
When deploying Node.js applications to cloud platforms (like Render, Heroku, or AWS), standard **Node environments (`Runtime: Node`) only install Node.js, Python 3, and basic C build tools (`node-gyp` / `gcc`)**. They **do not include OpenJDK (`java` / `javac`)**.

If code execution is attempted on a bare Node runtime, any Java run request throws `FileNotFoundError: [Errno 2] No such file or directory: 'java'`.

By containerizing CodeLens with a custom **`Dockerfile` based on `node:20-bookworm` (Debian 12)**, we guarantee that all required language toolchains exist concurrently:

```dockerfile
# Use official Node.js 20 on Debian Bookworm
FROM node:20-bookworm

# Install OpenJDK 17 (java + javac), Python 3, and build-essential (gcc + g++)
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 8.2 Split Cloud Deployment Topology
CodeLens utilizes a modern **Decoupled Edge + Compute Architecture**:

```
+---------------------------------------------------------------------------------+
|                         GLOBAL INTERNET USER / STUDENT                          |
+----------------------------------------+----------------------------------------+
                                         |
                       [Browser HTTP Request / Static Assets]
                                         v
+---------------------------------------------------------------------------------+
|                        VERCEL EDGE CDN (Frontend Domain)                        |
|                     https://code-lens-gold.vercel.app                           |
|   - Serves HTML (`workspace.html`), CSS (`index.css`), JS (`workspace.js`)      |
|   - Instant global edge caching & zero-cold-start static delivery               |
+----------------------------------------+----------------------------------------+
                                         |
                   [REST API Fetch Requests / API_BASE Route]
               POST https://codelens-xxxx.onrender.com/api/{run,explain,save}
                                         v
+---------------------------------------------------------------------------------+
|                    RENDER DOCKER COMPUTE ENGINE (Backend API)                   |
|                   https://codelens-xxxx.onrender.com (Port 3000)                |
|   - Executes `node server/index.js` inside Debian 12 Docker Container           |
|   - Manages subprocess compilation (`javac`, `g++`, `python3`, `node`)          |
|   - Secures `GROQ_API_KEY` server-side and proxies AI requests to Groq          |
+---------------------------------------------------------------------------------+
```

### 8.3 Render Migration Workflow & URL Preservation Principles
During our DevOps deployment phase, we established critical platform facts regarding cloud migrations:
1. **Immutable Service URLs:** Render assigns unique suffixes (`codelens-vb6o.onrender.com`) upon initial service creation. If you create a *new* Docker Web Service, Render generates a *new* URL (`codelens-docker-xxxx.onrender.com`).
2. **In-Place Docker Switching vs. New Service Creation:** If an existing Render Web Service allows selecting `Docker` in **Settings → Language/Runtime**, switching in-place preserves the exact URL and environment variables without needing frontend modifications. If locked to Node, a new Docker service is spawned, and `API_BASE` in `client/scripts/workspace.js` is updated to point to the new container URL.

---

## 9. Project-Based Learning (PBL) Study Guide & Core Engineering Concepts

For students utilizing CodeLens as an academic capstone or portfolio study project, here is a breakdown of key computer science and systems engineering concepts demonstrated in this codebase:

### 9.1 Core Software Engineering Concepts Mastered
| Concept | Where It Is Used in CodeLens | Why It Is Important |
| :--- | :--- | :--- |
| **Asynchronous Subprocess Management** | `child_process.spawn()` inside `server/routes/run.js` | Allows Node.js (which is single-threaded) to execute blocking CPU-heavy native compilers (`gcc`, `javac`) asynchronously without freezing the HTTP server. |
| **Regular Expressions (Regex) & Text Processing** | `sanitizeError()` and `processError()` regex parsers | Demonstrates how complex, messy real-world strings (compiler stack traces) are transformed into structured data. |
| **Virtual File Systems & State Synchronization** | `state.files` array paired with `monacoModels` map | Teaches how complex UI state (multiple open editor tabs, cursor positions, dirty flags) can be synchronized between memory and persistent browser storage (`localStorage`). |
| **REST API & AbortSignal Cancellation** | `AbortController.abort()` during `fetch(/api/run)` | Demonstrates how clean frontends handle slow networks or user cancellations without leaving hanging background requests. |
| **LLM Systems & Strict JSON Output** | `SYSTEM_PROMPT` inside `explain.js` and `mentor.js` | Teaches how to harness generative AI for deterministically structured user interfaces rather than just free-form text generation. |
| **Containerization & Environment Parity** | `Dockerfile` and `.dockerignore` | Demonstrates how Docker guarantees that code runs identically on a local developer laptop, CI/CD pipeline, and production cloud server. |

### 9.2 Recommended Student Exercises & Feature Expansions
To deepen your mastery of CodeLens, try implementing the following extensions to this codebase:
1. **Exercise 1: Add Rust (`rustc`) Support:**
   - Update `Dockerfile` to install `rustc`.
   - Add `.rs` rules to `server/routes/run.js` to run `rustc main.rs -o main` and execute `./main`.
   - Update `sanitizeError()` to clean up Rust compiler notes (`error[E0425]: cannot find value`).
2. **Exercise 2: Implement Real-Time Terminal Streaming via WebSockets:**
   - Replace the `POST /api/run` REST request with a WebSocket connection (`socket.io` or `ws`).
   - Stream `child.stdout` and `child.stderr` data chunks to the frontend terminal in real-time as the program runs (allowing interactive `cin` / `Scanner` prompts *during* execution!).
3. **Exercise 3: Add Database-Backed User Accounts (SQLite / PostgreSQL):**
   - Replace the `localStorage` session UUID architecture in `save.js` with a relational database schema (`Users`, `Workspaces`, `Files`).
   - Add JWT (JSON Web Token) authentication so users can log into their CodeLens workspaces from any device.
4. **Exercise 4: Implement Docker Container Limits Per User Script:**
   - Instead of running `g++` or `java` directly inside the main backend container, use `child_process` to spawn ephemeral sub-containers (`docker run --rm --memory=128m --cpus=0.5 codelens-runner python3 main.py`) for ultimate multi-tenant security!

---
*End of CodeLens Engineering Project Report.*
