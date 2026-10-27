import { buildPrompt, resolveLanguage, type PromptInput } from '../../src/core/prompt/builder';
import type { GenerateRequest, ThreadMessage } from '../../src/core/messages';

const de = 'Hallo Moti, wir hatten heute um zehn Uhr einen Termin, leider warst du nicht da. Wann passt es dir?';
const msg = (text: string, i: number, isOwn = false): ThreadMessage => ({
  from: isOwn ? 'Moti' : 'Anna Berger',
  fromEmail: isOwn ? 'moti@example.com' : 'anna@example.com',
  date: `2026-10-2${i}`,
  text,
  isOwn,
});

function req(over: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    type: 'generate',
    task: 'create',
    instruction: 'apologise and propose Thursday 10:00',
    context: { subject: 'Termin', recipients: ['anna@example.com'], userEmail: 'moti@example.com', thread: [msg(de, 1)] },
    language: 'auto',
    ...over,
  };
}

function input(over: Partial<PromptInput> = {}): PromptInput {
  return { request: req(), language: 'de', samples: [], styleNotes: '', examples: [], sendQuotedHistory: true, ...over };
}

const text = (m: ReturnType<typeof buildPrompt>) => m.map((x) => x.content).join('\n');

// Fake detector: German if the text contains 'wir', English if it contains 'the', else unknown.
const detect = async (t: string) => (/\bwir\b/.test(t) ? 'de' : /\bthe\b/.test(t) ? 'en' : 'und');

describe('resolveLanguage', () => {
  it('prefers an explicit language', async () => {
    expect(await resolveLanguage(req({ language: 'fr' }), detect)).toBe('fr');
  });
  it('uses the newest thread message when auto', async () => {
    expect(await resolveLanguage(req(), detect)).toBe('de');
  });
  it('falls back to the instruction for a new email', async () => {
    expect(
      await resolveLanguage(req({ context: { subject: '', recipients: [], userEmail: '', thread: [] }, instruction: 'tell the team about the delay' }), detect),
    ).toBe('en');
  });
});

describe('buildPrompt', () => {
  it('returns a system and a user message', () => {
    expect(buildPrompt(input()).map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('asks the model to match the thread language when unknown', () => {
    expect(buildPrompt(input({ language: 'und' }))[0]!.content).toContain('same language as the email thread');
  });

  it('asks for the body only, in the resolved language', () => {
    const [system] = buildPrompt(input());
    expect(system!.content).toContain('Write only the email body');
    expect(system!.content).toContain('German');
  });

  it('includes style notes, samples and examples', () => {
    const out = text(
      buildPrompt(
        input({
          styleNotes: 'Sign off with VG Moti',
          examples: ['Pasted example text'],
          samples: [{ hash: 'h', text: 'Learned sample text', lang: 'de', recipient: 'anna@example.com', ts: 1 }],
        }),
      ),
    );
    expect(out).toContain('Sign off with VG Moti');
    expect(out).toContain('Pasted example text');
    expect(out).toContain('Learned sample text');
  });

  it('includes the instruction for create', () => {
    expect(text(buildPrompt(input()))).toContain('apologise and propose Thursday 10:00');
  });

  it('includes the draft and polish instruction for polish', () => {
    const out = text(buildPrompt(input({ request: req({ task: 'polish', instruction: '', draft: 'Sorry, habe ich vermisst' }) })));
    expect(out).toContain('Sorry, habe ich vermisst');
    expect(out).toMatch(/polish/i);
  });

  it('includes previous text and the instruction for followup', () => {
    const out = text(buildPrompt(input({ request: req({ task: 'followup', instruction: 'make it warmer', previous: 'Hallo Anna, ...' }) })));
    expect(out).toContain('make it warmer');
    expect(out).toContain('Hallo Anna, ...');
  });

  it('renders the thread newest-first and drops the oldest beyond the budget', () => {
    const thread = [msg('NEWEST ' + 'a'.repeat(300), 3), msg('MIDDLE ' + 'b'.repeat(300), 2), msg('OLDEST ' + 'c'.repeat(300), 1)];
    const out = text(buildPrompt(input({ maxContextChars: 700, request: req({ context: { ...req().context, thread } }) })));
    expect(out).toContain('NEWEST');
    expect(out).toContain('MIDDLE');
    expect(out).not.toContain('OLDEST');
    expect(out.indexOf('NEWEST')).toBeLessThan(out.indexOf('MIDDLE'));
  });

  it('omits thread messages but keeps subject and recipients when quoted history is disabled', () => {
    const out = text(buildPrompt(input({ sendQuotedHistory: false })));
    expect(out).not.toContain('wir hatten heute');
    expect(out).toContain('Termin');
    expect(out).toContain('anna@example.com');
  });
});
