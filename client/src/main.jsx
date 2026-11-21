import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ReferenceProvider } from './context/ReferenceContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ReferenceProvider>
            <App />
          </ReferenceProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
