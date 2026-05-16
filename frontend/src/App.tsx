import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import PlayerStats from "./pages/PlayerStats";
import ProtectedRoute from "./components/ProtectedRoute";
import Teams from "./pages/Teams";

const Home = () => (
  <div>
    <h1 className="text-3xl font-bold mb-4 text-esports-light">
      Головна панель
    </h1>
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
            <Route path="player/:id" element={<PlayerStats />} />
            <Route path="teams" element={<Teams />} />

            {/* Тільки для залогінених користувачів */}
            <Route element={<ProtectedRoute />}>
              <Route path="profile/:id" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
