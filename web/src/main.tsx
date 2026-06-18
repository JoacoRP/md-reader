import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ThemeBridge from './components/ThemeBridge';
import './styles/variables.css';
import './styles/markdown.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeBridge>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeBridge>
  </React.StrictMode>
);
