import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Fontes do tema, servidas junto com o site (sem depender de terceiros):
// Inter para o texto e Unbounded para o nome e os títulos.
import '@fontsource-variable/inter';
import '@fontsource-variable/unbounded';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
