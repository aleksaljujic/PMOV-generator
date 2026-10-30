import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['e2e/**/*.test.ts', 'e2e/**/*.test.tsx'],
  },
});
