import { browser } from 'wxt/browser';
import { detectLanguage } from '@/core/lang';
import { sendRuntime } from '@/core/runtime';
import { gmailAdapter } from '@/sites/gmail/adapter';
import type { Composer } from '@/sites/types';
import { HelpMeWriteCard } from '@/ui/HelpMeWriteCard';
import { mountShadow } from '@/ui/mountShadow';
import { startGeneration } from '@/ui/port';
import { ToolbarButton } from '@/ui/ToolbarButton';
import css from '@/ui/styles.css?inline';

const SCAN_DEBOUNCE_MS = 300;
const CARD_MAX_WIDTH = 560;
const MARK = 'data-hmw';

export default defineContentScript({
  matches: ['https://mail.google.com/*'],
  main(ctx) {
    const adapter = gmailAdapter;
    let lastComposer: Composer | null = null;
    let closeCard: (() => void) | null = null;
    const learned = new Set<string>();
    const mounted: (() => void)[] = [];

    const openCard = (composer: Composer) => {
      closeCard?.();
      const draft = adapter.getDraft(composer);
      const host = document.createElement('div');
      host.setAttribute('data-hmw-card', '');
      Object.assign(host.style, { position: 'fixed', zIndex: '2147483000' });
      document.body.appendChild(host);

      const place = () => {
        const r = composer.body.getBoundingClientRect();
        const width = Math.min(CARD_MAX_WIDTH, Math.max(320, r.width - 16));
        const left = Math.min(Math.max(8, r.left + 8), window.innerWidth - width - 8);
        const height = host.offsetHeight || 240;
        const top = Math.min(Math.max(8, r.top + 8), window.innerHeight - height - 8);
        Object.assign(host.style, { left: `${left}px`, top: `${top}px`, width: `${width}px` });
      };
      const onOutside = (e: MouseEvent) => {
        if (!e.composedPath().includes(host)) close();
      };
      let unmount = () => {};
      const close = () => {
        unmount();
        host.remove();
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
        document.removeEventListener('mousedown', onOutside, true);
        if (closeCard === close) closeCard = null;
        composer.body.focus();
      };
      unmount = mountShadow(
        host,
        css,
        <HelpMeWriteCard
          mode={draft.text ? 'refine' : 'create'}
          draft={draft}
          getContext={() => adapter.getContext(composer, document)}
          onInsert={(text, mode) => adapter.insert(composer, text, mode)}
          onClose={close}
          openSettings={() => void sendRuntime({ type: 'open-options' })}
          generate={startGeneration}
        />,
      );
      place();
      requestAnimationFrame(place);
      window.addEventListener('resize', place);
      window.addEventListener('scroll', place, true);
      document.addEventListener('mousedown', onOutside, true);
      closeCard = close;
    };

    const learnFrom = async (composer: Composer) => {
      const context = adapter.getContext(composer, document);
      const others = context.thread.filter((m) => !m.isOwn).map((m) => m.fromEmail);
      const own = context.thread.filter((m) => m.isOwn && !learned.has(m.text));
      own.forEach((m) => learned.add(m.text));
      const items = await Promise.all(
        own.map(async (m) => ({
          text: m.text,
          lang: await detectLanguage(m.text),
          recipient: others[0] ?? context.recipients[0] ?? '',
        })),
      );
      if (items.length) void sendRuntime({ type: 'add-samples', items });
    };

    const scan = () => {
      for (const composer of adapter.findComposers(document)) {
        if (composer.body.hasAttribute(MARK)) continue;
        const slot = adapter.mountPoint(composer);
        if (!slot) continue;
        composer.body.setAttribute(MARK, '1');
        const onFocus = () => (lastComposer = composer);
        composer.body.addEventListener('focusin', onFocus);
        const unmount = mountShadow(slot, css, <ToolbarButton onClick={() => openCard(composer)} />);
        mounted.push(() => {
          unmount();
          slot.closest('td')?.remove();
          composer.body.removeAttribute(MARK);
          composer.body.removeEventListener('focusin', onFocus);
        });
        void learnFrom(composer);
      }
    };

    let timer: number | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = ctx.setTimeout(scan, SCAN_DEBOUNCE_MS);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // On extension update/reload, remove our UI so the new content script can mount fresh buttons.
    ctx.onInvalidated(() => {
      observer.disconnect();
      closeCard?.();
      mounted.splice(0).forEach((cleanup) => cleanup());
    });
    scan();

    browser.runtime.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type !== 'open-card') return;
      const composers = adapter.findComposers(document);
      const focused = composers.find((c) => c.root.contains(document.activeElement));
      const target = focused ?? composers.find((c) => c.body === lastComposer?.body) ?? composers[0];
      if (target) openCard(target);
    });
  },
});
