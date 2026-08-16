import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminDashboard } from './pages/AdminDashboard';
import { RifaDetail } from './pages/RifaDetail';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/rifa/:id" element={<RifaDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
