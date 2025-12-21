import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, AuthPage } from '@/features/auth';
import { ChatDashboard } from '@/features/chat';
import { ProtectedRoute, PublicRoute } from '@/components/RouteGuards';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/Toast';
import '@/components/ErrorBoundary.css';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes - redirect to chat if already logged in */}
              <Route element={<PublicRoute />}>
                <Route path="/login" element={<AuthPage />} />
              </Route>
              {/* Protected routes - redirect to login if not logged in */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<ChatDashboard />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
