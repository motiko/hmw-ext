import { render, type ComponentChild } from 'preact';

const KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const;

/**
 * Renders `ui` into a shadow root on `host` with isolated styles. Key events are kept
 * inside so Gmail's single-key shortcuts don't fire while typing in our inputs.
 */
export function mountShadow(host: HTMLElement, css: string, ui: ComponentChild): () => void {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const container = document.createElement('div');
  shadow.replaceChildren(style, container);
  const stop = (e: Event) => e.stopPropagation();
  for (const type of KEY_EVENTS) host.addEventListener(type, stop);
  render(ui, container);
  return () => {
    render(null, container);
    for (const type of KEY_EVENTS) host.removeEventListener(type, stop);
  };
}
