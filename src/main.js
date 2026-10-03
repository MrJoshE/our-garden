import '@fontsource-variable/albert-sans';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import './styles/theme.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { reportError } from './lib/state/app.svelte.js';

addEventListener('error', (event) => reportError(event.error ?? event.message, { operation: 'window error' }));
addEventListener('unhandledrejection', (event) => reportError(event.reason, { operation: 'unhandled rejection' }));

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) });
