/* ============================================================
   POST /api/mentor
   Body: { code, language, question, conversationHistory, aiMode }
   Returns: { reply, context }

   Conversational AI mentor powered by Groq.
   The GROQ_API_KEY is read server-side only and is NEVER
   forwarded to the browser.
   ============================================================ */

'use strict';

const express = require('express');
const router  = express.Router();
const Groq    = require('groq-sdk');

// ── System prompts per AI mode ─────────────────────────────
const SYSTEM_PROMPTS = {
  mentor: `You are an expert programming mentor using the Socratic method.
You are helping a student understand their code.
NEVER just give the answer directly — ask guiding questions, provide hints, and help them discover the solution.
When they ask "Why is this O(n)?", explain the reasoning step by step.
When they ask "Can recursion replace this?", explore the idea with them.
When they ask about a specific line, refer to it specifically.
Be warm, encouraging, and intellectually engaging.
Keep responses concise (3-6 sentences max unless a detailed explanation is clearly needed).
Format: Plain text with occasional code snippets in backticks. No markdown headers.`,

  beginner: `You are a patient, friendly programming tutor for beginners.
Explain everything in plain English. No jargon. Use analogies and real-world examples.
When they make a mistake or misunderstand, gently correct and re-explain.
Never make them feel bad for not knowing something.
Keep responses short, warm, and encouraging (2-4 sentences).
Format: Simple, conversational. Use simple code examples when helpful.`,

  interview: `You are a senior FAANG interviewer coaching a candidate.
Be direct and precise. Push for Big O notation. Ask follow-up questions.
When they answer, evaluate their answer and either confirm it's correct or point out what's missing.
Focus on: time complexity, space complexity, edge cases, trade-offs, and code quality.
Format: Direct and professional. Use technical terminology.`,
};

// ── Extract JSON from possibly-wrapped response ────────────
function tryParseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) { try { return JSON.parse(m[1].trim()); } catch {} }
  return null;
}

// ── Route handler ──────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      code          = '',
      language      = 'unknown',
      question      = '',
      conversationHistory = [],  // [{ role: 'user'|'assistant', content: string }]
      aiMode        = 'mentor',
    } = req.body;

    if (!question.trim()) {
      return res.status(400).json({ error: 'No question provided.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({
        error: 'Groq API key is not configured.',
        missingKey: true,
      });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Build the system prompt
    const systemPrompt = SYSTEM_PROMPTS[aiMode] || SYSTEM_PROMPTS.mentor;

    // Build context block
    const codeContext = code.trim()
      ? `\n\n--- Current Code (${language}) ---\n${code.substring(0, 6000)}\n--- End of Code ---`
      : '';

    // Build message history (cap at last 8 exchanges to stay within token limits)
    const historyMessages = conversationHistory
      .slice(-16)
      .map(msg => ({ role: msg.role, content: String(msg.content).substring(0, 800) }));

    const messages = [
      {
        role: 'system',
        content: systemPrompt + codeContext,
      },
      ...historyMessages,
      {
        role: 'user',
        content: question.substring(0, 2000),
      },
    ];

    const completion = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      messages,
      temperature: 0.6,
      max_tokens:  800,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'I didn\'t catch that — could you rephrase?';

    res.json({ reply, model: 'llama-3.3-70b-versatile' });

  } catch (err) {
    if (err?.status === 401) {
      return res.status(401).json({
        error: 'Invalid Groq API key.',
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
