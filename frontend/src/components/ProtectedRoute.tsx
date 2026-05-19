import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: ('ADMIN' | 'USER')[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, token } = useAuth();

  // Якщо немає токена — на логін
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Якщо ролі вказані і роль юзера не підходить — на головну (або 403 сторінку)
  if (allowedRoles && user && !allowedRoles.includes(user.role as any)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
