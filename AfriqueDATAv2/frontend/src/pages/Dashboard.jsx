import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, Form, InputGroup, Button, Table, Spinner } from 'react-bootstrap';
import { supabase } from '../lib/supabase';
import { Search, CalendarDays, Users, DollarSign, ChevronRight, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CARD_COLORS = ['#dc2626', '#ef4444', '#b91c1c', '#991b1b'];
const PIE_COLORS = ['#dc2626', '#f87171'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    activites: 0,
    totalEncaisse: 0,
    etudiants: 0,
    visiteurs: 0,
    visiteursFiches: 0,
    abonnementsActifs: 0,
    caisseJourFc: 0,
    caisseJourUsd: 0,
    typesParticipation: {},
  });
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ activities: [], students: [] });
  const [searching, setSearching] = useState(false);
  const [heatmapData, setHeatmapData] = useState({ byDay: [], max: 0 });
  const [todayEncaisse, setTodayEncaisse] = useState(0);
  const [enAttenteCount, setEnAttenteCount] = useState(0);

  function formatRelativeTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function buildHeatmapData(participations) {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const byDay = days.map((label) => ({ label, values: Array(12).fill(0) }));
    let max = 0;
    const now = new Date();
    participations.forEach((p) => {
      const d = new Date(p.created_at);
      const dayIdx = (d.getDay() + 6) % 7;
      const weekDiff = Math.floor((now - d) / (7 * 24 * 60 * 60 * 1000));
      const weekIdx = 11 - Math.min(weekDiff, 11);
      if (weekIdx >= 0 && weekIdx < 12) {
        byDay[dayIdx].values[weekIdx] = (byDay[dayIdx].values[weekIdx] || 0) + 1;
        max = Math.max(max, byDay[dayIdx].values[weekIdx]);
      }
    });
    return { byDay, max };
  }

  useEffect(() => {
    async function loadDashboard() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [actRes, partRes, visCount, aboRes, caisseRes] = await Promise.all([
          supabase.from('activities').select('id', { count: 'exact', head: true }),
          supabase.from('participations').select('nom_complet, montant, type_participant, statut_paiement, created_at, encaissement_type, activities(nom)').order('created_at', { ascending: false }).limit(500),
          supabase.from('visitors').select('id', { count: 'exact', head: true }),
          supabase.from('abonnements').select('id', { count: 'exact', head: true }).eq('statut', 'actif').then((r) => r).catch(() => ({ count: 0 })),
          supabase.from('cash_ledger').select('sens, montant_fc, montant_usd, jour').eq('jour', today).then((r) => r).catch(() => ({ data: [] })),
        ]);
        const participations = partRes.data || [];
        const totalEncaisse = participations.reduce((s, p) => s + Number(p.montant), 0);
        const etudiants = participations.filter((p) => p.type_participant === 'etudiant').length;
        const visiteurs = participations.filter((p) => p.type_participant === 'visiteur').length;
        const visiteursFiches = visCount.count ?? 0;
        const abonnementsActifs = aboRes.count ?? 0;
        const typesParticipation = {};
        participations.forEach((p) => {
          const k = p.encaissement_type || 'inscription_activite';
          typesParticipation[k] = (typesParticipation[k] || 0) + 1;
        });
        let caisseJourFc = 0;
        let caisseJourUsd = 0;
        (caisseRes.data || []).forEach((l) => {
          if (l.sens === 'encaissement') {
            caisseJourFc += Number(l.montant_fc) || 0;
            caisseJourUsd += Number(l.montant_usd) || 0;
          } else {
            caisseJourFc -= Number(l.montant_fc) || 0;
            caisseJourUsd -= Number(l.montant_usd) || 0;
          }
        });
        const todayTotal = participations.filter((p) => p.created_at?.slice(0, 10) === today).reduce((s, p) => s + Number(p.montant), 0);
        const enAttente = participations.filter((p) => p.statut_paiement === 'en_attente').length;
        const byMonth = {};
        participations.forEach((p) => {
          const d = new Date(p.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          byMonth[key] = (byMonth[key] || 0) + Number(p.montant);
        });
        const barChart = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([mois, montant]) => ({ mois, encaissements: montant }));
        let pieChartData = [
          { name: 'Étudiants', value: etudiants, color: PIE_COLORS[0] },
          { name: 'Visiteurs', value: visiteurs, color: PIE_COLORS[1] },
        ].filter((d) => d.value > 0);
        if (pieChartData.length === 0) pieChartData = [{ name: 'Aucune donnée', value: 1, color: '#e2e8f0' }];
        setStats({
          activites: actRes.count || 0,
          totalEncaisse,
          etudiants,
          visiteurs,
          visiteursFiches,
          abonnementsActifs,
          caisseJourFc,
          caisseJourUsd,
          typesParticipation,
        });
        setTodayEncaisse(todayTotal);
        setEnAttenteCount(enAttente);
        setChartData(barChart);
        setPieData(pieChartData);
        setRecentActivity(participations.slice(0, 10));
        setHeatmapData(buildHeatmapData(participations));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchQuery?.trim();
    if (!q || q.length < 2) {
      setSearchResults({ activities: [], students: [] });
      return;
    }
    setSearching(true);
    try {
      const [actRes, partRes] = await Promise.all([
        supabase.from('activities').select('id, nom, date_debut, activity_types(nom)').ilike('nom', `%${q}%`).limit(20),
        supabase.from('participations').select('id, nom_complet, montant, activity_id, activities(id, nom)').ilike('nom_complet', `%${q}%`).limit(30),
      ]);
      setSearchResults({ activities: actRes.data || [], students: partRes.data || [] });
    } catch {
      setSearchResults({ activities: [], students: [] });
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const q = searchQuery?.trim();
    if (!q || q.length < 2) {
      setSearchResults({ activities: [], students: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => handleSearch(), 400);
    return () => clearTimeout(t);
  }, [searchQuery, handleSearch]);

  const hasSearchResults = searchResults.activities.length > 0 || searchResults.students.length > 0;
  const cards = [
    { label: "Aujourd'hui (inscriptions)", value: todayEncaisse.toLocaleString() + ' FC', sublabel: 'via QR / participations', Icon: DollarSign, color: CARD_COLORS[1], href: '/admin/paiements' },
    { label: 'Visiteurs (fiches)', value: stats.visiteursFiches, sublabel: 'registre visiteurs', Icon: Users, color: CARD_COLORS[2], href: '/admin/visiteurs' },
    { label: 'Abonnements actifs', value: stats.abonnementsActifs, sublabel: 'comptes actifs', Icon: CalendarDays, color: CARD_COLORS[0], href: '/admin/abonner' },
    { label: 'Caisse du jour', value: `${stats.caisseJourFc.toLocaleString()} FC`, sublabel: stats.caisseJourUsd ? `${stats.caisseJourUsd.toLocaleString()} USD (net)` : 'Facturation & caisse', Icon: DollarSign, color: CARD_COLORS[3], href: '/admin/facturation' },
    { label: 'Total activités', value: stats.activites, sublabel: 'activités créées', Icon: CalendarDays, color: '#991b1b', href: '/admin/activites' },
    { label: 'Participants (inscr.)', value: stats.etudiants + stats.visiteurs, sublabel: `${stats.etudiants} ét., ${stats.visiteurs} vis.`, Icon: Users, color: CARD_COLORS[2], href: '/admin/paiements' },
    { label: 'Total encaissé (inscr.)', value: stats.totalEncaisse.toLocaleString() + ' FC', sublabel: null, Icon: DollarSign, color: CARD_COLORS[3], href: '/admin/paiements' },
  ];

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="skeleton mb-3" style={{ width: 200, height: 32 }} />
        <Row className="g-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <Col xs={6} lg={3} key={i}>
              <div className="skeleton" style={{ height: 120 }} />
            </Col>
          ))}
        </Row>
        <Row className="g-3">
          <Col md={6} xl={4}><div className="skeleton" style={{ height: 280 }} /></Col>
          <Col md={6} xl={4}><div className="skeleton" style={{ height: 280 }} /></Col>
          <Col xl={4}><div className="skeleton" style={{ height: 280 }} /></Col>
        </Row>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="d-flex flex-column flex-sm-row flex-sm-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h4 h3-md fw-bold text-dark mb-1">Tableau de bord</h1>
          <p className="text-muted small mb-0">Vue d'ensemble de la Salle du Numérique</p>
        </div>
        <div className="d-flex gap-2 w-100 flex-sm-grow-0" style={{ maxWidth: 400 }}>
          <InputGroup size="sm">
            <InputGroup.Text><Search size={18} /></InputGroup.Text>
            <Form.Control
              placeholder="Rechercher une activité ou un étudiant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </InputGroup>
          <Button variant="primary" onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="btn-mobile-full">
            {searching ? <Spinner animation="border" size="sm" /> : <Search size={18} />}
            <span className="d-none d-sm-inline ms-1">Rechercher</span>
          </Button>
        </div>
      </div>

      {searchQuery.trim().length >= 2 && (
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-light py-3">
            <h6 className="mb-0 d-flex align-items-center"><Search size={18} className="text-primary me-2" />Résultats pour « {searchQuery} »</h6>
          </Card.Header>
          <Card.Body>
            {searching ? (
              <div className="text-center py-4"><Spinner animation="border" /></div>
            ) : !hasSearchResults ? (
              <p className="text-muted text-center py-4 mb-0">Aucun résultat trouvé.</p>
            ) : (
              <Row xs={1} md={2} className="g-3">
                {searchResults.activities.length > 0 && (
                  <Col>
                    <h6 className="text-muted small mb-2 d-flex align-items-center"><CalendarDays size={14} className="me-1" /> Activités ({searchResults.activities.length})</h6>
                    <div className="d-flex flex-column gap-2">
                      {searchResults.activities.map((a) => (
                        <Link key={a.id} to={`/admin/activites/${a.id}`} className="p-3 rounded-3 border text-dark text-decoration-none card-hover">
                          <div className="fw-medium">{a.nom}</div>
                          <small className="text-muted">{a.activity_types?.nom} • {a.date_debut}</small>
                        </Link>
                      ))}
                    </div>
                  </Col>
                )}
                {searchResults.students.length > 0 && (
                  <Col>
                    <h6 className="text-muted small mb-2 d-flex align-items-center"><Users size={14} className="me-1" /> Participants ({searchResults.students.length})</h6>
                    <div className="d-flex flex-column gap-2">
                      {searchResults.students.map((p) => (
                        <Link key={p.id} to={`/admin/activites/${p.activity_id}`} className="p-3 rounded-3 border text-dark text-decoration-none card-hover">
                          <div className="fw-medium">{p.nom_complet}</div>
                          <small className="text-muted">{p.activities?.nom || 'Activité'} • {Number(p.montant).toLocaleString()} FC</small>
                        </Link>
                      ))}
                    </div>
                  </Col>
                )}
              </Row>
            )}
          </Card.Body>
        </Card>
      )}

      {enAttenteCount > 0 && (
        <Link to="/admin/paiements" className="d-flex align-items-center gap-3 p-4 bg-warning bg-opacity-10 border border-warning rounded-3 text-decoration-none text-dark mb-4 card-hover">
          <AlertCircle size={28} className="text-warning flex-shrink-0" />
          <div>
            <p className="fw-semibold mb-0">{enAttenteCount} paiement{enAttenteCount > 1 ? 's' : ''} en attente</p>
            <p className="small text-muted mb-0">Cliquez pour valider les paiements</p>
          </div>
          <ChevronRight size={20} className="text-warning ms-auto flex-shrink-0" />
        </Link>
      )}

      <Row xs={1} sm={2} xl={4} className="g-3 mb-4">
        {cards.map(({ label, value, sublabel, Icon, color, href }) => {
          const CardWrapper = href ? Link : 'div';
          return (
            <Col key={label}>
              <CardWrapper to={href} className={href ? 'text-decoration-none' : ''}>
                <Card className={`h-100 shadow-sm card-hover ${href ? '' : ''}`}>
                  <Card.Body className="d-flex align-items-center justify-content-between">
                    <div>
                      <Card.Text className="text-muted small mb-1">{label}</Card.Text>
                      <Card.Title className="mb-0 fs-5">{value}</Card.Title>
                      {sublabel && <Card.Text className="text-muted small mb-0">{sublabel}</Card.Text>}
                    </div>
                    <div className="rounded-3 d-flex align-items-center justify-content-center text-white" style={{ width: 48, height: 48, backgroundColor: color }}>
                      <Icon size={24} strokeWidth={2} />
                    </div>
                  </Card.Body>
                </Card>
              </CardWrapper>
            </Col>
          );
        })}
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0 pb-0"><Card.Title className="h6">Revenus mensuels</Card.Title></Card.Header>
            <Card.Body>
              {chartData.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="mois" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} FC`, 'Encaissements']} />
                      <Bar dataKey="encaissements" fill="#dc2626" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 260 }}>Aucune donnée</div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0 pb-0"><Card.Title className="h6">Activité par jour (12 semaines)</Card.Title></Card.Header>
            <Card.Body>
              <div className="overflow-auto">
                <div className="d-inline-flex flex-column gap-1">
                  <div className="d-flex gap-1 mb-1">
                    <span className="w-25" style={{ minWidth: 32 }} />
                    {Array.from({ length: 12 }, (_, i) => (
                      <span key={i} className="small text-muted" style={{ width: 16, fontSize: 9 }}>{11 - i}</span>
                    ))}
                  </div>
                  {heatmapData.byDay.map((row, i) => (
                    <div key={i} className="d-flex align-items-center gap-1">
                      <span className="small" style={{ width: 28 }}>{row.label}</span>
                      <div className="d-flex gap-1">
                        {row.values.map((v, j) => (
                          <div key={j} className="rounded" style={{ width: 16, height: 16, backgroundColor: heatmapData.max > 0 ? `rgba(220, 38, 38, ${0.15 + (v / Math.max(heatmapData.max, 1)) * 0.85})` : '#f1f5f9' }} title={`${row.label} S-${11 - j}: ${v}`} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="small text-muted mt-2 mb-0">Plus la couleur est intense, plus il y a d'inscriptions.</p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white border-0 pb-0"><Card.Title className="h6">Étudiants vs Visiteurs</Card.Title></Card.Header>
            <Card.Body>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v) => [v, 'Participants']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Header className="d-flex align-items-center justify-content-between bg-white py-3">
          <Card.Title className="h6 mb-0">Activité récente</Card.Title>
          <Link to="/admin/paiements" className="small text-primary text-decoration-none fw-medium">Voir tout <i className="bi bi-chevron-right" /></Link>
        </Card.Header>
        <div className="table-responsive">
          <Table hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="text-uppercase small">Nom</th>
                <th className="text-uppercase small">Activité</th>
                <th className="text-uppercase small">Montant</th>
                <th className="text-uppercase small">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length > 0 ? (
                recentActivity.map((p, i) => (
                  <tr key={i}>
                    <td className="fw-medium">{p.nom_complet}</td>
                    <td className="text-muted">{p.activities?.nom || '-'}</td>
                    <td className="fw-medium">{Number(p.montant).toLocaleString()} FC</td>
                    <td className="text-muted small"><i className="bi bi-clock me-1" />{formatRelativeTime(p.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="text-center text-muted py-4">Aucune activité récente</td></tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
