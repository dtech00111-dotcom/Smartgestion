import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import FormateurProtectedRoute from './components/FormateurProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import SupabaseConfigBanner from './components/SupabaseConfigBanner';
import KeepAliveSession from './components/KeepAliveSession';
import ResumeRepaint from './components/ResumeRepaint';
import './App.css';

const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const Portal = lazy(() => import('./pages/Portal'));
const UnifiedLogin = lazy(() => import('./pages/UnifiedLogin'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Facultes = lazy(() => import('./pages/Facultes'));
const FaculteDetail = lazy(() => import('./pages/FaculteDetail'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Etudiants = lazy(() => import('./pages/Etudiants'));
const Visiteurs = lazy(() => import('./pages/Visiteurs'));
const Formateurs = lazy(() => import('./pages/Formateurs'));
const Activites = lazy(() => import('./pages/Activites'));
const ActiviteDetail = lazy(() => import('./pages/ActiviteDetail'));
const TypesActivite = lazy(() => import('./pages/TypesActivite'));
const Paiements = lazy(() => import('./pages/Paiements'));
const Facturation = lazy(() => import('./pages/Facturation'));
const Exports = lazy(() => import('./pages/Exports'));
const Parametres = lazy(() => import('./pages/Parametres'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Abonner = lazy(() => import('./pages/Abonner'));
const InscriptionForm = lazy(() => import('./pages/InscriptionForm'));
const ReserveForm = lazy(() => import('./pages/ReserveForm'));
const ReservationCalendrier = lazy(() => import('./pages/ReservationCalendrier'));
const Reservations = lazy(() => import('./pages/Reservations'));
const ReservationsDashboard = lazy(() => import('./pages/ReservationsDashboard'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Annonces = lazy(() => import('./pages/Annonces'));
const FormateurDashboard = lazy(() => import('./pages/FormateurDashboard'));
const FormateurLogin = lazy(() => import('./pages/FormateurLogin'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" role="status" aria-label="Chargement" />
      <p className="text-slate-500 text-sm mt-3">Chargement…</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <KeepAliveSession />
          <ResumeRepaint />
          <SupabaseConfigBanner />
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Portal />} />
              <Route path="/login" element={<UnifiedLogin />} />
              <Route path="/register/:activityId" element={<InscriptionForm />} />
              <Route path="/inscription/:activityId" element={<InscriptionForm />} />
              <Route path="/register" element={<InscriptionForm />} />
              <Route path="/inscription" element={<InscriptionForm />} />
              <Route path="/reserve/:activityId" element={<ReserveForm />} />
              <Route path="/reserve" element={<ReservationCalendrier />} />
              <Route path="/formateur/login" element={<FormateurLogin />} />
              <Route
                path="/formateur"
                element={
                  <ErrorBoundary>
                    <FormateurProtectedRoute>
                      <FormateurDashboard />
                    </FormateurProtectedRoute>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="facultes" element={<Facultes />} />
                <Route path="facultes/:id" element={<FaculteDetail />} />
                <Route path="promotions" element={<Promotions />} />
                <Route path="etudiants" element={<Etudiants />} />
                <Route path="visiteurs" element={<Visiteurs />} />
                <Route path="abonner" element={<Abonner />} />
                <Route path="formateurs" element={<Formateurs />} />
                <Route path="activites" element={<Activites />} />
                <Route path="activites/:id" element={<ActiviteDetail />} />
                <Route path="reservations" element={<ReservationsDashboard />} />
                <Route path="reservations-legacy" element={<Reservations />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="annonces" element={<Annonces />} />
                <Route path="types-activite" element={<TypesActivite />} />
                <Route path="paiements" element={<Paiements />} />
                <Route path="facturation" element={<Facturation />} />
                <Route path="exports" element={<Exports />} />
                <Route path="parametres" element={<Parametres />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
