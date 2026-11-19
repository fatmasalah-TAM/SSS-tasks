/**
 * Ovrto React pages. The old app draws the shell (sidebar, tabs, sheets); each page that has moved to React
 * is drawn into it through `window.OvrtoReact.view(name)`. Add a page: write it in pages/, list it in VIEWS.
 */
import { createElement, type ComponentType } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Insights } from './pages/Insights';

const VIEWS: Record<string, ComponentType> = {
  insights: Insights,
};

// Only the page on screen keeps a React tree; its container survives the old app's redraws (it is moved, not rebuilt).
const live = new Map<string, { host: HTMLElement; root: Root }>();

function view(name: string): Node[] {
  for (const [k, v] of live) if (k !== name) { v.root.unmount(); live.delete(k); }
  let e = live.get(name);
  if (!e) {
    const host = document.createElement('div');
    host.style.display = 'contents'; // its children lay out as the page's own children
    host.dataset.react = name;
    e = { host, root: createRoot(host) };
    live.set(name, e);
  }
  flushSync(() => e!.root.render(createElement(VIEWS[name])));
  return [e.host];
}

(window as unknown as { OvrtoReact: unknown }).OvrtoReact = { view, has: (name: string) => name in VIEWS };
