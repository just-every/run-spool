import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { docsSite } from './vite/docs-site';
export default defineConfig({ plugins: [docsSite(), react()] });
