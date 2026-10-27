export type Task = 'create' | 'polish' | 'formalize' | 'elaborate' | 'shorten' | 'followup';

export interface ThreadMessage {
  from: string;
  fromEmail: string;
  date: string;
  text: string;
  isOwn: boolean;
}

export interface ComposeContext {
  subject: string;
  recipients: string[];
  userEmail: string;
  /** The user's display name, if the page shows it. */
  userName?: string;
  thread: ThreadMessage[];
}

export interface GenerateRequest {
  type: 'generate';
  task: Task;
  instruction: string;
  /** User's existing draft or selection (refine tasks). */
  draft?: string;
  /** Previously generated text (follow-up refinements). */
  previous?: string;
  context: ComposeContext;
  /** 'auto' or an ISO-639-1 code. */
  language: string;
}

export type ErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'rate_limited'
  | 'network'
  | 'bad_response'
  | 'aborted';

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; code: ErrorCode; message: string };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StyleSample {
  hash: string;
  text: string;
  lang: string;
  /** Email address the sample was written to (first recipient). */
  recipient: string;
  ts: number;
}

export const PORT_NAME = 'hmw-generate';
