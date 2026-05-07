// ── CSS Houdini registerProperty guard ────────────────────────────────────────
// MUST run before any library code. The Fluent LatencyLoader calls
// CSS.registerProperty on every mount, which throws InvalidModificationError
// when the same custom property name is registered twice (React StrictMode
// double-mount, HMR, component mount/unmount cycles, etc.).
// We patch once at the very top of the entry point so the guard is in place
// before any library caches a reference to the native function.
 
(function patchCSSRegisterProperty() {
  const css = CSS as any;
  if (typeof css !== 'undefined' && typeof css.registerProperty === 'function') {
    const orig = css.registerProperty.bind(css);
    const seen = new Set<string>();
    css.registerProperty = (def: { name: string;[k: string]: any }) => {
      if (seen.has(def.name)) return;
      orig(def);
      seen.add(def.name);
    };
  }
})();

/* eslint-disable import/first */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { initDevLogger } from './lib/devLogger';
import App from './App';

// Initialize dev logger — no-op in production
initDevLogger();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
