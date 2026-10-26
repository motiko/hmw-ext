import { fireEvent, render, screen } from '@testing-library/preact';
import { HelpMeWriteCard, type CardProps } from '../../src/ui/HelpMeWriteCard';
import type { ComposeContext, GenerateRequest, StreamEvent } from '../../src/core/messages';

const ctx: ComposeContext = {
  subject: 'Termin',
  recipients: ['anna@example.org'],
  userEmail: 'moti@example.com',
  thread: [{ from: 'Anna', fromEmail: 'anna@example.org', date: 'heute', text: 'Hallo Moti, wir hatten heute einen Termin, leider warst du nicht da.', isOwn: false }],
};

function setup(over: Partial<CardProps> = {}) {
  const requests: GenerateRequest[] = [];
  let emit: (e: StreamEvent) => void = () => {};
  const abort = vi.fn();
  const props: CardProps = {
    mode: 'create',
    getContext: () => ctx,
    draft: { text: '', isSelection: false },
    onInsert: vi.fn(),
    onClose: vi.fn(),
    openSettings: vi.fn(),
    generate: (req, onEvent) => {
      requests.push(req);
      emit = onEvent;
      return { abort };
    },
    ...over,
  };
  render(<HelpMeWriteCard {...props} />);
  return { props, requests, abort, emit: (e: StreamEvent) => emit(e) };
}

const stream = async (emit: (e: StreamEvent) => void, ...tokens: string[]) => {
  for (const text of tokens) emit({ type: 'token', text });
  emit({ type: 'done' });
  await screen.findByRole('button', { name: 'Insert' });
};

describe('HelpMeWriteCard', () => {
  it('sends a create request with the instruction', () => {
    const { requests } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'propose Thursday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(requests[0]).toMatchObject({ type: 'generate', task: 'create', instruction: 'propose Thursday', context: ctx, language: 'auto' });
  });

  it('streams tokens into the preview', async () => {
    const { emit } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    emit({ type: 'token', text: 'Hallo ' });
    emit({ type: 'token', text: 'Anna' });
    expect(await screen.findByText('Hallo Anna')).toBeTruthy();
  });

  it('stops a running generation', async () => {
    const { emit, abort } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    emit({ type: 'token', text: 'Hal' });
    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));
    expect(abort).toHaveBeenCalled();
  });

  it('inserts the result replacing the draft and closes', async () => {
    const { emit, props } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await stream(emit, 'Hallo Anna');
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    expect(props.onInsert).toHaveBeenCalledWith('Hallo Anna', 'replace-draft');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('refines a selection with Polish and inserts over the selection', async () => {
    const { requests, emit, props } = setup({ mode: 'refine', draft: { text: 'Habe ich vermisst', isSelection: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Polish' }));
    expect(requests[0]).toMatchObject({ task: 'polish', draft: 'Habe ich vermisst' });
    await stream(emit, 'Das habe ich leider verpasst.');
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    expect(props.onInsert).toHaveBeenCalledWith('Das habe ich leider verpasst.', 'replace-selection');
  });

  it('formalizes the previous result', async () => {
    const { requests, emit } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await stream(emit, 'hey anna');
    fireEvent.click(screen.getByRole('button', { name: /Refine/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Formalize' }));
    expect(requests[1]).toMatchObject({ task: 'formalize', previous: 'hey anna' });
  });

  it('recreates with the same request', async () => {
    const { requests, emit } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await stream(emit, 'one');
    fireEvent.click(screen.getByRole('button', { name: 'Recreate' }));
    expect(requests[1]).toEqual(requests[0]);
  });

  it('sends a follow-up instruction about the result', async () => {
    const { requests, emit } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await stream(emit, 'Hallo');
    fireEvent.input(screen.getByPlaceholderText(/how to change it/), { target: { value: 'warmer' } });
    fireEvent.submit(screen.getByPlaceholderText(/how to change it/).closest('form')!);
    expect(requests[1]).toMatchObject({ task: 'followup', previous: 'Hallo', instruction: 'warmer' });
  });

  it('offers settings when not configured', async () => {
    const { emit, props } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    emit({ type: 'error', code: 'not_configured', message: 'Set up your AI endpoint' });
    fireEvent.click(await screen.findByRole('button', { name: 'Open settings' }));
    expect(props.openSettings).toHaveBeenCalled();
  });

  it('shows the detected language for Auto', () => {
    setup();
    expect(screen.getByRole('option', { name: 'Auto (German)' })).toBeTruthy();
  });

  it('closes and aborts on Escape', () => {
    const { props, abort } = setup();
    fireEvent.input(screen.getByPlaceholderText(/Ask for a draft/), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(abort).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });
});
