import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Import Pet Care Pages
import Bookings from './pages/pet-care/Bookings';
import Rooms from './pages/pet-care/Rooms';
import Dashboard from './pages/Dashboard';
import PetList from './pages/pet-care/PetList';
import PetForm from './pages/pet-care/PetForm';
import MedicalRecords from './pages/pet-care/MedicalRecords';
import MedicalRecordForm from './pages/pet-care/MedicalRecordForm';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50">Memuat...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="rooms" element={<Rooms />} />

              <Route path="pets" element={<PetList />} />
              <Route path="pets/add" element={<PetForm />} />

              <Route path="medical-records" element={<MedicalRecords />} />
              <Route path="medical-records/add" element={<MedicalRecordForm />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
