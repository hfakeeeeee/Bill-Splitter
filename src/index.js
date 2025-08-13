import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import { auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
signInAnonymously(auth).catch(console.error); 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 