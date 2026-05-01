import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Cirugias } from './pages/Cirugias';
import { Bandejas } from './pages/Bandejas';
import { Directorio } from './pages/Directorio';
import { Reportes } from './pages/Reportes';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cirugias" element={<Cirugias />} />
          <Route path="/bandejas" element={<Bandejas />} />
          <Route path="/directorio" element={<Directorio />} />
          <Route path="/reportes" element={<Reportes />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
