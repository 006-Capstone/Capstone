import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
// Design tokens + shared component classes must load before any component
// styles so base rules win by order
import './styles/design-tokens.css';
import './styles/shared.css';
import App from './App';

import { NotificationProvider } from './context/NotificationContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </StrictMode>
);
