import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Modal, Form } from 'react-bootstrap';
import { supabase } from '../lib/supabase';
import { getRegistrationUrl } from '../lib/registrationUrl';
import { Plus, ChevronRight, Copy, Pencil, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { addMinutesToTime, inferHeureFinFromActivity, minutesBetweenTimes, activityScheduleLine } from '../lib/activityTime';

export default function Activites() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [participationCounts, setParticipationCounts] = useState({});
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, mode: 'form', item: null });
  const COTATIONS_PRESETS = [
    { label: 'Aucune', value: [] },
    { label: '0 à 20', value: Array.from({ length: 21 }, (_, i) => String(i)) },
    { label: '0 à 10', value: Array.from({ length: 11 }, (_, i) => String(i)) },
    { label: 'A, B, C, D, E', value: ['A', 'B', 'C', 'D', 'E'] },
    { label: 'Réussi, Échec', value: ['Réussi', 'Échec'] },
    { label: 'Satisfaisant, Non satisfaisant', value: ['Satisfaisant', 'Non satisfaisant'] },
    { label: 'Personnalisé', value: null },
  ];

  const [form, setForm] = useState({
    type_id: '',
    nom: '',
    date_debut: '',
    heure_debut: '09:00',
    heure_fin: '10:00',
    capacite: '',
    prix_default: '',
    notes: '',
    cotations_preset: '',
    cotations_personnalise: '',
    faculty_id: '',
    department_id: '',
    promotion_id: '',
    formateur_id: '',
  });
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [formateurs, setFormateurs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const editId = location.state?.editId;
    if (editId && activities.length > 0 && !modal.open) {
      const a = activities.find((x) => x.id === editId);
      if (a) {
        openEdit(a);
        navigate('/admin/activites', { replace: true, state: {} });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.editId, activities]);

  async function loadData() {
    let deptData = [];
    try {
      const { data, error } = await supabase.from('departments').select('id, faculty_id, nom').order('nom');
      deptData = error ? [] : (data || []);
    } catch {
      deptData = [];
    }
    const [actRes, typeRes, partRes, facRes, promRes, formRes] = await Promise.all([
      supabase.from('activities').select('*, activity_types(nom), promotions(id, nom, department_id, faculty_id, departments(nom), faculties(nom))').order('date_debut', { ascending: false }),
      supabase.from('activity_types').select('id, nom, parent_id').order('nom'),
      supabase.from('participations').select('activity_id'),
      supabase.from('faculties').select('id, nom').order('nom'),
      supabase.from('promotions').select('id, department_id, faculty_id, nom').order('nom'),
      (async () => {
        try {
          const { data, error } = await supabase.from('formateurs').select('id, faculty_id, nom_complet, type').eq('actif', true).order('nom_complet');
          return error ? [] : (data || []);
        } catch {
          return [];
        }
      })(),
    ]);
    setActivities(actRes.data || []);
    setTypes(typeRes.data || []);
    setFaculties(facRes.data || []);
    setDepartments(deptData);
    setPromotions(promRes.data || []);
    setFormateurs(Array.isArray(formRes) ? formRes : (formRes?.data || []));

    const counts = {};
    (partRes.data || []).forEach((p) => {
      counts[p.activity_id] = (counts[p.activity_id] || 0) + 1;
    });
    setParticipationCounts(counts);
    setLoading(false);
  }

  const deptsByFaculty = departments.filter((d) => d.faculty_id === form.faculty_id);
  const promosByDept = promotions.filter((p) => p.department_id === form.department_id);
  const formateursByFaculty = formateurs;

  const typeOptions = types;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const facultyId = form.promotion_id
        ? promotions.find((p) => p.id === form.promotion_id)?.faculty_id || form.faculty_id
        : form.faculty_id;
      let cotations = [];
      if (form.cotations_preset === 'Personnalisé' && form.cotations_personnalise?.trim()) {
        cotations = form.cotations_personnalise.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      } else if (form.cotations_preset) {
        const preset = COTATIONS_PRESETS.find((p) => p.label === form.cotations_preset);
        if (preset && Array.isArray(preset.value)) cotations = preset.value;
      }
      const dureeMin = minutesBetweenTimes(form.heure_debut, form.heure_fin);
      const payload = {
        type_id: form.type_id,
        nom: form.nom,
        date_debut: form.date_debut,
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
        duree_minutes: dureeMin,
        capacite: form.capacite ? parseInt(form.capacite) : null,
        prix_default: form.prix_default ? parseFloat(form.prix_default) : 0,
        notes: form.notes?.trim() || null,
        cotations: cotations,
        promotion_id: form.promotion_id || null,
        description: null,
        lieu: null,
        actif: true,
      };
      if (facultyId) payload.faculty_id = facultyId;
      if (form.formateur_id) payload.formateur_id = form.formateur_id;
      if (modal.item) {
        const { error } = await supabase.from('activities').update(payload).eq('id', modal.item.id);
        if (error) throw error;
        toast.success('Activité modifiée.');
        setModal({ open: false, mode: 'form', item: null });
      } else {
        const { data, error } = await supabase.from('activities').insert([payload]).select().single();
        if (error) throw error;
        toast.success('Activité créée ! QR Code généré.');
        setModal({ open: true, mode: 'qr', item: data });
      }
      setForm({ type_id: '', nom: '', date_debut: '', heure_debut: '09:00', heure_fin: '10:00', capacite: '', prix_default: '', notes: '', cotations_preset: '', cotations_personnalise: '', faculty_id: '', department_id: '', promotion_id: '', formateur_id: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  }

  function openCreate() {
    setForm({
      type_id: typeOptions[0]?.id || '',
      nom: '',
      date_debut: new Date().toISOString().slice(0, 10),
      heure_debut: '09:00',
      heure_fin: addMinutesToTime('09:00', 60),
      capacite: '',
      prix_default: '',
      notes: '',
      cotations_preset: '',
      cotations_personnalise: '',
      faculty_id: faculties[0]?.id || '',
      department_id: '',
      promotion_id: '',
      formateur_id: '',
    });
    setModal({ open: true, mode: 'form', item: null });
  }

  function openEdit(a) {
    const promos = a.promotions || promotions.find((p) => p.id === a.promotion_id);
    const deptId = promos?.department_id || '';
    const facId = promos?.faculty_id || a.faculty_id || faculties[0]?.id || '';
    let cotationsPreset = '';
    let cotationsPersonnalise = '';
    if (Array.isArray(a.cotations) && a.cotations.length) {
      const preset = COTATIONS_PRESETS.find((p) => p.value && JSON.stringify(p.value) === JSON.stringify(a.cotations));
      cotationsPreset = preset ? preset.label : 'Personnalisé';
      if (cotationsPreset === 'Personnalisé') cotationsPersonnalise = a.cotations.join(', ');
    }
    setForm({
      type_id: a.type_id,
      nom: a.nom,
      date_debut: a.date_debut || '',
      heure_debut: a.heure_debut || '09:00',
      heure_fin: inferHeureFinFromActivity(a),
      capacite: a.capacite ? String(a.capacite) : '',
      prix_default: a.prix_default ? String(a.prix_default) : '',
      notes: a.notes || '',
      cotations_preset: cotationsPreset,
      cotations_personnalise: cotationsPersonnalise,
      faculty_id: facId,
      department_id: deptId,
      promotion_id: a.promotion_id || '',
      formateur_id: a.formateur_id || '',
    });
    setModal({ open: true, mode: 'form', item: a });
  }

  async function handleDelete(a, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Supprimer l'activité « ${a.nom} » ?\nLes inscriptions associées seront aussi supprimées.`)) return;
    try {
      const { error } = await supabase.from('activities').delete().eq('id', a.id);
      if (error) throw error;
      toast.success('Activité supprimée.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  }

  const qrUrl = modal.item ? getRegistrationUrl(modal.item.id) : '';

  if (loading && activities.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
        <div>
          <h1 className="h4 fw-bold text-dark mb-1">Activités</h1>
          <p className="text-muted small mb-0">Programmer et gérer les activités de la Salle du Numérique</p>
        </div>
        <Button variant="primary" size="lg" onClick={openCreate} className="d-flex align-items-center gap-2 shadow-sm">
          <Plus className="w-5 h-5" /> Nouvelle activité
        </Button>
      </div>

      {/* Activity cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activities.filter(Boolean).map((a) => (
          <div
            key={a.id}
            className="group relative bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-primary-100 transition-all duration-200"
          >
            <Link to={`/admin/activites/${a.id}`} className="block">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1 pr-8">
                  <h3 className="font-semibold text-slate-800 truncate">{a.nom}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{a.activity_types?.nom || '-'}{a.promotions && ` • ${a.promotions.nom}`}</p>
                  <p className="text-sm text-slate-600 mt-2">{a.date_debut} • {activityScheduleLine(a)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 flex-shrink-0 absolute top-5 right-5" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">
                  {participationCounts[a.id] || 0} participant{(participationCounts[a.id] || 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
            <div className="position-absolute top-0 end-0 d-flex gap-1 p-2" style={{ zIndex: 10 }}>
              <Button
                variant="light"
                size="sm"
                className="p-2 text-secondary"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(a); }}
                title="Modifier"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="light"
                size="sm"
                className="p-2 text-danger"
                onClick={(e) => handleDelete(a, e)}
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {activities.length === 0 && (
        <div className="bg-white rounded-3 border p-5 p-md-5 text-center">
          <p className="text-muted mb-3">Aucune activité.</p>
          <Button variant="primary" onClick={openCreate} className="d-inline-flex align-items-center gap-2">
            <Plus className="w-4 h-4" /> Créer une activité
          </Button>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal show={modal.open && modal.mode === 'form'} onHide={() => setModal({ open: false, mode: 'form', item: null })} centered size="lg" className="rounded-3">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold">
            {modal.item ? "Modifier l'activité" : 'Nouvelle activité'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0">
            <Form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
              <div>
                <Form.Label className="fw-medium mb-2">Titre</Form.Label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  required
                  className="input-field"
                  placeholder="ex: Pratiques Informatique L3"
                />
              </div>
              <div>
                <Form.Label className="fw-medium mb-2">Faculté</Form.Label>
                <div className="d-flex flex-column gap-2">
                  <select
                    value={form.faculty_id}
                    onChange={(e) => setForm({ ...form, faculty_id: e.target.value, department_id: '', promotion_id: '', formateur_id: '' })}
                    className="input-field"
                    required
                  >
                    <option value="">-- Sélectionner une faculté --</option>
                    {faculties.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                  {form.faculty_id && (
                    <select
                      value={form.department_id}
                      onChange={(e) => setForm({ ...form, department_id: e.target.value, promotion_id: '' })}
                      className="input-field"
                    >
                      <option value="">-- Département --</option>
                      {deptsByFaculty.map((d) => (
                        <option key={d.id} value={d.id}>{d.nom}</option>
                      ))}
                    </select>
                  )}
                  {form.department_id && (
                    <select
                      value={form.promotion_id}
                      onChange={(e) => setForm({ ...form, promotion_id: e.target.value })}
                      className="input-field"
                    >
                      <option value="">-- Promotion --</option>
                      {promosByDept.map((p) => (
                        <option key={p.id} value={p.id}>{p.nom}</option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Optionnel : cibler une promotion pour afficher la liste officielle</p>
              </div>
              {formateursByFaculty.length > 0 && (
                <div>
                  <Form.Label className="fw-medium mb-2">Formateur superviseur</Form.Label>
                  <select
                    value={form.formateur_id}
                    onChange={(e) => setForm({ ...form, formateur_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">-- Aucun --</option>
                    {formateursByFaculty.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom_complet} ({f.type})</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Enseignant/formateur qui supervise cette pratique</p>
                </div>
              )}
              <div>
                <Form.Label className="fw-medium mb-2">Type</Form.Label>
                <select
                  value={form.type_id}
                  onChange={(e) => setForm({ ...form, type_id: e.target.value })}
                  required
                  className="input-field"
                >
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <Form.Label className="fw-medium mb-2">Date</Form.Label>
                <input
                  type="date"
                  value={form.date_debut}
                  onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                  required
                  className="input-field"
                />
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <Form.Label className="fw-medium mb-2">Heure de début</Form.Label>
                  <input
                    type="time"
                    value={form.heure_debut}
                    onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div className="col-6">
                  <Form.Label className="fw-medium mb-2">Heure de fin</Form.Label>
                  <input
                    type="time"
                    value={form.heure_fin}
                    onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
                    className="input-field"
                  />
                </div>
                <p className="col-12 text-xs text-slate-500 mb-0">La durée enregistrée est déduite automatiquement (si la fin est avant le début, elle est prise le lendemain).</p>
                <div className="col-6">
                  <Form.Label className="fw-medium mb-2">Capacité max</Form.Label>
                  <input
                    type="number"
                    value={form.capacite}
                    onChange={(e) => setForm({ ...form, capacite: e.target.value })}
                    min={1}
                    placeholder="Illimité"
                    className="input-field"
                  />
                </div>
                <div className="col-6">
                  <Form.Label className="fw-medium mb-2">Prix (FC)</Form.Label>
                  <input
                    type="number"
                    value={form.prix_default}
                    onChange={(e) => setForm({ ...form, prix_default: e.target.value })}
                    min={0}
                    step={100}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <Form.Label className="fw-medium mb-2">Liste des cotations</Form.Label>
                <p className="text-xs text-slate-500 mb-2">Définir les notes possibles pour cette activité (avant génération de la liste)</p>
                <select
                  value={form.cotations_preset}
                  onChange={(e) => setForm({ ...form, cotations_preset: e.target.value })}
                  className="input-field"
                >
                  <option value="">-- Choisir ou personnaliser --</option>
                  {COTATIONS_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </select>
                {form.cotations_preset === 'Personnalisé' && (
                  <input
                    type="text"
                    value={form.cotations_personnalise}
                    onChange={(e) => setForm({ ...form, cotations_personnalise: e.target.value })}
                    placeholder="Ex: 0, 1, 2, 3, ... 20 ou A, B, C"
                    className="input-field mt-2"
                  />
                )}
              </div>
              <div>
                <Form.Label className="fw-medium mb-2">Notes internes</Form.Label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes pour le secrétaire..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
              <div className="d-flex gap-2 justify-content-end pt-2">
                <Button variant="outline-secondary" onClick={() => setModal({ open: false, mode: 'form', item: null })}>
                  Annuler
                </Button>
                <Button type="submit" variant="primary">
                  {modal.item ? 'Enregistrer' : 'Créer et générer QR'}
                </Button>
              </div>
            </Form>
        </Modal.Body>
      </Modal>

      {/* QR preview modal - after creation */}
<Modal show={modal.open && modal.mode === 'qr' && !!modal.item} onHide={() => setModal({ open: false, mode: 'qr', item: null })} centered size="sm">
        <Modal.Body className="text-center p-4">
              {modal.item && (
                <>
              <h5 className="fw-bold mb-1">QR Code généré</h5>
              <p className="text-muted small mb-4">{modal.item.nom}</p>
              <div className="bg-white rounded-2xl border-2 border-slate-100 p-6 inline-block">
                <QRCodeSVG value={qrUrl} size={220} />
              </div>
              <p className="text-xs text-slate-400 mt-4 break-all px-2">{qrUrl}</p>
              <p className="text-sm text-slate-500 mt-2">Scannez pour ouvrir le formulaire d'enregistrement</p>
              <Button variant="outline-primary" className="w-100 d-flex align-items-center justify-content-center gap-2 mt-3" onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('Lien copié !'); }}>
                <Copy className="w-4 h-4" /> Copier le lien
              </Button>
              <Link to={`/admin/activites/${modal.item.id}`} className="btn btn-primary mt-3 w-100 d-inline-flex align-items-center justify-content-center gap-2">
                  Voir l'activité <ChevronRight className="w-4 h-4" />
                </Link>
              <Button variant="link" className="w-100 mt-2 text-muted text-decoration-none" onClick={() => setModal({ open: false, mode: 'qr', item: null })}>
                Fermer
              </Button>
                </>
              )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
