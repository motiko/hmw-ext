import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { App } from '../../src/entrypoints/options/App';
import { getSettings, saveSettings } from '../../src/core/settings';

beforeEach(() => {
  fakeBrowser.reset();
  vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(true as never);
});

describe('options page', () => {
  it('renders saved values', async () => {
    await saveSettings({ model: 'claude-x', provider: 'anthropic', baseUrl: 'https://api.anthropic.com' });
    render(<App />);
    expect(await screen.findByDisplayValue('claude-x')).toBeTruthy();
    expect((screen.getByLabelText('API format') as HTMLSelectElement).value).toBe('anthropic');
  });

  it('requests host permission for the endpoint origin and persists on save', async () => {
    render(<App />);
    const url = await screen.findByLabelText('Base URL');
    fireEvent.input(url, { target: { value: 'https://api.anthropic.com' } });
    fireEvent.input(screen.getByLabelText('API key'), { target: { value: 'sk-ant' } });
    fireEvent.input(screen.getByLabelText('Model'), { target: { value: 'claude-x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await getSettings()).apiKey).toBe('sk-ant'));
    expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({ origins: ['https://api.anthropic.com/*'] });
  });

  it('switches the default base URL with the provider', async () => {
    render(<App />);
    const select = await screen.findByLabelText('API format');
    fireEvent.change(select, { target: { value: 'anthropic' } });
    expect((screen.getByLabelText('Base URL') as HTMLInputElement).value).toBe('https://api.anthropic.com');
  });

  it('keeps a custom base URL when switching provider', async () => {
    await saveSettings({ baseUrl: 'https://litellm.internal/v1' });
    render(<App />);
    const select = await screen.findByLabelText('API format');
    fireEvent.change(select, { target: { value: 'anthropic' } });
    expect((screen.getByLabelText('Base URL') as HTMLInputElement).value).toBe('https://litellm.internal/v1');
  });

  it('allows at most 5 examples', async () => {
    await saveSettings({ examples: ['1', '2', '3', '4', '5'] });
    render(<App />);
    await screen.findAllByLabelText(/Example \d/);
    expect((screen.getByRole('button', { name: 'Add example' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the test connection result', async () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue({ ok: false, code: 'unauthorized', message: 'Unauthorized (401): bad key' } as never);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(/Unauthorized \(401\)/)).toBeTruthy();
  });
});
