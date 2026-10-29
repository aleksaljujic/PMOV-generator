// FROZEN (T00). Mounts the app shell owned by T09.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/shell';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
