import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: 'Help me write',
    description: 'Draft and refine Gmail emails with your own AI endpoint, in your language and tone.',
    permissions: ['storage'],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    commands: {
      'open-help-me-write': {
        suggested_key: { default: 'Alt+H' },
        description: 'Open Help me write',
      },
    },
  },
});
