/* ============================================================
   POST /api/run
   Body: { language, code, stdin } (also accepts { lang })
   Returns structured JSON:
   {
     stdout,
     stderr,
     exitCode,
     compileError,
     runtimeError,
     executionTime,
     errorType,
     line,
     column,
     message,
     codeLine,
     suggestion
   }

   Local execution engine supporting C++, Python, C, and JS.
   Creates a temporary directory, compiles/runs with a 5s
   timeout, cleans up all temp files, and sanitizes/pretty-prints
   all errors without leaking internal paths or compiler noise.
   ============================================================ */

'use strict';

const express               = require('express');
const router                = express.Router();
const { execFile }          = require('child_process');
const { mkdtemp, writeFile, rm } = require('fs/promises');
const path                  = require('path');
const os                    = require('os');

const EXEC_TIMEOUT_MS = 5000; // 5 seconds execution limit per requirements

// Helper to run child_process.execFile wrapped in a promise with stdin support
function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const { input, stdin, ...execOptions } = options;
    const child = execFile(cmd, args, { maxBuffer: 1024 * 1024, ...execOptions }, (err, stdout = '', stderr = '') => {
      resolve({
        err,
        stdout: typeof stdout === 'string' ? stdout : stdout.toString('utf8'),
        stderr: typeof stderr === 'string' ? stderr : stderr.toString('utf8')
      });
    });

    const inputData = input ?? stdin;
    if (inputData !== undefined && inputData !== null && child && child.stdin) {
      if (typeof inputData === 'string' && inputData.length > 0) {
        child.stdin.write(inputData);
      } else if (Buffer.isBuffer(inputData) && inputData.length > 0) {
        child.stdin.write(inputData);
      }
      child.stdin.end();
    }
  });
}

/**
 * Requirement 1 & 2: Sanitize paths and hide internal compiler noise.
 */
function sanitizeError(rawText, langKey) {
  if (!rawText || typeof rawText !== 'string') return '';

  let lines = rawText.split(/\r?\n/);
  const isC = langKey === 'c';
  const fileName = langKey === 'python' || langKey === 'py' ? 'main.py' : (isC ? 'main.c' : (langKey === 'javascript' || langKey === 'js' ? 'main.js' : 'main.cpp'));

  // Filter out internal compiler noise lines
  lines = lines.filter(line => {
    const l = line.toLowerCase();
    if (l.includes('mingw') || l.includes('bits/stdc++.h') || l.includes('/usr/include') || l.includes('/usr/lib')) return false;
    if (l.includes('internal headers') || l.includes('in file included from')) return false;
    // Skip unhelpful stack/note lines from compiler noise if not pointing to main file
    if ((l.includes('note:') || l.includes('here')) && !l.includes('main.')) return false;
    return true;
  });

  let sanitized = lines.join('\n');

  // Replace Windows and Unix absolute paths with only the filename
  // E.g., C:\Users\saima\AppData\Local\Temp\codelens_run_xxx\main.cpp:4:5: -> main.cpp:4:5:
  sanitized = sanitized.replace(/[a-zA-Z]:\\[^\s:*?"<>|]*\\(main\.(?:cpp|c|py|js))/gi, '$1');
  sanitized = sanitized.replace(/[a-zA-Z]:\/[^\s:*?"<>|]*\/(main\.(?:cpp|c|py|js))/gi, '$1');
  sanitized = sanitized.replace(/\/[^\s:*?"<>|]*\/(main\.(?:cpp|c|py|js))/gi, '$1');

  // E.g., File "C:\Users\...\main.py", line 12 -> File "main.py", line 12
  sanitized = sanitized.replace(/File ["'][^"']*main\.(py|cpp|c|js)["']/gi, 'File "main.$1"');

  // Strip residual temp path mentions
  sanitized = sanitized.replace(/codelens_run_[a-zA-Z0-9-_]+/gi, '');

  return sanitized.trim();
}

/**
 * Requirement 3, 4, 5, 6: Extract line, col, message, suggestion and format pretty error.
 */
function processError(rawError, code, isCompile, langKey) {
  const sanitized = sanitizeError(rawError, langKey);
  if (!sanitized) return { prettyError: '', structured: null };

  const codeLines = typeof code === 'string' ? code.split(/\r?\n/) : [];
  let line = null;
  let column = null;
  let message = '';
  let codeLine = '';
  let suggestion = '';

  const isPy = langKey === 'python' || langKey === 'py';
  const isC = langKey === 'c';
  const fileName = isPy ? 'main.py' : (isC ? 'main.c' : 'main.cpp');

  if (!isPy) {
    // C++ / C line check: e.g., main.cpp:4:5: error: 'cout' was not declared in this scope
    const cppRegex = /(?:main\.(?:cpp|c)):(\d+):(?:(\d+):)?\s*(?:(?:fatal\s+)?error|warning):\s*(.+)/i;
    const match = cppRegex.exec(sanitized);
    if (match) {
      line = parseInt(match[1], 10);
      column = match[2] ? parseInt(match[2], 10) : 1;
      message = match[3].trim();
      if (line >= 1 && line <= codeLines.length) {
        codeLine = codeLines[line - 1];
      }

      // Generate helpful suggestions per Requirement 3
      if (/\bcout\b/.test(message) && message.includes('not declared')) {
        suggestion = "Did you forget:\n\nusing namespace std;\n\nor\n\nstd::cout ?";
      } else if (/\bcin\b/.test(message) && message.includes('not declared')) {
        suggestion = "Did you forget:\n\nusing namespace std;\n\nor\n\nstd::cin ?";
      } else if (/\bendl\b/.test(message) && message.includes('not declared')) {
        suggestion = "Did you forget:\n\nusing namespace std;\n\nor\n\nstd::endl ?";
      } else if (/\bstring\b/.test(message) && message.includes('not declared')) {
        suggestion = "Did you forget:\n\n#include <string>\nusing namespace std;";
      } else if (/\bvector\b/.test(message) && message.includes('not declared')) {
        suggestion = "Did you forget:\n\n#include <vector>\nusing namespace std;";
      } else if (message.includes("expected ';'")) {
        suggestion = "Did you forget a semicolon ';' at the end of the statement?";
      } else if (message.includes("expected ')'")) {
        suggestion = "Check for matching or missing closing parenthesis ')'.";
      } else if (message.includes("expected '}'")) {
        suggestion = "Check for matching or missing closing curly brace '}'.";
      }
    } else if (/segmentation fault/i.test(sanitized) || /access violation/i.test(sanitized) || /0xc0000005/i.test(sanitized)) {
      message = "Segmentation fault";
      suggestion = "Program attempted to access invalid memory.";
    } else {
      message = sanitized.split('\n')[0] || 'Unknown error';
    }
  } else {
    // Python check: e.g., File "main.py", line 12
    const pyRegex = /File ["'](?:.*?)main\.py["'], line (\d+)/i;
    const match = pyRegex.exec(sanitized);
    if (match) {
      line = parseInt(match[1], 10);
      column = 1;
      if (line >= 1 && line <= codeLines.length) {
        codeLine = codeLines[line - 1];
      }
    }

    // Extract exact Python error type and message (e.g., ZeroDivisionError: division by zero)
    const errLines = sanitized.split('\n');
    for (let i = errLines.length - 1; i >= 0; i--) {
      const el = errLines[i].trim();
      if (/^[a-zA-Z]+Error:/i.test(el) || /^Exception:/i.test(el)) {
        message = el;
        const [errName] = el.split(':');
        if (errName === 'ZeroDivisionError') {
          suggestion = "Check division operations to ensure the denominator is not zero.";
        } else if (errName === 'NameError') {
          suggestion = "Check variable/function names for typos or missing definitions.";
        } else if (errName === 'IndentationError' || errName === 'TabError') {
          suggestion = "Ensure consistent indentation (prefer 4 spaces per indent level).";
        } else if (errName === 'SyntaxError') {
          suggestion = "Check syntax for missing colons ':', parentheses '()', or quotes.";
        }
        break;
      }
    }
    if (!message) {
      message = sanitized.split('\n').pop() || 'Python execution error';
    }
  }

  // Build pretty error presentation per Requirement 3 & 4
  let prettyError = '';
  if (isCompile && line && message) {
    const underline = '^'.repeat(Math.max(1, Math.min((codeLine || '').trim().length || 4, 20)));
    prettyError = `❌ Compilation Error\n\n${fileName}:${line}\n\n${codeLine || ''}\n${underline}\n\n${message}${suggestion ? `\n\nSuggestion:\n${suggestion}` : ''}`;
  } else if (!isCompile && line && message) {
    prettyError = `❌ Runtime Error\n\nFile "${fileName}", line ${line}\n\n${codeLine || ''}\n\n${message.replace(':', ':\n')}${suggestion ? `\n\nSuggestion:\n${suggestion}` : ''}`;
  } else if (!isCompile && message === 'Segmentation fault') {
    prettyError = `❌ Runtime Error\n\nSegmentation fault\n\nProgram attempted to access invalid memory.`;
  } else {
    prettyError = `❌ ${isCompile ? 'Compilation' : 'Runtime'} Error\n\n${sanitized}`;
  }

  const structured = {
    errorType: isCompile ? 'compile' : 'runtime',
    line: line || null,
    column: column || null,
    message: message || sanitized,
    codeLine: codeLine || null,
    suggestion: suggestion || null
  };

  return { prettyError: prettyError.trim(), structured };
}

router.post('/', async (req, res, next) => {
  const start = Date.now();
  let tmpDir = null;

  try {
    const { code = '', language = req.body.lang || 'python', stdin = '' } = req.body;

    if (!code.trim()) {
      return res.status(400).json({
        stdout: '',
        stderr: 'No code provided.',
        exitCode: 1,
        compileError: '',
        runtimeError: 'No code provided.',
        executionTime: 0,
        "compile errors": '',
        "runtime errors": 'No code provided.',
        "exit code": 1
      });
    }

    const langKey = String(language).toLowerCase().trim();

    // 2. Create a temporary working directory
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codelens_run_'));

    let stdoutStr = '';
    let stderrStr = '';
    let exitCode = 0;
    let compileError = '';
    let runtimeError = '';
    let structuredInfo = null;

    // 3 & 4. For C++ / C
    if (langKey === 'cpp' || langKey === 'c++' || langKey === 'c') {
      const isC = langKey === 'c';
      const fileName = isC ? 'main.c' : 'main.cpp';
      const codePath = path.join(tmpDir, fileName);
      const exeName  = os.platform() === 'win32' ? 'main.exe' : 'main';
      const exePath  = path.join(tmpDir, exeName);

      await writeFile(codePath, code, 'utf8');

      // Compile using g++ (or gcc)
      const compilerCmd = isC ? 'gcc' : 'g++';
      const compileArgs = [codePath, '-O2', '-o', exePath];

      const compRes = await runCommand(compilerCmd, compileArgs, { cwd: tmpDir, timeout: 10000 });

      // If compilation fails, return compiler errors
      if (compRes.err || compRes.stderr) {
        if (compRes.err && compRes.err.code !== 0) {
          const rawCompErr = (compRes.stderr || compRes.stdout || compRes.err.message || 'Compilation failed').trim();
          const proc = processError(rawCompErr, code, true, langKey);
          compileError = proc.prettyError;
          structuredInfo = proc.structured;
          exitCode = typeof compRes.err.code === 'number' ? compRes.err.code : 1;
        } else if (compRes.stderr && /error:/i.test(compRes.stderr)) {
          const proc = processError(compRes.stderr.trim(), code, true, langKey);
          compileError = proc.prettyError;
          structuredInfo = proc.structured;
          exitCode = 1;
        }
      }

      if (compileError || exitCode !== 0) {
        // Clean up immediately and return
        await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        const execTime = Date.now() - start;
        return res.json({
          stdout: '',
          stderr: compileError,
          exitCode: exitCode,
          compileError: compileError,
          runtimeError: '',
          executionTime: execTime,
          // Structured error properties per Requirement 6
          errorType: structuredInfo?.errorType || 'compile',
          line: structuredInfo?.line || null,
          column: structuredInfo?.column || null,
          message: structuredInfo?.message || compileError,
          codeLine: structuredInfo?.codeLine || null,
          suggestion: structuredInfo?.suggestion || null,
          // Aliases for frontend compatibility
          "compile errors": compileError,
          "runtime errors": '',
          "exit code": exitCode,
          output: '',
          error: compileError
        });
      }

      // If successful, execute the program
      const runRes = await runCommand(exePath, [], {
        cwd: tmpDir,
        timeout: EXEC_TIMEOUT_MS,
        input: stdin || ''
      });

      stdoutStr = (runRes.stdout || '').trimEnd();
      stderrStr = (runRes.stderr || '').trimEnd();

      if (runRes.err) {
        if (runRes.err.killed || runRes.err.signal === 'SIGTERM') {
          runtimeError = `❌ Runtime Error\n\nExecution timed out (${EXEC_TIMEOUT_MS / 1000}s limit exceeded)`;
          exitCode = 124;
          structuredInfo = { errorType: 'runtime', line: null, column: null, message: 'Execution timed out', codeLine: null, suggestion: 'Avoid infinite loops or long blocking calls.' };
        } else {
          const rawRunErr = (stderrStr || runRes.stdout || runRes.err.message || 'Runtime error').trim();
          const proc = processError(rawRunErr, code, false, langKey);
          runtimeError = proc.prettyError;
          structuredInfo = proc.structured;
          exitCode = typeof runRes.err.code === 'number' ? runRes.err.code : 1;
        }
      } else {
        exitCode = 0;
        if (stderrStr) {
          // Requirement 7: Do not modify successful execution output. Only sanitize if non-zero exit code or error
          const proc = processError(stderrStr, code, false, langKey);
          runtimeError = proc.prettyError;
          structuredInfo = proc.structured;
        }
      }
    }
    // 3 & 5. For Python
    else if (langKey === 'python' || langKey === 'py') {
      const codePath = path.join(tmpDir, 'main.py');
      await writeFile(codePath, code, 'utf8');

      const pyCmd = os.platform() === 'win32' ? 'python' : 'python3';
      const runRes = await runCommand(pyCmd, [codePath], {
        cwd: tmpDir,
        timeout: EXEC_TIMEOUT_MS,
        input: stdin || ''
      });

      stdoutStr = (runRes.stdout || '').trimEnd();
      stderrStr = (runRes.stderr || '').trimEnd();

      if (runRes.err) {
        if (runRes.err.killed || runRes.err.signal === 'SIGTERM') {
          runtimeError = `❌ Runtime Error\n\nExecution timed out (${EXEC_TIMEOUT_MS / 1000}s limit exceeded)`;
          exitCode = 124;
          structuredInfo = { errorType: 'runtime', line: null, column: null, message: 'Execution timed out', codeLine: null, suggestion: 'Avoid infinite loops or long blocking calls.' };
        } else {
          const rawRunErr = (stderrStr || runRes.err.message || 'Runtime error').trim();
          const proc = processError(rawRunErr, code, false, langKey);
          runtimeError = proc.prettyError;
          structuredInfo = proc.structured;
          exitCode = typeof runRes.err.code === 'number' ? runRes.err.code : 1;
        }
      } else {
        exitCode = 0;
        if (stderrStr) {
          const proc = processError(stderrStr, code, false, langKey);
          runtimeError = proc.prettyError;
          structuredInfo = proc.structured;
        }
      }
    }
    // For JavaScript / Node.js
    else if (langKey === 'javascript' || langKey === 'js' || langKey === 'node') {
      const codePath = path.join(tmpDir, 'main.js');
      await writeFile(codePath, code, 'utf8');

      const runRes = await runCommand('node', [codePath], {
        cwd: tmpDir,
        timeout: EXEC_TIMEOUT_MS,
        input: stdin || ''
      });

      stdoutStr = (runRes.stdout || '').trimEnd();
      stderrStr = (runRes.stderr || '').trimEnd();

      if (runRes.err) {
        if (runRes.err.killed || runRes.err.signal === 'SIGTERM') {
          runtimeError = `❌ Runtime Error\n\nExecution timed out (${EXEC_TIMEOUT_MS / 1000}s limit exceeded)`;
          exitCode = 124;
          structuredInfo = { errorType: 'runtime', line: null, column: null, message: 'Execution timed out', codeLine: null, suggestion: null };
        } else {
          const rawRunErr = (stderrStr || runRes.err.message || 'Runtime error').trim();
          const proc = processError(rawRunErr, code, false, langKey);
          runtimeError = proc.prettyError;
          structuredInfo = proc.structured;
          exitCode = typeof runRes.err.code === 'number' ? runRes.err.code : 1;
        }
      } else {
        exitCode = 0;
        if (stderrStr) {
          const proc = processError(stderrStr, code, false, langKey);
          runtimeError = proc.prettyError;
          structuredInfo = proc.structured;
        }
      }
    }
    else {
      // Unsupported language
      exitCode = 1;
      runtimeError = `❌ Runtime Error\n\nUnsupported language: "${language}". Supported languages: C++, Python, C, JavaScript.`;
    }

    // 8. Delete all temporary files after execution
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      tmpDir = null;
    }

    const execTime = Date.now() - start;

    // Requirement 3: Enforce safe display limits (10,000 lines or 1 MB) and append truncation message
    const maxLines = 10000;
    const maxBytes = 1024 * 1024;
    let isTruncated = false;
    if (stdoutStr.length > maxBytes || stdoutStr.split(/\r?\n/).length > maxLines) {
      stdoutStr = stdoutStr.split(/\r?\n/).slice(0, maxLines).join('\n').slice(0, maxBytes);
      isTruncated = true;
    }
    if (isTruncated || runtimeError.includes('maxBuffer')) {
      if (runtimeError.includes('maxBuffer')) {
        runtimeError = '';
        exitCode = 0;
      }
      stdoutStr = (stdoutStr ? stdoutStr + '\n\n' : '') + 'Output truncated because it exceeded the display limit.';
    }

    const finalErrText = (compileError || runtimeError || sanitizeError(stderrStr, langKey)).trim();

    // 9. Return structured JSON
    return res.json({
      stdout: stdoutStr,
      stderr: finalErrText,
      exitCode: exitCode,
      compileError: compileError,
      runtimeError: runtimeError,
      executionTime: execTime,
      // Structured error properties per Requirement 6
      errorType: structuredInfo?.errorType || (compileError ? 'compile' : (exitCode !== 0 ? 'runtime' : null)),
      line: structuredInfo?.line || null,
      column: structuredInfo?.column || null,
      message: structuredInfo?.message || (compileError || runtimeError || null),
      codeLine: structuredInfo?.codeLine || null,
      suggestion: structuredInfo?.suggestion || null,
      // Aliases for terminal compatibility
      "compile errors": compileError,
      "runtime errors": runtimeError,
      "exit code": exitCode,
      output: stdoutStr,
      error: finalErrText || null
    });
  } catch (err) {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
    next(err);
  }
});

module.exports = router;
