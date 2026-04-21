import { Navigate, Route, Routes } from 'react-router-dom';
import { ShellLayout } from './components/layout/ShellLayout';
import { HomePage } from './pages/HomePage';
import { GenerationPage } from './pages/GenerationPage';
import { SimulationPage } from './pages/SimulationPage';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<ShellLayout />}>
        <Route index element={<HomePage />} />
        <Route path="generation" element={<GenerationPage />} />
        <Route path="simulation" element={<SimulationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
