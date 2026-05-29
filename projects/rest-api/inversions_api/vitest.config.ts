import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno para tests
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
