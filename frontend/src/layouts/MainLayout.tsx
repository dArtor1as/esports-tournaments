import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { UserCircle } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/'); // Примусово викидаємо на головну
  };

  return (
    <div className="min-h-screen bg-esports-dark text-white">
      <header className="border-b border-slate-800 bg-esports-dark/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          {/* Клік на CyberBracket повертає на головну */}
          <Link
            to="/"
            className="text-2xl font-bold text-esports-accent hover:opacity-80 transition-opacity"
          >
            CyberBracket
          </Link>

          <nav className="flex gap-6 items-center font-medium">
            <Link
              to="/"
              className="text-esports-light hover:text-esports-accent transition"
            >
              Турніри
            </Link>
            <Link
              to="/leaderboards"
              className="text-esports-light hover:text-esports-accent transition"
            >
              Рейтинги гравців
            </Link>
            <Link
              to="/teams"
              className="text-esports-light hover:text-esports-accent transition"
            >
              Команди
            </Link>

            {user ? (
              <div className="flex items-center gap-4 ml-4 pl-6 border-l border-slate-700">
                {/* Клік на нікнейм веде в профіль */}
                <Link
                  to={`/profile/${user.id}`}
                  className="flex items-center gap-2 text-esports-light hover:text-esports-accent transition"
                >
                  <UserCircle size={20} />
                  <span>{user.username}</span>
                  {user.role === 'ADMIN' && (
                    <span className="text-[10px] bg-esports-accent text-black px-1 rounded font-black">
                      ADM
                    </span>
                  )}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  Вийти
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button className="bg-esports-primary hover:bg-esports-primary/90">
                  Увійти
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
