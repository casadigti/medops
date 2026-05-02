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

import { MisSolicitudes } from './pages/MisSolicitudes';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    async function fetchSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setUserRole(data?.role);
      }
      setLoading(false);
    }
    fetchSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setUserRole(data?.role);
      } else {
        setUserRole(null);
      }
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
                <Route path="/" element={userRole === 'Cirujano' ? <MisSolicitudes /> : <Dashboard />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/cirugias" element={<Cirugias />} />
                <Route path="/bandejas" element={<Bandejas />} />
                <Route path="/mantenimiento" element={<Mantenimiento />} />
                <Route path="/directorio" element={<Directorio />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/configuracion" element={<Configuracion />} />
                <Route path="/mis-solicitudes" element={<MisSolicitudes />} />
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
