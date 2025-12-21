import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth';

// Protected route wrapper - redirects to login if not authenticated
export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  // Show nothing while checking auth state
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner-large"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Render child routes
  return <Outlet />;
}

// Public route wrapper - redirects to chat if already authenticated
export function PublicRoute() {
  const { user, isLoading } = useAuth();

  // Show nothing while checking auth state
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner-large"></div>
      </div>
    );
  }

  // Redirect to chat if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  // Render child routes
  return <Outlet />;
}
