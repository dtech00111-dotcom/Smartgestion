import { useState, useEffect, Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Nav, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import {
  LayoutDashboard,
  BarChart3,
  GraduationCap,
  Layers,
  Users,
  UserCheck,
  UserPlus,
  Tags,
  CalendarDays,
  Wallet,
  FileDown,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarCheck,
  Megaphone,
  FileText,
  Landmark,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const sectionsConfig = [
  { label: null, items: [
    { path: '/admin', Icon: LayoutDashboard, label: 'Dashboard', badgeKey: null },
    { path: '/admin/analytics', Icon: BarChart3, label: 'Statistiques', badgeKey: null },
  ] },
  { label: 'RÉSERVATIONS', items: [
    { path: '/admin/reservations', Icon: CalendarCheck, label: 'Réservations', badgeKey: 'reservations' },
    { path: '/reserve', Icon: CalendarDays, label: 'Calendrier public', badgeKey: null, external: true },
  ] },
  { label: 'ACADÉMIQUE', items: [
    { path: '/admin/facultes', Icon: GraduationCap, label: 'Facultés', badgeKey: 'facultes' },
    { path: '/admin/promotions', Icon: Layers, label: 'Promotions', badgeKey: 'promotions' },
    { path: '/admin/etudiants', Icon: Users, label: 'Étudiants', badgeKey: 'etudiants' },
    { path: '/admin/visiteurs', Icon: UserCheck, label: 'Visiteurs', badgeKey: 'visiteurs' },
    { path: '/admin/abonner', Icon: UserPlus, label: 'Abonner', badgeKey: null },
  ] },
  { label: 'ACTIVITÉS', items: [
    { path: '/admin/types-activite', Icon: Tags, label: "Types d'activité", badgeKey: 'types' },
    { path: '/admin/formateurs', Icon: Users, label: 'Formateurs', badgeKey: null },
    { path: '/admin/activites', Icon: CalendarDays, label: 'Activités', badgeKey: 'activites' },
  ] },
  { label: 'FINANCE', items: [
    { path: '/admin/paiements', Icon: Wallet, label: 'Paiements', badgeKey: 'enAttente' },
    { path: '/admin/facturation', Icon: Landmark, label: 'Facturation & caisse', badgeKey: null },
    { path: '/admin/exports', Icon: FileDown, label: 'Exports', badgeKey: null },
  ] },
  { label: 'ADMINISTRATION', items: [
    { path: '/admin/annonces', Icon: Megaphone, label: 'Annonces', badgeKey: null },
    { path: '/admin/audit-logs', Icon: FileText, label: 'Audit Logs', badgeKey: null },
    { path: '/admin/parametres', Icon: Settings, label: 'Paramètres', badgeKey: null },
  ] },
];

export default function Sidebar({ collapsed, onToggle, onNavigate, mobile }) {
  const [badges, setBadges] = useState({});

  useEffect(() => {
    async function loadBadges() {
      try {
        const [act, part, etu, vis, resPending] = await Promise.all([
          supabase.from('activities').select('id', { count: 'exact', head: true }),
          supabase.from('participations').select('id').eq('statut_paiement', 'en_attente'),
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('visitors').select('id', { count: 'exact', head: true }),
          supabase.from('reservations').select('id').eq('status', 'pending').then((r) => r).catch(() => ({ data: [] })),
        ]);
        setBadges({
          activites: act.count || 0,
          enAttente: part.data?.length || 0,
          etudiants: etu.count || 0,
          visiteurs: vis.count || 0,
          reservations: (resPending?.data?.length ?? 0) || 0,
        });
      } catch {
        setBadges({});
      }
    }
    loadBadges();
  }, []);

  const handleNavClick = () => {
    if (onNavigate) onNavigate();
  };

  const renderNavLink = (item) => {
    const { path, Icon, label, badgeKey, external } = item;
    const count = badgeKey ? badges[badgeKey] : null;
    const link = external ? (
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className={`d-flex align-items-center rounded-3 px-3 py-2 mb-1 sidebar-nav-link text-decoration-none ${collapsed ? 'justify-content-center px-2' : ''}`}
        onClick={handleNavClick}
      >
        <Icon className="flex-shrink-0" size={20} strokeWidth={2} />
        {!collapsed && <span className="flex-grow-1 text-truncate ms-2">{label}</span>}
      </a>
    ) : (
      <Nav.Link
        as={NavLink}
        to={path}
        onClick={handleNavClick}
        end={path === '/admin'}
        className={`d-flex align-items-center rounded-3 px-3 py-2 mb-1 sidebar-nav-link ${collapsed ? 'justify-content-center px-2' : ''}`}
      >
        <Icon className="flex-shrink-0" size={20} strokeWidth={2} />
        {!collapsed && (
          <>
            <span className="flex-grow-1 text-truncate ms-2">{label}</span>
            {count != null && count > 0 && (badgeKey === 'enAttente' || badgeKey === 'reservations') && (
              <span className="badge bg-warning text-dark ms-2 animate-pulse-badge">{count}</span>
            )}
          </>
        )}
      </Nav.Link>
    );
    if (collapsed) {
      return (
        <OverlayTrigger key={path} placement="right" overlay={<Tooltip id={`tooltip-${path}`}>{label}</Tooltip>}>
          <div className="w-100">{link}</div>
        </OverlayTrigger>
      );
    }
    return <Fragment key={path}>{link}</Fragment>;
  };

  return (
    <>
      <div className="p-3 border-bottom sidebar-brand-wrapper">
        <div className={`d-flex align-items-center ${collapsed ? 'justify-content-center' : 'gap-2'}`}>
          <div className="position-relative flex-shrink-0">
            <img src="/logo-salle-numerique.png" alt="Salle du Numérique" className="rounded-3" style={{ width: 42, height: 42, objectFit: 'contain' }} />
            <span className="position-absolute bottom-0 end-0 bg-primary rounded-circle d-flex align-items-center justify-content-center" style={{ width: 14, height: 14 }}>
              <Sparkles size={8} className="text-white" strokeWidth={2.5} />
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-grow-1 sidebar-brand">
              <h6 className="mb-0 fw-bold text-truncate">SMART GESTION</h6>
              <small className="text-truncate d-block opacity-75">Salle du Numérique</small>
            </div>
          )}
        </div>
      </div>

      <Nav className="flex-column flex-grow-1 p-2 overflow-auto sidebar-nav">
        {sectionsConfig.map((section, idx) => (
          <div key={section.label || 'main'} className="mb-3" style={{ animationDelay: `${idx * 30}ms` }}>
            {section.label && !collapsed && (
              <div className="px-3 mb-1 small text-uppercase sidebar-section-label">{section.label}</div>
            )}
            {section.items.map(renderNavLink)}
          </div>
        ))}
      </Nav>

      {!mobile && (
        <div className="p-2 border-top">
          <OverlayTrigger placement="right" overlay={<Tooltip>{collapsed ? 'Agrandir le menu' : 'Réduire le menu'}</Tooltip>}>
            <Button variant="outline-secondary" size="sm" className="w-100 d-flex align-items-center justify-content-center gap-2 text-decoration-none p-2 sidebar-toggle-btn" onClick={onToggle}>
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!collapsed && <span className="small">Réduire</span>}
            </Button>
          </OverlayTrigger>
        </div>
      )}
    </>
  );
}
