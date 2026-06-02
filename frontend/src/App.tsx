import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Profile from './pages/Profile';
import PlayerStats from './pages/PlayerStats';
import ProtectedRoute from './components/ProtectedRoute';
import Teams from './pages/Teams';
import TeamProfile from './pages/TeamProfile';
import AcceptTeamInvite from './pages/AcceptTeamInvite';
import Register from './pages/Register';
import Tournaments from './pages/Tournaments';
import TournamentDetails from './pages/TournamentDetails';
import MatchRoom from './pages/MatchRoom';
import Inbox from './pages/Inbox';
import Leaderboard from './pages/Leaderboard';
import AdminWorkflow from './pages/AdminWorkflow';
import MyTournaments from './pages/MyTournaments';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Tournaments />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="player/:id" element={<PlayerStats />} />
            <Route path="teams" element={<Teams />} />
            <Route path="team/:id" element={<TeamProfile />} />
            <Route path="match/:id" element={<MatchRoom />} />
            <Route path="matches/:id" element={<MatchRoom />} />
            <Route path="tournament/:id" element={<TournamentDetails />} />
            <Route path="/leaderboards" element={<Leaderboard />} />

            {/* Тільки для залогінених користувачів */}
            <Route element={<ProtectedRoute />}>
              <Route path="profile/:id" element={<Profile />} />
              <Route path="invite/team" element={<AcceptTeamInvite />} />
              <Route path="invite/tournament" element={<Inbox />} />
              <Route path="my-tournaments" element={<MyTournaments />} />
              <Route path="admin/workflow" element={<AdminWorkflow />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
