/* ============================================================
   POST /api/explain
   Body: { code, language }
   Returns: Groq AI JSON — { summary, lineByLine, variables,
     functions, algorithm, timeComplexity, spaceComplexity,
     dryRun, commonMistakes, suggestions, interviewQuestions }

   The GROQ_API_KEY is read server-side only and is NEVER
   forwarded to the browser.
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

// ── System prompt (exactly as specified) ─────────────────────
const SYSTEM_PROMPT = `You are an expert software engineer and programming instructor.
Analyze the provided source code.
Return ONLY valid JSON.
The response must contain exactly these fields:
- summary: string — concise overview of what the code does (short and punchy, avoid long paragraphs)
- output: string — expected console output or return value when this code runs (exact and clear)
- lineByLine: array of { line: number, code: string, explanation: string }
- variables: array of { name: string, type: string, purpose: string }
- functions: array of { name: string, params: array, returns: string, purpose: string }
- algorithm: string — concise description of the algorithm used
- timeComplexity: string — Big O notation with explanation, e.g. "O(n) - linear scan"
- spaceComplexity: string — Big O notation with explanation
- dryRun: string — step-by-step trace of execution with a simple example input
- commonMistakes: array of strings (concise bullet points, one idea per item)
- suggestions: array of strings — improvement suggestions (concise bullet points, one idea per item)
- betterApproach: string — a more optimal or idiomatic alternative approach
- relatedConcepts: array of strings — concepts, algorithms, or data structures related to this code
- interviewQuestions: array of strings
Provide concise, punchy explanations. Avoid long paragraphs; every explanation must be broken down so each card or bullet point contains only ONE clear idea.
Do not use markdown.
Do not wrap JSON inside code blocks.
The response must always be valid JSON.`;


// ── Helper: extract JSON even if model slips a code fence ────
function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}

  // Strip markdown fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Last resort: grab first { ... }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  return null;
}

// ── Route handler ─────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { code = '', language = 'unknown' } = req.body;

    if (!code.trim()) {
      return res.status(400).json({ error: 'No code provided.' });
    }

    // Guard: API key must be set server-side only
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'Groq API key is not configured. Open .env, add your GROQ_API_KEY, and restart the server.',
        missingKey: true,
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Language: ${language}\n\nCode:\n${code.substring(0, 12000)}`, // guard token limit
        },
      ],
      temperature: 0.2,
      max_tokens:  4096,
      response_format: { type: 'json_object' }, // forces valid JSON output
    });

    const rawText = completion.choices[0]?.message?.content || '{}';
    const parsed  = extractJSON(rawText);

    if (!parsed) {
      return res.status(500).json({
        error: 'AI returned an unexpected response format. Please try again.',
      });
    }

    res.json(parsed);
  } catch (err) {
    // Groq API errors (invalid key, rate limit, etc.)
    if (err?.status === 401) {
      return res.status(401).json({
        error: 'Invalid Groq API key. Check the GROQ_API_KEY value in your .env file.',
        missingKey: true,
      });
    }
    if (err?.status === 429) {
      return res.status(429).json({ error: 'Groq rate limit reached. Wait a moment and retry.' });
    }
    next(err);
  }
});

module.exports = router;
