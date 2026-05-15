import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

// Тимчасова головна сторінка
const Home = () => (
  <div>
    <h1 className="text-3xl font-bold mb-4">Вітаємо в системі турнірів!</h1>
    <p className="text-esports-muted">Тут скоро буде список турнірів.</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />

            {/* Тільки для залогінених */}
            <Route element={<ProtectedRoute />}>
              {/* Тут будуть всі сторінки, доступні для будь-якого залогіненого юзера */}
            </Route>

            {/* Тільки для Адмінів */}
            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              {/* Тут будуть всі сторінки, доступні тільки для Адмінів */}
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
