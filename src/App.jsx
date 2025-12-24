import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { POSProvider } from './context/POSContext';
import { StoresProvider } from './context/StoresContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import { Loader2 } from 'lucide-react';

// Lazy Load Pages
const Bookings = React.lazy(() => import('./pages/pet-care/Bookings'));
const BookingForm = React.lazy(() => import('./pages/pet-care/BookingForm'));
const Rooms = React.lazy(() => import('./pages/pet-care/Rooms'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const PetList = React.lazy(() => import('./pages/pet-care/PetList'));
const PetDetail = React.lazy(() => import('./pages/pet-care/PetDetail'));
const PetForm = React.lazy(() => import('./pages/pet-care/PetForm'));
const Medicines = React.lazy(() => import('./pages/pet-care/Medicines'));
const PetProfitReport = React.lazy(() => import('./pages/pet-care/PetProfitReport'));
const FeeReport = React.lazy(() => import('./pages/pet-care/FeeReport'));
const MedicalRecords = React.lazy(() => import('./pages/pet-care/MedicalRecords'));
const MedicalRecordForm = React.lazy(() => import('./pages/pet-care/MedicalRecordForm'));
const Services = React.lazy(() => import('./pages/pet-care/Services'));
const ServiceClinic = React.lazy(() => import('./pages/pet-care/services/ServiceClinic'));
const ServiceGrooming = React.lazy(() => import('./pages/pet-care/services/ServiceGrooming'));
const ServiceHotel = React.lazy(() => import('./pages/pet-care/services/ServiceHotel'));
const Stores = React.lazy(() => import('./pages/Stores'));
const Staff = React.lazy(() => import('./pages/Staff'));
const Customers = React.lazy(() => import('./pages/Customers'));
const Reports = React.lazy(() => import('./pages/pet-care/Reports'));
const DailyLog = React.lazy(() => import('./pages/pet-care/DailyLog'));
const CashFlow = React.lazy(() => import('./pages/pet-care/CashFlow'));
const Settings = React.lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      <p className="text-sm text-slate-500 font-medium">Memuat aplikasi...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <StoresProvider>
          <POSProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="pet-care">
                    <Route path="bookings" element={<Bookings />} />
                    <Route path="bookings/add" element={<BookingForm />} />
                    <Route path="bookings/edit/:id" element={<BookingForm />} />
                    <Route path="rooms" element={<Rooms />} />
                    <Route path="services" element={<Services />} />
                    <Route path="services/clinic" element={<ServiceClinic />} />
                    <Route path="services/grooming" element={<ServiceGrooming />} />
                    <Route path="services/hotel" element={<ServiceHotel />} />

                    <Route path="pets" element={<PetList />} />
                    <Route path="patients/:id" element={<PetDetail />} />
                    <Route path="pets/add" element={<PetForm />} />
                    <Route path="pets/edit/:id" element={<PetForm />} />

                    <Route path="medical-records" element={<MedicalRecords />} />
                    <Route path="medical-records/add" element={<MedicalRecordForm />} />
                    <Route path="medical-records/edit/:id" element={<MedicalRecordForm />} />
                    <Route path="medicines" element={<Medicines />} />
                    <Route path="profit-report" element={<PetProfitReport />} />
                    <Route path="fee-report" element={<FeeReport />} />
                    <Route path="daily-log" element={<DailyLog />} />
                    <Route path="cash-flow" element={<CashFlow />} />
                  </Route>

                  {/* Super Admin Stores */}
                  <Route path="stores" element={<Stores />} />

                  {/* Staff Management */}
                  <Route path="staff" element={<Staff />} />
                  <Route path="customers" element={<Customers />} />

                  {/* Financial Reports */}
                  <Route path="reports" element={<Reports />} />

                  {/* Settings */}
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </POSProvider>
        </StoresProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
