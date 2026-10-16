import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { mountApp } from './app.js';

mountApp(document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
