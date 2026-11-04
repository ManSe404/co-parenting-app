// @ts-check
import { defineConfig } from 'astro/config';
import { execSync } from 'node:child_process';
import process from 'node:process';
import svelte from '@astrojs/svelte';

// Local development with the database (`npm run dev:baza`): take the local
// Supabase address and its public (publishable) key from the running CLI, so
// no key is written into any file. Without it the app runs in demo mode.
if (process.env.BAZA === 'lokalno' && !process.env.PUBLIC_SUPABASE_URL) {
  const status = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  /** @param {string} kljuc */
  const uzmi = (kljuc) => new RegExp(`^${kljuc}="?([^"\n]+)"?$`, 'm').exec(status)?.[1];
  process.env.PUBLIC_SUPABASE_URL = uzmi('API_URL');
  process.env.PUBLIC_SUPABASE_KEY = uzmi('PUBLISHABLE_KEY');
}

// The app is fully static: every page is a shell, and the data loads in the
// browser after login. BASE_PATH lets the same build serve from a sub-path
// (GitHub Pages project site) or from the root (Cloudflare, local dev).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  integrations: [svelte()],
  // The dev toolbar sits over the phone tab bar; it is not needed here.
  devToolbar: { enabled: false },
});
