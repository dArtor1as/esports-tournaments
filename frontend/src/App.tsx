import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import PlayerStats from "./pages/PlayerStats";
import ProtectedRoute from "./components/ProtectedRoute";
import Teams from "./pages/Teams";
import TeamProfile from "./pages/TeamProfile";
import AcceptTeamInvite from "./pages/AcceptTeamInvite";
import Register from "./pages/Register";

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
            <Route path="register" element={<Register />} />
            <Route path="player/:id" element={<PlayerStats />} />
            <Route path="teams" element={<Teams />} />
            <Route path="team/:id" element={<TeamProfile />} />

            {/* Тільки для залогінених користувачів */}
            <Route element={<ProtectedRoute />}>
              <Route path="profile/:id" element={<Profile />} />
              <Route path="invite/team" element={<AcceptTeamInvite />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
