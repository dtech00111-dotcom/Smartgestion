import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const PATH_LABELS = {
  '': 'Tableau de bord',
  admin: 'Administration',
  analytics: 'Analytics',
  facultes: 'Facultés',
  promotions: 'Promotions',
  etudiants: 'Étudiants',
  visiteurs: 'Visiteurs',
  abonner: 'Abonner',
  activites: 'Activités',
  formateurs: 'Formateurs',
  'types-activite': "Types d'activité",
  reservations: 'Réservations',
  paiements: 'Paiements',
  facturation: 'Facturation & caisse',
  exports: 'Exports',
  parametres: 'Paramètres',
  'audit-logs': 'Audit Logs',
  annonces: 'Annonces',
};

export default function BreadcrumbNav() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const items = [
    { path: '/', label: 'Accueil', isHome: true },
    ...segments.map((seg, i) => {
      const path = '/' + segments.slice(0, i + 1).join('/');
      const label = PATH_LABELS[seg] || (seg.match(/^[0-9a-f-]{36}$/i) ? 'Détail' : seg);
      return { path, label, isHome: false };
    }),
  ];

  if (items.length <= 1) return null;

  return (
    <nav aria-label="Fil d'Ariane" className="mb-2">
      <ol className="breadcrumb mb-0 py-1 px-0 bg-transparent small">
        {items.map((item, i) => (
          <li key={`${item.path}-${i}`} className="breadcrumb-item d-flex align-items-center">
            {i > 0 && <ChevronRight size={14} className="text-muted mx-1 flex-shrink-0" />}
            {i === items.length - 1 ? (
              <span className="text-body fw-medium d-flex align-items-center">
                {item.isHome && <Home size={14} className="me-1" />}
                {item.label}
              </span>
            ) : (
              <Link to={item.path} className="text-muted text-decoration-none d-flex align-items-center hover-primary">
                {item.isHome && <Home size={14} className="me-1" />}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
