import type { ChatMessage, GenerateRequest, StyleSample, ThreadMessage } from '../messages';
import { detectLanguage, languageName } from '../lang';
import { TASK_INSTRUCTIONS } from './tasks';

export interface PromptInput {
  request: GenerateRequest;
  samples: StyleSample[];
  styleNotes: string;
  examples: string[];
  sendQuotedHistory: boolean;
  maxContextChars?: number;
}

const DEFAULT_MAX_CONTEXT_CHARS = 24_000;

/** Explicit choice, else the language of the newest thread message, draft or instruction. */
export function resolveLanguage(req: GenerateRequest): string {
  if (req.language && req.language !== 'auto') return req.language;
  const candidates = [req.context.thread[0]?.text, req.draft, req.previous, req.instruction];
  for (const text of candidates) {
    if (!text) continue;
    const lang = detectLanguage(text);
    if (lang !== 'und') return lang;
  }
  return 'und';
}

function renderThread(thread: ThreadMessage[], budget: number): string {
  const parts: string[] = [];
  let used = 0;
  for (const m of thread) {
    const header = `--- From: ${m.from} <${m.fromEmail}>${m.isOwn ? ' (me)' : ''}, ${m.date} ---\n`;
    const remaining = budget - used - header.length;
    if (remaining <= 0) break;
    const body = m.text.length > remaining ? m.text.slice(0, remaining) : m.text;
    parts.push(header + body);
    used += header.length + body.length;
    if (body.length < m.text.length) break;
  }
  return parts.join('\n\n');
}

function systemPrompt(input: PromptInput, lang: string): string {
  const lines = [
    'You are the "Help me write" assistant inside the user\'s email client.',
    'Write only the email body: no subject line, no explanations, no markdown, no placeholders like [Name].',
    'Do not add a signature block; the email client appends it.',
    lang === 'und'
      ? 'Write in the same language as the email thread or the user\'s request.'
      : `Write in ${languageName(lang)}.`,
    'Match the user\'s own tone, formality, greeting and sign-off habits as shown in their writing samples.',
  ];
  if (input.styleNotes.trim()) lines.push('', 'The user\'s style notes:', input.styleNotes.trim());
  const samples = [...input.examples.filter((e) => e.trim()), ...input.samples.map((s) => s.text)];
  if (samples.length) {
    lines.push('', 'Samples of emails the user wrote (for style only, do not copy content):');
    for (const s of samples) lines.push(`<sample>\n${s.trim()}\n</sample>`);
  }
  return lines.join('\n');
}

function userPrompt(input: PromptInput): string {
  const { request: req } = input;
  const ctx = req.context;
  const lines: string[] = [];
  if (ctx.subject) lines.push(`Subject: ${ctx.subject}`);
  if (ctx.recipients.length) lines.push(`Recipients: ${ctx.recipients.join(', ')}`);
  if (input.sendQuotedHistory && ctx.thread.length) {
    const thread = renderThread(ctx.thread, input.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS);
    lines.push('', 'This is a reply. Previous messages in the thread, newest first:', thread);
  }
  lines.push('', TASK_INSTRUCTIONS[req.task]);
  if (req.task === 'create') {
    lines.push(`Request: ${req.instruction}`);
  } else {
    if (req.instruction) lines.push(`Request: ${req.instruction}`);
    const source = req.previous ?? req.draft ?? '';
    lines.push(`<draft>\n${source}\n</draft>`);
  }
  return lines.join('\n');
}

export function buildPrompt(input: PromptInput): ChatMessage[] {
  const lang = resolveLanguage(input.request);
  return [
    { role: 'system', content: systemPrompt(input, lang) },
    { role: 'user', content: userPrompt(input) },
  ];
}
