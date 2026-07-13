import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './mercenary-overrides.css';
import './frenzy-stats.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
