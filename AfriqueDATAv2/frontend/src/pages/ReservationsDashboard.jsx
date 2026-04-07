import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ListTodo,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  MessageSquare,
  UserPlus,
  CalendarDays,
  DollarSign,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Badge, Dropdown, Form, Modal, InputGroup, Row, Col } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { logAudit } from '../lib/audit';

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'warning', Icon: Clock },
  approved: { label: 'Approuvée', color: 'success', Icon: CheckCircle },
  rejected: { label: 'Refusée', color: 'danger', Icon: XCircle },
  expired: { label: 'Expirée', color: 'secondary', Icon: AlertCircle },
  completed: { label: 'Terminée', color: 'info', Icon: ListTodo },
};

const JOURS_SEMAINE = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = last.getDate();
  const result = [];
  for (let i = 0; i < startPad; i++) result.push(null);
  for (let d = 1; d <= days; d++) result.push(d);
  return result;
}

function formatDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function ReservationsDashboard() {
  const { adminProfile } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [formateurRequests, setFormateurRequests] = useState([]);
  const [activities, setActivities] = useState([]);
  const [formateurs, setFormateurs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [requestActionModal, setRequestActionModal] = useState({ open: false, type: null, item: null });
  const [requestMessage, setRequestMessage] = useState('');
  const [requestDateAlt, setRequestDateAlt] = useState('');
  const [requestTimeAlt, setRequestTimeAlt] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterActivity, setFilterActivity] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterFormateur, setFilterFormateur] = useState('');
  const [search, setSearch] = useState('');
  const [actionModal, setActionModal] = useState({ open: false, type: null, item: null });
  const [adminNote, setAdminNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [convertMontant, setConvertMontant] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [calendarView, setCalendarView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadData = useCallback(async () => {
    try {
      try {
        await supabase.rpc('expire_old_reservations');
      } catch (_) {}
      const [resRes, reqRes, actRes, formRes, auditRes] = await Promise.all([
        supabase.from('reservations').select('*, activities(id, nom, date_debut, heure_debut, prix_default, formateur_id, activity_types(nom), formateurs(nom_complet, email))').order('created_at', { ascending: false }),
        supabase.from('formateur_reservation_requests').select('*, formateurs(nom_complet, email)').order('created_at', { ascending: false }).then((r) => r).catch(() => ({ data: [] })),
        supabase.from('activities').select('id, nom, formateur_id, formateurs(nom_complet)').eq('actif', true).order('nom'),
        supabase.from('formateurs').select('id, nom_complet').eq('actif', true).order('nom_complet').then((r) => r).catch(() => ({ data: [] })),
        supabase.from('audit_logs').select('*, admin_profiles(nom_complet)').order('created_at', { ascending: false }).limit(50).then((r) => r).catch(() => ({ data: [] })),
      ]);
      setReservations(resRes.data || []);
      setFormateurRequests(reqRes.data || []);
      setActivities(actRes.data || []);
      setFormateurs(formRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (err) {
      toast.error(err?.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterActivity && r.activity_id !== filterActivity) return false;
      if (filterDate && r.desired_date !== filterDate) return false;
      if (filterFormateur && r.activities?.formateur_id !== filterFormateur) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(r.full_name?.toLowerCase().includes(q) || r.telephone?.includes(q) || r.matricule?.toLowerCase().includes(q) || r.activities?.nom?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [reservations, filterStatus, filterActivity, filterDate, filterFormateur, search]);

  const byStatus = useMemo(() => ({
    pending: filtered.filter((r) => r.status === 'pending'),
    approved: filtered.filter((r) => r.status === 'approved'),
    rejected: filtered.filter((r) => r.status === 'rejected'),
    expired: filtered.filter((r) => r.status === 'expired'),
    completed: filtered.filter((r) => r.status === 'completed'),
  }), [filtered]);

  const kpiData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = reservations.filter((r) => r.desired_date === today || r.created_at?.slice(0, 10) === today).length;
    const totalRevenus = reservations
      .filter((r) => r.status === 'approved' || r.status === 'completed')
      .reduce((s, r) => s + Number(r.activities?.prix_default || 0), 0);
    return {
      total: reservations.length,
      pending: byStatus.pending.length,
      approved: byStatus.approved.length,
      rejected: byStatus.rejected.length,
      revenus: totalRevenus,
      aujourdhui: todayCount,
    };
  }, [reservations, byStatus]);

  const chartData = useMemo(() => {
    const byMonth = {};
    reservations.forEach((r) => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    });
    return Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([mois, count]) => ({ mois, réservations: count }));
  }, [reservations]);

  const pieData = useMemo(() => {
    return [
      { name: 'En attente', value: byStatus.pending.length, color: '#ffc107' },
      { name: 'Approuvées', value: byStatus.approved.length, color: '#198754' },
      { name: 'Refusées', value: byStatus.rejected.length, color: '#dc3545' },
      { name: 'Expirées', value: byStatus.expired.length, color: '#6c757d' },
      { name: 'Terminées', value: byStatus.completed.length, color: '#0dcaf0' },
    ].filter((d) => d.value > 0);
  }, [byStatus]);

  const calendarByDate = useMemo(() => {
    const map = {};
    reservations.forEach((r) => {
      const key = r.desired_date || r.activities?.date_debut;
      if (key) {
        if (!map[key]) map[key] = { pending: 0, approved: 0, total: 0 };
        map[key].total++;
        if (r.status === 'pending') map[key].pending++;
        else if (r.status === 'approved' || r.status === 'completed') map[key].approved++;
      }
    });
    return map;
  }, [reservations]);

  const paginatedTable = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  async function handleAction(type, item) {
    setActionModal({ open: true, type, item });
    setAdminNote(item?.admin_note || '');
    setRejectionReason(item?.rejection_reason || '');
    setConvertMontant(String(Number(item?.activities?.prix_default) || ''));
  }

  async function submitAction() {
    const { type, item } = actionModal;
    if (!item) return;
    setSubmitting(true);
    try {
      if (type === 'convert') {
        const montant = parseFloat(convertMontant) || 0;
        const typeParticipant = item.student_id ? 'etudiant' : 'visiteur';
        const { data: newPart, error: insErr } = await supabase
          .from('participations')
          .insert({
            activity_id: item.activity_id,
            nom_complet: item.full_name,
            faculty_id: item.faculty_id || null,
            promotion_id: item.promotion_id || null,
            matricule: item.matricule || null,
            student_id: item.student_id || null,
            visitor_id: item.visitor_id || null,
            type_participant: typeParticipant,
            montant,
            statut_paiement: 'en_attente',
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        await supabase.from('reservations').update({
          status: 'completed',
          participation_id: newPart.id,
          updated_at: new Date().toISOString(),
        }).eq('id', item.id);
        await logAudit('reservation_convert', 'reservation', item.id, { participation_id: newPart.id });
        toast.success('Participation créée. Allez dans Paiements pour valider.');
      } else {
        const payload = {
          updated_at: new Date().toISOString(),
          validated_by: adminProfile?.id || null,
          validated_at: new Date().toISOString(),
        };
        if (type === 'approve') {
          payload.status = 'approved';
          await logAudit('reservation_approve', 'reservation', item.id, {});
        } else if (type === 'reject') {
          payload.status = 'rejected';
          payload.rejection_reason = rejectionReason || 'Refusé par le secrétaire';
          await logAudit('reservation_reject', 'reservation', item.id, { reason: rejectionReason });
        } else if (type === 'hold') {
          payload.admin_note = adminNote;
        } else if (type === 'note') {
          payload.admin_note = adminNote;
        }
        const { error } = await supabase.from('reservations').update(payload).eq('id', item.id);
        if (error) throw error;
        toast.success(type === 'approve' ? 'Réservation approuvée' : type === 'reject' ? 'Réservation refusée' : 'Note enregistrée');
      }
      setActionModal({ open: false, type: null, item: null });
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestAction() {
    const { type, item } = requestActionModal;
    if (!item) return;
    setSubmittingRequest(true);
    try {
      const payload = {
        statut: type === 'approve' ? 'approved' : type === 'reject' ? 'rejected' : 'alternative_proposed',
        validated_by: adminProfile?.id,
        validated_at: new Date().toISOString(),
        message_admin: requestMessage || null,
        date_alternative_proposee: type === 'alternative' ? requestDateAlt || null : null,
        heure_alternative_proposee: type === 'alternative' ? requestTimeAlt || null : null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('formateur_reservation_requests').update(payload).eq('id', item.id);
      if (error) throw error;

      const notifPayload = {
        formateur_id: item.formateur_id,
        type: type === 'approve' ? 'reservation_validated' : type === 'reject' ? 'reservation_rejected' : 'alternative_proposed',
        titre: type === 'approve' ? 'Réservation validée' : type === 'reject' ? 'Réservation refusée' : 'Alternative proposée',
        message: type === 'approve' ? `Votre demande "${item.nom_formation}" du ${item.date_souhaitee} a été validée.` : type === 'reject' ? (requestMessage || 'Votre demande a été refusée.') : `Date alternative : ${requestDateAlt || ''} ${requestTimeAlt || ''}. ${requestMessage || ''}`,
        reservation_request_id: item.id,
      };
      await supabase.from('formateur_notifications').insert(notifPayload);

      toast.success(type === 'approve' ? 'Demande validée' : type === 'reject' ? 'Demande refusée' : 'Alternative proposée');
      setRequestActionModal({ open: false, type: null, item: null });
      setRequestMessage('');
      setRequestDateAlt('');
      setRequestTimeAlt('');
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Erreur');
    } finally {
      setSubmittingRequest(false);
    }
  }

  function exportCSV() {
    const esc = (v) => {
      const s = String(v ?? '');
      if (/[;\r\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = ['Date', 'Événement', 'Formateur', 'Participants', 'Frais (FC)', 'Statut'];
    const rows = filtered.map((r) => [
      r.desired_date || r.activities?.date_debut || '',
      r.activities?.nom || '',
      r.activities?.formateurs?.nom_complet || '',
      r.full_name || '',
      r.activities?.prix_default ?? '',
      STATUS_CONFIG[r.status]?.label || r.status,
    ]);
    const csv = [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  }

  const { year, month } = calendarView;
  const days = getDaysInMonth(year, month);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="skeleton mb-3" style={{ width: 200, height: 32 }} />
        <Row className="g-3 mb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col xs={6} md={4} lg={2} key={i}>
              <div className="skeleton rounded-3" style={{ height: 100 }} />
            </Col>
          ))}
        </Row>
        <div className="skeleton rounded-3" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold">Dashboard Réservations</h1>
          <p className="text-muted small mb-0">Vue globale, validation rapide, suivi intelligent</p>
          <Link to="/reserve" target="_blank" rel="noopener noreferrer" className="small text-primary">
            Ouvrir le calendrier public
          </Link>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button variant={viewMode === 'kanban' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => setViewMode('kanban')}>
            <LayoutGrid size={18} /> Kanban
          </Button>
          <Button variant={viewMode === 'table' ? 'primary' : 'outline-secondary'} size="sm" onClick={() => setViewMode('table')}>
            <List size={18} /> Tableau
          </Button>
          <Button variant="outline-success" size="sm" onClick={exportCSV}>
            <Download size={18} /> CSV
          </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <Row className="g-3 mb-4">
        {[
          { label: 'Total réservations', value: kpiData.total, Icon: ListTodo, color: 'primary', gradient: 'primary' },
          { label: 'En attente', value: kpiData.pending, Icon: Clock, color: 'warning', gradient: 'warning' },
          { label: 'Validées', value: kpiData.approved, Icon: CheckCircle, color: 'success', gradient: 'success' },
          { label: 'Refusées', value: kpiData.rejected, Icon: XCircle, color: 'danger', gradient: 'danger' },
          { label: 'Revenus (FC)', value: kpiData.revenus.toLocaleString(), Icon: DollarSign, color: 'info', gradient: 'info' },
          { label: "Aujourd'hui", value: kpiData.aujourdhui, Icon: CalendarDays, color: 'secondary', gradient: 'secondary' },
        ].map((kpi) => (
          <Col xs={6} md={4} lg={2} key={kpi.label}>
            <Card className={`border-0 shadow-sm h-100 bg-${kpi.color} bg-opacity-10`}>
              <Card.Body className="d-flex align-items-center gap-3">
                <div className={`rounded-3 bg-${kpi.color} bg-opacity-25 p-2`}>
                  <kpi.Icon size={24} className={`text-${kpi.color}`} />
                </div>
                <div>
                  <Card.Text className="text-muted small mb-0">{kpi.label}</Card.Text>
                  <Card.Title className="mb-0 fs-4">{kpi.value}</Card.Title>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Demandes formateurs */}
      {formateurRequests.filter((r) => r.statut === 'pending').length > 0 && (
        <Card className="mb-4 shadow-sm border-warning">
          <Card.Header className="bg-warning bg-opacity-10 py-3 d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-semibold">Demandes formateurs en attente</h5>
            <Badge bg="warning">{formateurRequests.filter((r) => r.statut === 'pending').length}</Badge>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>Formateur</th>
                    <th>Formation</th>
                    <th>Date</th>
                    <th>Heure</th>
                    <th>Durée</th>
                    <th>Participants</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formateurRequests.filter((r) => r.statut === 'pending').map((r) => (
                    <tr key={r.id}>
                      <td>{r.formateurs?.nom_complet || '-'}</td>
                      <td>{r.nom_formation}</td>
                      <td>{r.date_souhaitee}</td>
                      <td>{r.heure_souhaitee ? String(r.heure_souhaitee).slice(0, 5) : '-'}</td>
                      <td>{r.duree_minutes} min</td>
                      <td>{r.nb_max_participants || '-'}</td>
                      <td className="text-end">
                        <Button variant="success" size="sm" className="me-1" onClick={() => { setRequestActionModal({ open: true, type: 'approve', item: r }); setRequestMessage(''); }}>
                          <CheckCircle size={14} /> Valider
                        </Button>
                        <Button variant="danger" size="sm" className="me-1" onClick={() => { setRequestActionModal({ open: true, type: 'reject', item: r }); setRequestMessage(''); }}>
                          <XCircle size={14} /> Refuser
                        </Button>
                        <Button variant="info" size="sm" onClick={() => { setRequestActionModal({ open: true, type: 'alternative', item: r }); setRequestMessage(''); setRequestDateAlt(''); setRequestTimeAlt(''); }}>
                          Proposer date
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Modal action demande formateur */}
      <Modal show={requestActionModal.open} onHide={() => setRequestActionModal({ open: false })} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {requestActionModal.type === 'approve' && 'Valider la demande'}
            {requestActionModal.type === 'reject' && 'Refuser la demande'}
            {requestActionModal.type === 'alternative' && 'Proposer une date alternative'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {requestActionModal.item && (
            <p className="mb-3">
              <strong>{requestActionModal.item.formateurs?.nom_complet}</strong> – {requestActionModal.item.nom_formation} ({requestActionModal.item.date_souhaitee})
            </p>
          )}
          <Form.Group className="mb-3">
            <Form.Label>Message au formateur</Form.Label>
            <Form.Control as="textarea" rows={2} value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder={requestActionModal.type === 'reject' ? 'Raison du refus...' : 'Message optionnel...'} />
          </Form.Group>
          {requestActionModal.type === 'alternative' && (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Date alternative</Form.Label>
                <Form.Control type="date" value={requestDateAlt} onChange={(e) => setRequestDateAlt(e.target.value)} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Heure alternative</Form.Label>
                <Form.Control type="time" value={requestTimeAlt} onChange={(e) => setRequestTimeAlt(e.target.value)} />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setRequestActionModal({ open: false })}>Annuler</Button>
          <Button variant="primary" onClick={handleRequestAction} disabled={submittingRequest}>
            {requestActionModal.type === 'approve' && 'Valider'}
            {requestActionModal.type === 'reject' && 'Refuser'}
            {requestActionModal.type === 'alternative' && 'Proposer'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* CALENDRIER GLOBAL */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="bg-white py-3 d-flex align-items-center justify-content-between">
          <h5 className="mb-0 fw-semibold">Calendrier global</h5>
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted">
              <span className="badge bg-success me-1">●</span> Validé
              <span className="badge bg-warning text-dark ms-2 me-1">●</span> Attente
              <span className="badge bg-secondary ms-2">●</span> Libre
            </small>
            <Button variant="outline-secondary" size="sm" onClick={() => setCalendarView((v) => ({ ...v, month: v.month - 1 }))}>
              <ChevronLeft size={18} />
            </Button>
            <span className="fw-medium">{MOIS[month]} {year}</span>
            <Button variant="outline-secondary" size="sm" onClick={() => setCalendarView((v) => ({ ...v, month: v.month + 1 }))}>
              <ChevronRight size={18} />
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="d-flex mb-2">
            {JOURS_SEMAINE.map((j) => (
              <div key={j} className="flex-grow-1 text-center small text-muted fw-medium">{j}</div>
            ))}
          </div>
          <div className="d-flex flex-wrap" style={{ gap: 4 }}>
            {days.map((d, i) => {
              if (d === null) return <div key={`pad-${i}`} className="rounded-2" style={{ width: 'calc(14.28% - 4px)', aspectRatio: 1 }} />;
              const key = formatDateKey(year, month, d);
              const info = calendarByDate[key];
              const hasPending = info?.pending > 0;
              const hasApproved = info?.approved > 0;
              const color = hasApproved ? 'success' : hasPending ? 'warning' : 'secondary';
              const count = info?.total || 0;
              return (
                <div
                  key={key}
                  className={`rounded-2 border d-flex flex-column align-items-center justify-content-center cursor-pointer bg-${color} bg-opacity-10`}
                  style={{ width: 'calc(14.28% - 4px)', aspectRatio: 1, minWidth: 36, borderColor: hasApproved ? 'var(--bs-success)' : hasPending ? 'var(--bs-warning)' : 'var(--bs-secondary)' }}
                  onClick={() => setSelectedCalendarDate(key)}
                  title={`${key}: ${count} réservation(s)`}
                >
                  <span className="small fw-medium">{d}</span>
                  {count > 0 && <span className={`badge bg-${color} rounded-pill`} style={{ fontSize: 10 }}>{count}</span>}
                </div>
              );
            })}
          </div>
        </Card.Body>
      </Card>

      {/* Modal détail calendrier */}
      <Modal show={!!selectedCalendarDate} onHide={() => setSelectedCalendarDate(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Réservations du {selectedCalendarDate}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedCalendarDate && filtered.filter((r) => (r.desired_date || r.activities?.date_debut) === selectedCalendarDate).map((r) => (
            <div key={r.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
              <div>
                <strong>{r.full_name}</strong> – {r.activities?.nom}
                <br />
                <small className="text-muted">{r.activities?.formateurs?.nom_complet || '-'} • {r.desired_time_start || r.activities?.heure_debut}</small>
              </div>
              <Badge bg={STATUS_CONFIG[r.status]?.color}>{STATUS_CONFIG[r.status]?.label}</Badge>
              {r.status === 'pending' && (
                <div className="d-flex gap-1">
                  <Button variant="success" size="sm" onClick={() => { handleAction('approve', r); setSelectedCalendarDate(null); }}><CheckCircle size={14} /></Button>
                  <Button variant="danger" size="sm" onClick={() => { handleAction('reject', r); setSelectedCalendarDate(null); }}><XCircle size={14} /></Button>
                </div>
              )}
            </div>
          ))}
          {selectedCalendarDate && filtered.filter((r) => (r.desired_date || r.activities?.date_debut) === selectedCalendarDate).length === 0 && (
            <p className="text-muted text-center py-4 mb-0">Aucune réservation ce jour.</p>
          )}
        </Modal.Body>
      </Modal>

      {/* FILTRES */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <InputGroup style={{ maxWidth: 280 }}>
          <InputGroup.Text><Search size={18} /></InputGroup.Text>
          <Form.Control placeholder="Nom, tél., matricule, activité..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </InputGroup>
        <Form.Select style={{ width: 140 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Form.Select>
        <Form.Select style={{ width: 200 }} value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)}>
          <option value="">Toutes activités</option>
          {activities.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
        </Form.Select>
        <Form.Select style={{ width: 180 }} value={filterFormateur} onChange={(e) => setFilterFormateur(e.target.value)}>
          <option value="">Tous formateurs</option>
          {formateurs.map((f) => <option key={f.id} value={f.id}>{f.nom_complet}</option>)}
        </Form.Select>
        <Form.Control type="date" style={{ width: 150 }} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
      </div>

      {/* VUE KANBAN OU TABLEAU */}
      {viewMode === 'kanban' ? (
        <Row className="g-3 mb-4">
          {['pending', 'approved', 'rejected'].map((status) => {
            const cfg = STATUS_CONFIG[status];
            const items = byStatus[status];
            return (
              <Col md={4} key={status}>
                <Card className="h-100">
                  <Card.Header className="d-flex align-items-center justify-content-between py-2">
                    <span className="fw-semibold d-flex align-items-center gap-1">
                      <cfg.Icon size={18} />
                      {cfg.label}
                    </span>
                    <Badge bg={cfg.color}>{items.length}</Badge>
                  </Card.Header>
                  <Card.Body className="p-2 overflow-auto" style={{ maxHeight: 420 }}>
                    {items.length === 0 ? (
                      <p className="text-muted small text-center py-4 mb-0">Aucune</p>
                    ) : (
                      items.map((r) => (
                        <ReservationCard key={r.id} item={r} onAction={handleAction} />
                      ))
                    )}
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Card className="mb-4 shadow-sm">
          <Card.Header className="bg-white py-3">
            <h5 className="mb-0 fw-semibold">Tableau intelligent</h5>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Événement</th>
                    <th>Formateur</th>
                    <th>Participants</th>
                    <th>Frais (FC)</th>
                    <th>Statut</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTable.map((r) => (
                    <tr key={r.id}>
                      <td className="small">{r.desired_date || r.activities?.date_debut || '-'}</td>
                      <td>
                        <Link to={`/admin/activites/${r.activity_id}`} className="text-decoration-none">
                          {r.activities?.nom || '-'}
                        </Link>
                      </td>
                      <td className="small">{r.activities?.formateurs?.nom_complet || '-'}</td>
                      <td className="fw-medium">{r.full_name}</td>
                      <td>{Number(r.activities?.prix_default || 0).toLocaleString()}</td>
                      <td>
                        <Badge bg={STATUS_CONFIG[r.status]?.color}>{STATUS_CONFIG[r.status]?.label}</Badge>
                      </td>
                      <td className="text-end">
                        {r.status === 'pending' && (
                          <>
                            <Button variant="outline-success" size="sm" className="me-1" onClick={() => handleAction('approve', r)} title="Valider">
                              <CheckCircle size={16} />
                            </Button>
                            <Button variant="outline-danger" size="sm" className="me-1" onClick={() => handleAction('reject', r)} title="Refuser">
                              <XCircle size={16} />
                            </Button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <Button variant="outline-primary" size="sm" onClick={() => handleAction('convert', r)}>
                            <UserPlus size={16} className="me-1" /> Convertir
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <small className="text-muted">
                  {(page - 1) * PAGE_SIZE + 1} – {Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length}
                </small>
                <div className="d-flex gap-1">
                  <Button variant="outline-secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={18} />
                  </Button>
                  <Button variant="outline-secondary" size="sm" disabled={page * PAGE_SIZE >= filtered.length} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={18} />
                  </Button>
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* PANNEAU ANALYTIQUE */}
      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white py-3">
              <Card.Title className="h6 mb-0">Réservations par mois</Card.Title>
            </Card.Header>
            <Card.Body>
              {chartData.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="mois" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="réservations" fill="#0d6efd" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 260 }}>Aucune donnée</div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white py-3">
              <Card.Title className="h6 mb-0">Répartition par statut</Card.Title>
            </Card.Header>
            <Card.Body>
              {pieData.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 260 }}>Aucune donnée</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* JOURNAL DES ACTIONS (AUDIT) */}
      <Card className="shadow-sm">
        <Card.Header className="bg-white py-3 d-flex align-items-center justify-content-between">
          <Card.Title className="h6 mb-0">Journal des actions</Card.Title>
          <Link to="/admin/audit-logs" className="small text-primary">Voir tout</Link>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light">
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Date</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 10).map((log) => (
                  <tr key={log.id}>
                    <td>{log.admin_profiles?.nom_complet || '-'}</td>
                    <td><Badge bg="secondary">{log.action}</Badge></td>
                    <td className="text-muted">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                    <td className="text-muted">{log.entity_type} {log.entity_id ? `#${String(log.entity_id).slice(0, 8)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditLogs.length === 0 && (
            <p className="text-muted text-center py-4 mb-0">Aucune action enregistrée.</p>
          )}
        </Card.Body>
      </Card>

      {/* Modal action */}
      <Modal show={actionModal.open} onHide={() => setActionModal({ open: false })} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {actionModal.type === 'approve' && 'Approuver'}
            {actionModal.type === 'reject' && 'Refuser'}
            {actionModal.type === 'hold' && 'Mettre en attente'}
            {actionModal.type === 'note' && 'Ajouter une note'}
            {actionModal.type === 'convert' && 'Convertir en participation'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {actionModal.item && (
            <p className="mb-3">
              <strong>{actionModal.item.full_name}</strong> – {actionModal.item.activities?.nom}
            </p>
          )}
          {actionModal.type === 'convert' && (
            <Form.Group className="mb-3">
              <Form.Label>Montant (FC) *</Form.Label>
              <Form.Control type="number" min={0} step={0.01} value={convertMontant} onChange={(e) => setConvertMontant(e.target.value)} placeholder="0" />
            </Form.Group>
          )}
          {(actionModal.type === 'reject' || actionModal.type === 'hold' || actionModal.type === 'note') && (
            <Form.Group className="mb-3">
              <Form.Label>{actionModal.type === 'reject' ? 'Raison du refus' : 'Note admin'}</Form.Label>
              <Form.Control as="textarea" rows={2} value={actionModal.type === 'reject' ? rejectionReason : adminNote} onChange={(e) => actionModal.type === 'reject' ? setRejectionReason(e.target.value) : setAdminNote(e.target.value)} placeholder={actionModal.type === 'reject' ? 'Motif obligatoire' : 'Note interne'} />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setActionModal({ open: false })}>Annuler</Button>
          <Button variant="primary" onClick={submitAction} disabled={submitting || (actionModal.type === 'reject' && !rejectionReason.trim())}>
            {actionModal.type === 'approve' && 'Approuver'}
            {actionModal.type === 'reject' && 'Refuser'}
            {actionModal.type === 'hold' && 'Enregistrer'}
            {actionModal.type === 'note' && 'Enregistrer'}
            {actionModal.type === 'convert' && 'Créer la participation'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function ReservationCard({ item, onAction }) {
  return (
    <div className="border rounded-2 p-2 mb-2 bg-body">
      <div className="d-flex justify-content-between align-items-start">
        <div className="small">
          <strong>{item.full_name}</strong>
          <p className="mb-0 text-muted small">{item.activities?.nom}</p>
          <p className="mb-0 text-muted small">{item.telephone}</p>
          {item.desired_date && <p className="mb-0 text-muted small">{item.desired_date} {item.desired_time_start}</p>}
        </div>
        {item.status === 'pending' && (
          <Dropdown align="end">
            <Dropdown.Toggle variant="link" className="p-1 text-dark" size="sm">
              <MoreVertical size={18} />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => onAction('approve', item)}><CheckCircle size={14} className="me-2" />Approuver</Dropdown.Item>
              <Dropdown.Item onClick={() => onAction('reject', item)}><XCircle size={14} className="me-2" />Refuser</Dropdown.Item>
              <Dropdown.Item onClick={() => onAction('hold', item)}><Clock size={14} className="me-2" />Mettre en attente</Dropdown.Item>
              <Dropdown.Item onClick={() => onAction('note', item)}><MessageSquare size={14} className="me-2" />Ajouter note</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        )}
      </div>
      {item.status === 'pending' && (
        <div className="d-flex gap-1 mt-2">
          <Button variant="success" size="sm" className="flex-grow-1" onClick={() => onAction('approve', item)}>
            <CheckCircle size={14} /> Approuver
          </Button>
          <Button variant="outline-danger" size="sm" onClick={() => onAction('reject', item)}>
            <XCircle size={14} />
          </Button>
        </div>
      )}
      {item.status === 'approved' && (
        <Button variant="primary" size="sm" className="w-100 mt-2" onClick={() => onAction('convert', item)}>
          <UserPlus size={14} className="me-2" /> Convertir en participation
        </Button>
      )}
    </div>
  );
}
