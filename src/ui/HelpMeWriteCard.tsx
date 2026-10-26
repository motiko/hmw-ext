import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { languageName } from '@/core/lang';
import type { ComposeContext, ErrorCode, GenerateRequest, Task } from '@/core/messages';
import { resolveLanguage } from '@/core/prompt/builder';
import type { InsertMode } from '@/sites/types';
import { Close, Send, SparkPen } from './icons';
import type { Generate } from './port';
import { REFINE_TASKS, RefineMenu } from './RefineMenu';

export interface CardProps {
  mode: 'create' | 'refine';
  getContext(): ComposeContext;
  /** The user's draft or selection, captured when the card opened. */
  draft: { text: string; isSelection: boolean };
  onInsert(text: string, mode: InsertMode): void;
  onClose(): void;
  openSettings(): void;
  generate: Generate;
}

const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'nl', 'pt', 'pl'];

type View = 'prompt' | 'streaming' | 'result' | 'error';

export function HelpMeWriteCard(props: CardProps) {
  const context = useMemo(() => props.getContext(), []);
  const detected = useMemo(
    () => resolveLanguage({ type: 'generate', task: 'create', instruction: '', draft: props.draft.text, context, language: 'auto' }),
    [],
  );
  const [view, setView] = useState<View>('prompt');
  const [instruction, setInstruction] = useState('');
  const [followup, setFollowup] = useState('');
  const [language, setLanguage] = useState('auto');
  const [text, setText] = useState('');
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateRequest | null>(null);
  const handle = useRef<{ abort(): void } | null>(null);
  const textRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => handle.current?.abort();
  }, []);

  const run = (req: GenerateRequest) => {
    handle.current?.abort();
    setLastRequest(req);
    setError(null);
    textRef.current = '';
    setText('');
    setView('streaming');
    handle.current = props.generate(req, (event) => {
      if (event.type === 'token') {
        textRef.current += event.text;
        setText(textRef.current);
      } else if (event.type === 'done') {
        handle.current = null;
        setText(textRef.current.trim());
        setView('result');
      } else {
        handle.current = null;
        setError({ code: event.code, message: event.message });
        setView('error');
      }
    });
  };

  const request = (task: Task, extra: Partial<GenerateRequest> = {}): GenerateRequest => ({
    type: 'generate',
    task,
    instruction: '',
    context,
    language,
    ...extra,
  });

  const create = () => {
    if (!instruction.trim()) return;
    run(request('create', { instruction: instruction.trim() }));
  };
  const refineDraft = (task: Task) => run(request(task, { draft: props.draft.text }));
  const customRefineDraft = () => {
    if (!instruction.trim()) return;
    run(request('followup', { instruction: instruction.trim(), previous: props.draft.text }));
  };
  const refineResult = (task: Task) => run(request(task, { previous: text }));
  const sendFollowup = (e: Event) => {
    e.preventDefault();
    if (!followup.trim()) return;
    run(request('followup', { instruction: followup.trim(), previous: text }));
    setFollowup('');
  };

  const stop = () => {
    handle.current?.abort();
    handle.current = null;
    setText(textRef.current.trim());
    setView(textRef.current.trim() ? 'result' : 'prompt');
  };

  const close = () => {
    handle.current?.abort();
    props.onClose();
  };

  const insert = () => {
    props.onInsert(text, props.draft.isSelection ? 'replace-selection' : 'replace-draft');
    props.onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  const onPromptKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (props.mode === 'create') create();
      else customRefineDraft();
    }
  };

  const title = props.mode === 'refine' ? 'Refine my draft' : 'Help me write';

  return (
    <div class="card" role="dialog" aria-label={title} onKeyDown={onKeyDown}>
      <div class="card-head">
        <span class="spark">
          <SparkPen />
        </span>
        <span class="title">{title}</span>
        <button type="button" class="icon-btn" aria-label="Close" onClick={close}>
          <Close />
        </button>
      </div>

      {view === 'prompt' && (
        <div class="card-body">
          {props.mode === 'refine' && (
            <div class="chips">
              {REFINE_TASKS.map(({ task, label }) => (
                <button type="button" class="chip" key={task} onClick={() => refineDraft(task)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            class="prompt"
            rows={props.mode === 'refine' ? 2 : 3}
            placeholder={props.mode === 'refine' ? 'Or describe the change, e.g. "make it warmer"' : 'Ask for a draft, e.g. "apologise and propose Thursday at 10"'}
            value={instruction}
            onInput={(e) => setInstruction(e.currentTarget.value)}
            onKeyDown={onPromptKey}
          />
          <div class="card-foot">
            <select class="lang" aria-label="Language" value={language} onChange={(e) => setLanguage(e.currentTarget.value)}>
              <option value="auto">{detected === 'und' ? 'Auto' : `Auto (${languageName(detected)})`}</option>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {languageName(l)}
                </option>
              ))}
            </select>
            <button
              type="button"
              class="primary"
              disabled={!instruction.trim()}
              onClick={props.mode === 'create' ? create : customRefineDraft}
            >
              {props.mode === 'create' ? 'Create' : 'Refine'}
            </button>
          </div>
        </div>
      )}

      {(view === 'streaming' || view === 'result') && (
        <div class="card-body">
          {lastRequest?.instruction && <div class="asked">“{lastRequest.instruction}”</div>}
          <div class="preview" aria-live="polite">
            {text}
            {view === 'streaming' && <span class="cursor" />}
          </div>
          {view === 'streaming' ? (
            <div class="card-foot">
              <span class="muted">Writing…</span>
              <button type="button" class="secondary" onClick={stop}>
                Stop
              </button>
            </div>
          ) : (
            <>
              <form class="followup" onSubmit={sendFollowup}>
                <input
                  placeholder="Tell me how to change it…"
                  value={followup}
                  onInput={(e) => setFollowup(e.currentTarget.value)}
                />
                <button type="submit" class="icon-btn" aria-label="Send" disabled={!followup.trim()}>
                  <Send />
                </button>
              </form>
              <div class="card-foot">
                <button type="button" class="text-btn" onClick={() => lastRequest && run(lastRequest)}>
                  Recreate
                </button>
                <RefineMenu onPick={refineResult} />
                <span class="spacer" />
                <button type="button" class="primary" onClick={insert}>
                  Insert
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'error' && error && (
        <div class="card-body">
          <div class="error" role="alert">
            {error.message}
          </div>
          <div class="card-foot">
            {error.code === 'not_configured' || error.code === 'unauthorized' ? (
              <button type="button" class="secondary" onClick={props.openSettings}>
                Open settings
              </button>
            ) : (
              <span />
            )}
            <span class="spacer" />
            {lastRequest && (
              <button type="button" class="primary" onClick={() => run(lastRequest)}>
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      <div class="disclaimer">AI can make mistakes. Review before sending.</div>
    </div>
  );
}
