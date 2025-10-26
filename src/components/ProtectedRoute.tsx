import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'moderator' | 'user')[]; // Optional: Add role-based access control
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, userInfo } = useAuth();
  const location = useLocation();

  if (loading) {
    // Show a loading indicator while auth state is being determined
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // User not logged in, redirect them to the login page
    // Pass the current location in state so they can be redirected back
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Optional: Role-based access check
  if (allowedRoles && (!userInfo?.role || !allowedRoles.includes(userInfo.role))) {
    // User is logged in but doesn't have the required role, redirect to home or an unauthorized page
    console.warn(`User role '${userInfo?.role}' not allowed for this route. Allowed roles: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />; // Redirect to home page
  }


  // User is authenticated (and has the required role, if specified), render the child component
  return <>{children}</>;
};
