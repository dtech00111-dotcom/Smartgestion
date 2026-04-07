import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import FormateurProtectedRoute from './components/FormateurProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import Portal from './pages/Portal';
import UnifiedLogin from './pages/UnifiedLogin';
import Dashboard from './pages/Dashboard';
import Facultes from './pages/Facultes';
import FaculteDetail from './pages/FaculteDetail';
import Promotions from './pages/Promotions';
import Etudiants from './pages/Etudiants';
import Visiteurs from './pages/Visiteurs';
import Formateurs from './pages/Formateurs';
import Activites from './pages/Activites';
import ActiviteDetail from './pages/ActiviteDetail';
import TypesActivite from './pages/TypesActivite';
import Paiements from './pages/Paiements';
import Facturation from './pages/Facturation';
import Exports from './pages/Exports';
import Parametres from './pages/Parametres';
import Analytics from './pages/Analytics';
import Abonner from './pages/Abonner';
import InscriptionForm from './pages/InscriptionForm';
import ReserveForm from './pages/ReserveForm';
import ReservationCalendrier from './pages/ReservationCalendrier';
import Reservations from './pages/Reservations';
import ReservationsDashboard from './pages/ReservationsDashboard';
import AuditLogs from './pages/AuditLogs';
import Annonces from './pages/Annonces';
import FormateurDashboard from './pages/FormateurDashboard';
import FormateurLogin from './pages/FormateurLogin';
import ErrorBoundary from './components/ErrorBoundary';
import SupabaseConfigBanner from './components/SupabaseConfigBanner';
import KeepAliveSession from './components/KeepAliveSession';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <KeepAliveSession />
        <SupabaseConfigBanner />
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          {/* Portail d'entrée - choix du mode */}
          <Route path="/" element={<Portal />} />
          <Route path="/login" element={<UnifiedLogin />} />
          {/* Formulaire public QR - sans authentification */}
          <Route path="/register/:activityId" element={<InscriptionForm />} />
          <Route path="/inscription/:activityId" element={<InscriptionForm />} />
          <Route path="/register" element={<InscriptionForm />} />
          <Route path="/inscription" element={<InscriptionForm />} />
          <Route path="/reserve/:activityId" element={<ReserveForm />} />
          <Route path="/reserve" element={<ReservationCalendrier />} />
          {/* Formateur - login (lien/QR) puis dashboard */}
          <Route path="/formateur/login" element={<FormateurLogin />} />
          <Route path="/formateur" element={<ErrorBoundary><FormateurProtectedRoute><FormateurDashboard /></FormateurProtectedRoute></ErrorBoundary>} />
          {/* Admin - protégé */}
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
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
