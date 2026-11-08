import { defineConfig } from 'vitest/config';

export default defineConfig({
  // O Worker importa .sql como texto (regra "Text" do wrangler); aqui fazemos o mesmo.
  plugins: [
    {
      name: 'sql-as-text',
      transform(code, id) {
        if (id.endsWith('.sql')) return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
