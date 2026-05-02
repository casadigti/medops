import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Calendario } from './pages/Calendario';
import { Cirugias } from './pages/Cirugias';
import { Bandejas } from './pages/Bandejas';
import { Mantenimiento } from './pages/Mantenimiento';
import { Directorio } from './pages/Directorio';
import { Reportes } from './pages/Reportes';
import { Configuracion } from './pages/Configuracion';
import { Login } from './pages/Login';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-400">Cargando...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        {/* Protected Routes inside Layout */}
        <Route path="/*" element={
          session ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/cirugias" element={<Cirugias />} />
                <Route path="/bandejas" element={<Bandejas />} />
                <Route path="/mantenimiento" element={<Mantenimiento />} />
                <Route path="/directorio" element={<Directorio />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/configuracion" element={<Configuracion />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" />
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;
