import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Disable StrictMode in development to prevent double-invocation of effects
// which causes duplicate initialization logs
// You can re-enable it if you want to catch potential issues, but it causes
// double execution of effects, useEffects, etc.
const StrictModeWrapper = process.env.NODE_ENV === 'production' 
  ? React.StrictMode 
  : React.Fragment;

root.render(
  <StrictModeWrapper>
    <App />
  </StrictModeWrapper>
);

