import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Головна' },
  { to: '/generation', label: 'Генерація сітки' },
  { to: '/simulation', label: 'Симуляція та візуалізація' },
];

export function ShellLayout() {
  return (
    <div className="shell">
      <header className="site-header">
        <div>
          <p className="site-eyebrow">Esports Tournament System</p>
          <h1 className="site-title">Адмін-панель турнірних сіток</h1>
        </div>
        <nav className="site-nav" aria-label="Головна навігація">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link--active' : 'nav-link'
              }
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>Панель керування турнірами</span>
        <span>React + NestJS + Prisma</span>
      </footer>
    </div>
  );
}
