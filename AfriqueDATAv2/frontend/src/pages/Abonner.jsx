import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserPlus, MoreHorizontal, GraduationCap, UserCheck, ChevronRight, CalendarDays, Clock, List, Play, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPES_ABONNEMENT = [
  { id: 'mensuel', nom: 'Mensuel', duree: '30 jours' },
  { id: '2_mois', nom: '2 mois', duree: '60 jours' },
  { id: '3_mois', nom: '3 mois', duree: '90 jours' },
  { id: '6_mois', nom: '6 mois', duree: '180 jours' },
  { id: 'annuel', nom: 'Annuel', duree: '365 jours' },
];

function formatCountdown(dateExpiration) {
  if (!dateExpiration) return { text: 'En attente', expired: false };
  const now = new Date();
  const exp = new Date(dateExpiration);
  const diffMs = exp - now;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH = Math.floor(diffMin / 60);
  const diffJ = Math.floor(diffH / 24);
  if (diffMs <= 0) {
    const joursExpires = Math.abs(diffJ);
    return { text: `Expiré depuis ${joursExpires} j`, expired: true };
  }
  if (diffJ > 0) return { text: `${diffJ} j ${diffH % 24} h restantes`, expired: false };
  if (diffH > 0) return { text: `${diffH} h ${diffMin % 60} min restantes`, expired: false };
  if (diffMin > 0) return { text: `${diffMin} min restantes`, expired: false };
  return { text: `${diffSec} s restantes`, expired: false };
}

const SUBSCRIPTION_VISUAL_THEMES = {
  mensuel: { accent: '#2563eb', softBg: 'linear-gradient(145deg, #eff6ff 0%, #ecfeff 100%)', border: 'rgba(37,99,235,0.22)' },
  '2_mois': { accent: '#0891b2', softBg: 'linear-gradient(145deg, #ecfeff 0%, #f0fdf4 100%)', border: 'rgba(8,145,178,0.22)' },
  '3_mois': { accent: '#0d9488', softBg: 'linear-gradient(145deg, #f0fdfa 0%, #ecfdf5 100%)', border: 'rgba(13,148,136,0.22)' },
  '6_mois': { accent: '#7c3aed', softBg: 'linear-gradient(145deg, #f5f3ff 0%, #fdf4ff 100%)', border: 'rgba(124,58,237,0.22)' },
  annuel: { accent: '#6d28d9', softBg: 'linear-gradient(145deg, #ede9fe 0%, #fce7f3 100%)', border: 'rgba(109,40,217,0.28)' },
};

function themeForSubscription(typeId) {
  return SUBSCRIPTION_VISUAL_THEMES[typeId] || { accent: '#475569', softBg: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)', border: 'rgba(71,85,105,0.18)' };
}

function getCountdownSegments(dateExpiration) {
  if (!dateExpiration) return null;
  const exp = new Date(dateExpiration);
  const diffMs = exp - Date.now();
  if (diffMs <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const sec = Math.floor(diffMs / 1000);
  return {
    expired: false,
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
  };
}

function ringProgress(dateActivation, dateExpiration) {
  const end = dateExpiration ? new Date(dateExpiration).getTime() : 0;
  const now = Date.now();
  if (!end || now >= end) return 0;
  const start = dateActivation ? new Date(dateActivation).getTime() : null;
  if (start != null && end > start) {
    return Math.max(0, Math.min(1, (end - now) / (end - start)));
  }
  return Math.min(1, (end - now) / (30 * 24 * 60 * 60 * 1000));
}

function shortCountdownLabel(seg) {
  if (!seg || seg.expired) return '—';
  if (seg.days > 0) return `${seg.days}j`;
  if (seg.hours > 0) return `${seg.hours}h`;
  if (seg.minutes > 0) return `${seg.minutes}m`;
  return `${seg.seconds}s`;
}

function CountdownRingVisual({ progress, accent, size = 72, children }) {
  const stroke = Math.max(3, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = progress == null ? 1 : Math.min(1, Math.max(0, progress));
  const offset = c * (1 - p);
  const cx = size / 2;
  return (
    <div className="position-relative d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="position-absolute top-0 start-0" aria-hidden>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dashoffset 0.35s ease' }}
        />
      </svg>
      <div className="position-relative text-center lh-1 px-1" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export default function Abonner() {
  const [view, setView] = useState('menu'); // 'menu' | 'nouveau' | 'autre' | 'liste' | 'actifs'
  const [typeAbonne, setTypeAbonne] = useState('etudiant'); // 'etudiant' | 'visiteur'
  const [facultes, setFacultes] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [subscriptionTypes, setSubscriptionTypes] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    faculty_id: '',
    promotion_id: '',
    matricule: '',
    nom_complet: '',
    telephone: '',
    email: '',
    institution: '',
    type_abonnement: 'mensuel',
    date_activation: new Date().toISOString().slice(0, 16),
    activer_maintenant: true,
    montant_total_fc: '',
    tarif_mensuel_reference_fc: '',
  });

  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    if ((view !== 'liste' && view !== 'actifs') || abonnements.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [view, abonnements.length]);

  const abonnesActifs = useMemo(() => {
    void tick;
    const now = Date.now();
    return (abonnements || []).filter((a) => {
      if (a.statut !== 'actif' || !a.date_expiration) return false;
      return new Date(a.date_expiration).getTime() > now;
    });
  }, [abonnements, tick]);

  async function loadRefs() {
    const [facRes, promRes, typesRes] = await Promise.all([
      supabase.from('faculties').select('id, nom, code').order('nom'),
      supabase.from('promotions').select('id, nom, faculty_id, faculties(nom, code)').order('nom'),
      supabase.from('subscription_types').select('id, nom, duree_jours').order('ordre').then((r) => r).catch(() => ({ data: [] })),
    ]);
    setFacultes(facRes.data || []);
    setPromotions(promRes.data || []);
    setSubscriptionTypes(typesRes.data?.length ? typesRes.data : TYPES_ABONNEMENT);
  }

  async function loadAbonnements() {
    const { data } = await supabase
      .from('abonnements')
      .select(`
        id, type_abonne, type_abonnement, date_activation, date_expiration, statut,
        montant_total_fc, tarif_mensuel_reference_fc,
        students(id, nom_complet, matricule, promotions(nom, faculties(nom))),
        visitors(id, nom_complet, institution),
        subscription_types(nom, duree_jours)
      `)
      .order('date_expiration', { ascending: true })
      .then((r) => r)
      .catch(() => ({ data: [] }));
    setAbonnements(data || []);
  }

  const promotionsByFaculty = useMemo(() => {
    if (!form.faculty_id) return promotions;
    return promotions.filter((p) => p.faculty_id === form.faculty_id);
  }, [promotions, form.faculty_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const activerMaintenant = form.activer_maintenant;
      const dateActivation = activerMaintenant ? new Date(form.date_activation || Date.now()).toISOString() : null;
      const mFc = form.montant_total_fc !== '' ? parseFloat(String(form.montant_total_fc).replace(',', '.')) : null;
      const tFc = form.tarif_mensuel_reference_fc !== '' ? parseFloat(String(form.tarif_mensuel_reference_fc).replace(',', '.')) : null;
      const payloadAbonnement = {
        type_abonne: typeAbonne,
        type_abonnement: form.type_abonnement,
        statut: activerMaintenant ? 'actif' : 'en_attente',
        date_activation: dateActivation,
        montant_total_fc: Number.isFinite(mFc) ? mFc : null,
        tarif_mensuel_reference_fc: Number.isFinite(tFc) && tFc > 0 ? tFc : null,
      };
      if (typeAbonne === 'etudiant') {
        const { data: studentData, error: errStu } = await supabase
          .from('students')
          .insert([{
            promotion_id: form.promotion_id,
            matricule: form.matricule,
            nom_complet: form.nom_complet,
            telephone: form.telephone || null,
            email: form.email || null,
            updated_at: new Date().toISOString(),
          }])
          .select('id')
          .single();
        if (errStu) throw errStu;
        await supabase.from('abonnements').insert([{
          ...payloadAbonnement,
          student_id: studentData.id,
          visitor_id: null,
        }]).then((r) => r).catch((err) => {
          console.warn('Abonnement non créé (table absente?):', err);
        });
        toast.success(activerMaintenant ? 'Nouvel étudiant abonné et activé' : 'Nouvel étudiant abonné – en attente d\'activation');
      } else {
        const { data: visitorData, error: errVis } = await supabase
          .from('visitors')
          .insert([{
            nom_complet: form.nom_complet,
            email: form.email || null,
            telephone: form.telephone || null,
            institution: form.institution || null,
            updated_at: new Date().toISOString(),
          }])
          .select('id')
          .single();
        if (errVis) throw errVis;
        await supabase.from('abonnements').insert([{
          ...payloadAbonnement,
          student_id: null,
          visitor_id: visitorData.id,
        }]).then((r) => r).catch((err) => {
          console.warn('Abonnement non créé (table absente?):', err);
        });
        toast.success(activerMaintenant ? 'Nouveau visiteur abonné et activé' : 'Nouveau visiteur abonné – en attente d\'activation');
      }
      setForm({
        faculty_id: facultes[0]?.id || '',
        promotion_id: promotionsByFaculty[0]?.id || '',
        matricule: '',
        nom_complet: '',
        telephone: '',
        email: '',
        institution: '',
        type_abonnement: 'mensuel',
        date_activation: new Date().toISOString().slice(0, 16),
        activer_maintenant: true,
        montant_total_fc: '',
        tarif_mensuel_reference_fc: '',
      });
      await loadAbonnements();
      setView(activerMaintenant ? 'actifs' : 'menu');
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'abonnement');
    } finally {
      setLoading(false);
    }
  }

  async function handleActiver(abonnement) {
    try {
      const { error } = await supabase
        .from('abonnements')
        .update({
          date_activation: new Date().toISOString(),
          statut: 'actif',
          updated_at: new Date().toISOString(),
        })
        .eq('id', abonnement.id);
      if (error) throw error;
      toast.success('Abonnement activé – le compte à rebours a démarré');
      await loadAbonnements();
      setView('actifs');
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'activation');
    }
  }

  function resetForm() {
    const fid = facultes[0]?.id || '';
    const firstPromo = promotions.find((p) => p.faculty_id === fid);
    setForm({
      faculty_id: fid,
      promotion_id: firstPromo?.id || '',
      matricule: '',
      nom_complet: '',
      telephone: '',
      email: '',
      institution: '',
      type_abonnement: 'mensuel',
      date_activation: new Date().toISOString().slice(0, 16),
      activer_maintenant: true,
      montant_total_fc: '',
      tarif_mensuel_reference_fc: '',
    });
  }

  function moisDepuisMontant(a) {
    const m = a?.montant_total_fc != null ? Number(a.montant_total_fc) : null;
    const t = a?.tarif_mensuel_reference_fc != null ? Number(a.tarif_mensuel_reference_fc) : null;
    if (m == null || !Number.isFinite(m) || t == null || !Number.isFinite(t) || t <= 0) return '—';
    return `${Math.floor(m / t)} mois (≈)`;
  }

  const autreOptions = [
    { label: 'Tableau abonnés actifs', action: () => { loadAbonnements(); setView('actifs'); }, Icon: Users },
    { label: 'Liste des abonnements', action: () => { loadAbonnements(); setView('liste'); }, Icon: List },
    { label: 'Liste des étudiants', path: '/admin/etudiants', Icon: GraduationCap },
    { label: 'Liste des visiteurs', path: '/admin/visiteurs', Icon: UserCheck },
    { label: 'Activités et inscriptions', path: '/admin/activites', Icon: CalendarDays },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Abonner sur la plateforme</h1>
        <p className="text-slate-500 text-sm mt-1">Gestion des abonnements – secrétaire</p>
      </div>

      {view === 'menu' && (
        <div className="row g-4">
          <div className="col-md-6 col-lg-4">
            <button
              onClick={() => {
                resetForm();
                setTypeAbonne('etudiant');
                setView('nouveau');
              }}
              className="w-100 p-5 rounded-3 border-0 shadow-sm bg-white text-start card-hover d-flex align-items-center gap-4"
              style={{ minHeight: 140 }}
            >
              <div className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{ width: 56, height: 56, backgroundColor: '#0d6efd' }}>
                <UserPlus size={28} strokeWidth={2} />
              </div>
              <div>
                <h5 className="fw-semibold text-slate-800 mb-1">Nouveau abonné</h5>
                <p className="text-muted small mb-0">Enregistrer un nouvel étudiant ou visiteur sur la plateforme</p>
              </div>
              <ChevronRight size={20} className="text-muted ms-auto flex-shrink-0" />
            </button>
          </div>

          <div className="col-md-6 col-lg-4">
            <button
              onClick={() => setView('autre')}
              className="w-100 p-5 rounded-3 border-0 shadow-sm bg-white text-start card-hover d-flex align-items-center gap-4"
              style={{ minHeight: 140 }}
            >
              <div className="rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0" style={{ width: 56, height: 56, backgroundColor: '#6c757d' }}>
                <MoreHorizontal size={28} strokeWidth={2} />
              </div>
              <div>
                <h5 className="fw-semibold text-slate-800 mb-1">Autre</h5>
                <p className="text-muted small mb-0">Liste des abonnés, gestion des inscriptions et autres actions</p>
              </div>
              <ChevronRight size={20} className="text-muted ms-auto flex-shrink-0" />
            </button>
          </div>
        </div>
      )}

      {view === 'nouveau' && (
        <div className="card shadow-sm">
          <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-semibold">Nouveau abonné</h5>
            <button
              type="button"
              onClick={() => setView('menu')}
              className="btn btn-sm btn-outline-secondary"
            >
              Retour
            </button>
          </div>
          <div className="card-body">
            <div className="d-flex gap-2 mb-4">
              <button
                type="button"
                className={`btn ${typeAbonne === 'etudiant' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setTypeAbonne('etudiant');
                  resetForm();
                }}
              >
                <GraduationCap size={18} className="me-1" />
                Étudiant
              </button>
              <button
                type="button"
                className={`btn ${typeAbonne === 'visiteur' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setTypeAbonne('visiteur');
                  setForm({
                    faculty_id: '',
                    promotion_id: '',
                    matricule: '',
                    nom_complet: '',
                    telephone: '',
                    email: '',
                    institution: '',
                    type_abonnement: form.type_abonnement,
                    date_activation: new Date().toISOString().slice(0, 16),
                    activer_maintenant: form.activer_maintenant,
                  });
                }}
              >
                <UserCheck size={18} className="me-1" />
                Visiteur
              </button>
            </div>

            <form onSubmit={handleSubmit} className="row g-3">
              <div className="col-12">
                <label className="form-label">Nom complet <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={form.nom_complet}
                  onChange={(e) => setForm({ ...form, nom_complet: e.target.value })}
                  required
                  className="form-control"
                  placeholder="Prénom Nom"
                />
              </div>

              {typeAbonne === 'etudiant' && (
                <>
                  <div className="col-md-6">
                    <label className="form-label">Matricule <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      value={form.matricule}
                      onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                      required
                      className="form-control"
                      placeholder="ex: UNI12345"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Faculté <span className="text-danger">*</span></label>
                    <select
                      value={form.faculty_id}
                      onChange={(e) => {
                        const fid = e.target.value;
                        const first = promotions.find((p) => p.faculty_id === fid);
                        setForm({ ...form, faculty_id: fid, promotion_id: first?.id || '' });
                      }}
                      required
                      className="form-select"
                    >
                      <option value="">-- Sélectionner une faculté --</option>
                      {facultes.map((f) => (
                        <option key={f.id} value={f.id}>{f.nom}{f.code ? ` (${f.code})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Promotion <span className="text-danger">*</span></label>
                    <select
                      value={form.promotion_id}
                      onChange={(e) => setForm({ ...form, promotion_id: e.target.value })}
                      required
                      className="form-select"
                    >
                      <option value="">-- Sélectionner une promotion --</option>
                      {promotionsByFaculty.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom}{p.faculties?.nom ? ` – ${p.faculties.nom}` : ''}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {typeAbonne === 'visiteur' && (
                <div className="col-12">
                  <label className="form-label">Institution</label>
                  <input
                    type="text"
                    value={form.institution}
                    onChange={(e) => setForm({ ...form, institution: e.target.value })}
                    className="form-control"
                    placeholder="Université, entreprise..."
                  />
                </div>
              )}

              <div className="col-md-6">
                <label className="form-label">Téléphone</label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="form-control"
                  placeholder="+243 XXX XXX XXX"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="form-control"
                  placeholder="email@exemple.com"
                />
              </div>

              <div className="col-12 border-top pt-4 mt-2">
                <h6 className="text-muted small text-uppercase mb-3">Abonnement</h6>
              </div>
              <div className="col-md-6">
                <label className="form-label">Type d'abonnement <span className="text-danger">*</span></label>
                <select
                  value={form.type_abonnement}
                  onChange={(e) => setForm({ ...form, type_abonnement: e.target.value })}
                  required
                  className="form-select"
                >
                  {subscriptionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} {t.duree_jours ? `(${t.duree_jours} jours)` : t.duree ? `(${t.duree})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input
                    type="checkbox"
                    id="activer_maintenant"
                    checked={form.activer_maintenant}
                    onChange={(e) => setForm({ ...form, activer_maintenant: e.target.checked })}
                    className="form-check-input"
                  />
                  <label htmlFor="activer_maintenant" className="form-check-label">
                    Activer immédiatement (le compte à rebours démarre tout de suite)
                  </label>
                </div>
              </div>
              {form.activer_maintenant && (
                <div className="col-md-6">
                  <label className="form-label">Date d'activation <span className="text-danger">*</span></label>
                  <input
                    type="datetime-local"
                    value={form.date_activation}
                    onChange={(e) => setForm({ ...form, date_activation: e.target.value })}
                    required={form.activer_maintenant}
                    className="form-control"
                  />
                  <small className="text-muted">Le compte à rebours démarre à cette date</small>
                </div>
              )}

              <div className="col-12 border-top pt-3 mt-2">
                <h6 className="text-muted small text-uppercase mb-2">Montants (FC)</h6>
                <p className="small text-muted mb-3">Le tarif mensuel de référence permet d&apos;afficher le nombre de mois couverts par le montant total.</p>
              </div>
              <div className="col-md-6">
                <label className="form-label">Montant total payé (FC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.montant_total_fc}
                  onChange={(e) => setForm({ ...form, montant_total_fc: e.target.value })}
                  className="form-control"
                  placeholder="ex: 150000"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Tarif mensuel de référence (FC)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tarif_mensuel_reference_fc}
                  onChange={(e) => setForm({ ...form, tarif_mensuel_reference_fc: e.target.value })}
                  className="form-control"
                  placeholder="ex: 50000 pour 1 mois"
                />
              </div>

              <div className="col-12 d-flex gap-2 justify-content-end pt-2">
                <button type="button" onClick={() => setView('menu')} className="btn btn-outline-secondary">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Enregistrement...
                    </>
                  ) : (
                    'Enregistrer l\'abonné'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'autre' && (
        <div className="card shadow-sm">
          <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-semibold">Autre</h5>
            <button
              type="button"
              onClick={() => setView('menu')}
              className="btn btn-sm btn-outline-secondary"
            >
              Retour
            </button>
          </div>
          <div className="card-body">
            <p className="text-muted small mb-4">Accédez aux listes et à la gestion des abonnés.</p>
            <div className="d-flex flex-column gap-2">
              {autreOptions.map((opt) =>
                opt.action ? (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={opt.action}
                    className="d-flex align-items-center gap-3 p-3 rounded-3 border bg-white text-start w-100 card-hover"
                  >
                    <opt.Icon size={22} className="text-primary flex-shrink-0" />
                    <span className="fw-medium flex-grow-1">{opt.label}</span>
                    <ChevronRight size={18} className="text-muted" />
                  </button>
                ) : (
                  <Link
                    key={opt.path}
                    to={opt.path}
                    className="d-flex align-items-center gap-3 p-3 rounded-3 border text-dark text-decoration-none card-hover"
                  >
                    <opt.Icon size={22} className="text-primary flex-shrink-0" />
                    <span className="fw-medium flex-grow-1">{opt.label}</span>
                    <ChevronRight size={18} className="text-muted" />
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'actifs' && (
        <div className="card shadow-sm border-0 overflow-hidden">
          <div
            className="card-header py-4 text-white border-0"
            style={{ background: 'linear-gradient(120deg, #1e3a5f 0%, #2563eb 45%, #0891b2 100%)' }}
          >
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <h5 className="mb-1 fw-bold d-flex align-items-center gap-2">
                  <Users size={22} />
                  Abonnés actifs
                </h5>
                <p className="mb-0 small opacity-90">Compte à rebours en temps réel jusqu’à l’expiration — style selon la formule</p>
              </div>
              <button type="button" onClick={() => setView('autre')} className="btn btn-sm btn-light">
                Retour
              </button>
            </div>
          </div>
          <div className="card-body bg-light">
            {abonnesActifs.length === 0 ? (
              <p className="text-muted text-center py-5 mb-0">
                Aucun abonnement actif pour l’instant. Enregistrez un abonné avec activation immédiate pour le voir ici.
              </p>
            ) : (
              <div className="row g-4">
                {abonnesActifs.map((a) => {
                  const nom = a.type_abonne === 'etudiant'
                    ? a.students?.nom_complet
                    : a.visitors?.nom_complet;
                  const detail = a.type_abonne === 'etudiant'
                    ? a.students?.promotions?.nom || a.students?.matricule
                    : a.visitors?.institution || '-';
                  const formuleNom = a.subscription_types?.nom || a.type_abonnement?.replace(/_/g, ' ') || '-';
                  const theme = themeForSubscription(a.type_abonnement);
                  const seg = getCountdownSegments(a.date_expiration);
                  const prog = ringProgress(a.date_activation, a.date_expiration);
                  const initial = (nom || '?').trim().charAt(0).toUpperCase();
                  return (
                    <div key={a.id} className="col-md-6 col-xl-4">
                      <div
                        className="rounded-4 border p-4 h-100 shadow-sm position-relative"
                        style={{ background: theme.softBg, borderColor: theme.border }}
                      >
                        <div className="d-flex gap-3 align-items-start">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white flex-shrink-0"
                            style={{ width: 48, height: 48, background: theme.accent, fontSize: '1.1rem' }}
                          >
                            {initial}
                          </div>
                          <div className="min-w-0 flex-grow-1">
                            <div className="fw-semibold text-dark text-truncate" title={nom}>{nom || '-'}</div>
                            <div className="small text-muted text-truncate">{detail}</div>
                            <div className="mt-2 d-flex flex-wrap gap-2 align-items-center">
                              <span className={`badge ${a.type_abonne === 'etudiant' ? 'bg-primary' : 'bg-info'}`}>
                                {a.type_abonne === 'etudiant' ? 'Étudiant' : 'Visiteur'}
                              </span>
                              <span
                                className="badge border fw-medium"
                                style={{ color: theme.accent, borderColor: theme.border, background: 'rgba(255,255,255,0.85)' }}
                              >
                                {formuleNom}
                              </span>
                            </div>
                          </div>
                          <CountdownRingVisual progress={prog} accent={theme.accent} size={86}>
                            <span className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>{shortCountdownLabel(seg)}</span>
                          </CountdownRingVisual>
                        </div>
                        {seg && !seg.expired && (
                          <div className="d-flex gap-2 justify-content-center mt-4 pt-2">
                            {[
                              ['J', seg.days],
                              ['H', seg.hours],
                              ['M', seg.minutes],
                              ['S', seg.seconds],
                            ].map(([label, val]) => (
                              <div
                                key={label}
                                className="rounded-3 text-center border bg-white shadow-sm px-2 py-2"
                                style={{ minWidth: 52, borderColor: theme.border }}
                              >
                                <div className="fw-bold fs-5 tabular-nums" style={{ color: theme.accent }}>
                                  {String(val).padStart(2, '0')}
                                </div>
                                <div className="text-muted text-uppercase" style={{ fontSize: 10, letterSpacing: '0.06em' }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="small text-muted text-center mb-0 mt-3">
                          Fin : {a.date_expiration ? new Date(a.date_expiration).toLocaleString('fr-FR') : '—'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'liste' && (
        <div className="card shadow-sm">
          <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
              <Clock size={20} />
              Liste des abonnements (compte à rebours)
            </h5>
            <button type="button" onClick={() => setView('autre')} className="btn btn-sm btn-outline-secondary">
              Retour
            </button>
          </div>
          <div className="card-body">
            {abonnements.length === 0 ? (
              <p className="text-muted text-center py-5 mb-0">
                Aucun abonnement enregistré. Les abonnements créés via « Nouveau abonné » apparaîtront ici avec leur compte à rebours.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nom complet</th>
                      <th>Type</th>
                      <th>Formule</th>
                      <th>Début</th>
                      <th>Fin</th>
                      <th>Montant / mois</th>
                      <th>Actif</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abonnements.map((a) => {
                      const nom = a.type_abonne === 'etudiant'
                        ? a.students?.nom_complet
                        : a.visitors?.nom_complet;
                      const detail = a.type_abonne === 'etudiant'
                        ? a.students?.promotions?.nom || a.students?.matricule
                        : a.visitors?.institution || '-';
                      const countdown = formatCountdown(a.date_expiration);
                      const isEnAttente = a.statut === 'en_attente';
                      const actifDansLeTemps = !isEnAttente && a.statut === 'actif' && a.date_expiration && !countdown.expired;
                      const formuleNom = a.subscription_types?.nom || a.type_abonnement?.replace(/_/g, ' ') || '-';
                      const theme = themeForSubscription(a.type_abonnement);
                      const segList = getCountdownSegments(a.date_expiration);
                      const progList = ringProgress(a.date_activation, a.date_expiration);
                      return (
                        <tr key={a.id}>
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              {actifDansLeTemps && (
                                <CountdownRingVisual progress={progList} accent={theme.accent} size={46}>
                                  <span className="fw-bold text-dark" style={{ fontSize: '0.65rem' }}>{shortCountdownLabel(segList)}</span>
                                </CountdownRingVisual>
                              )}
                              <div>
                                <div className="fw-medium">{nom || '-'}</div>
                                <small className="text-muted">{detail}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${a.type_abonne === 'etudiant' ? 'bg-primary' : 'bg-info'}`}>
                              {a.type_abonne === 'etudiant' ? 'Étudiant' : 'Visiteur'}
                            </span>
                          </td>
                          <td className="small">{formuleNom}</td>
                          <td className="small">{a.date_activation ? new Date(a.date_activation).toLocaleString('fr-FR') : '-'}</td>
                          <td className="small">{a.date_expiration ? new Date(a.date_expiration).toLocaleString('fr-FR') : '-'}</td>
                          <td className="small">
                            {a.montant_total_fc != null ? `${Number(a.montant_total_fc).toLocaleString()} FC` : '—'}
                            <br />
                            <span className="text-muted">{moisDepuisMontant(a)}</span>
                          </td>
                          <td>
                            <div className="d-flex flex-column gap-1">
                              {actifDansLeTemps && <span className="badge bg-success">Actif</span>}
                              {isEnAttente && <span className="badge bg-warning text-dark">En attente</span>}
                              {countdown.expired && !isEnAttente && <span className="badge bg-danger">Expiré</span>}
                              <span className={`badge ${countdown.expired ? 'bg-secondary' : 'bg-light text-dark'}`}>
                                {countdown.text}
                              </span>
                            </div>
                          </td>
                          <td className="text-end">
                            {isEnAttente && (
                              <button
                                type="button"
                                onClick={() => handleActiver(a)}
                                className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                              >
                                <Play size={14} />
                                Activer
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
