import '@fontsource-variable/albert-sans';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import './styles/theme.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) });
