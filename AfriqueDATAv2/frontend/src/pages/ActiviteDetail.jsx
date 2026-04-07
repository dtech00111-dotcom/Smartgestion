import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FileSpreadsheet, FileText, ArrowLeft, Users, Coins, CheckCircle, Plus, UserPlus, Copy, Pencil, Trash2 } from 'lucide-react';
import StudentSearch from '../components/StudentSearch';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { exportActivityToExcel, exportActivityToPDF, exportActivityToExcelCotation, exportActivityToPDFCotation } from '../lib/exports';
import { getRegistrationUrl } from '../lib/registrationUrl';
import { getReservationUrl, getReservationCalendarUrl } from '../lib/reservationUrl';
import toast from 'react-hot-toast';
import { activityScheduleLine } from '../lib/activityTime';

const STATUT_LABEL = { en_attente: 'En attente', paye: 'Payé', valide: 'Validé' };
const STATUT_CLASS = {
  en_attente: 'bg-amber-50 text-amber-700',
  paye: 'bg-blue-50 text-blue-700',
  valide: 'bg-primary-50 text-primary-700',
};

export default function ActiviteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { adminProfile } = useAuth();
  const [activity, setActivity] = useState(null);
  const [participations, setParticipations] = useState([]);
  const [officialStudents, setOfficialStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [searchSelectedStudent, setSearchSelectedStudent] = useState(null);
  const [newMontant, setNewMontant] = useState('');
  const [enrollForm, setEnrollForm] = useState({
    nom_complet: '',
    montant: '',
    validerPaiement: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    const [actRes, partRes] = await Promise.all([
      supabase.from('activities').select('*, activity_types(nom), promotions(id, nom, faculty_id, departments(nom), faculties(nom)), formateurs(nom_complet, type)').eq('id', id).single(),
      supabase.from('participations').select('*, faculties(nom), promotions(nom)').eq('activity_id', id).order('created_at', { ascending: false }),
    ]);
    setActivity(actRes.data);
    setParticipations(partRes.data || []);

    if (actRes.data?.promotion_id) {
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('promotion_id', actRes.data.promotion_id)
        .order('nom_complet');
      setOfficialStudents(students || []);
    } else {
      setOfficialStudents([]);
    }
    setLoading(false);
  }

  const total = participations.reduce((s, p) => s + Number(p.montant), 0);
  const qrUrl = activity ? getRegistrationUrl(id) : '';
  const reserveQrUrl = activity ? getReservationUrl(id) : '';
  const capacite = activity?.capacite;
  const atCapacity = capacite != null && participations.length >= capacite;
  const prixDefault = Number(activity?.prix_default) || 0;
  const enrolledStudentIds = participations.filter((p) => p.student_id).map((p) => p.student_id);

  const participationsByStudent = {};
  participations.forEach((p) => {
    if (p.student_id) participationsByStudent[p.student_id] = p;
  });

  const externalParticipations = participations.filter((p) => !p.student_id);

  async function handleValidate(participationId) {
    const { error } = await supabase
      .from('participations')
      .update({
        statut_paiement: 'valide',
        validated_at: new Date().toISOString(),
        validated_by: adminProfile?.id || null,
      })
      .eq('id', participationId);
    if (error) toast.error(error.message);
    else {
      toast.success('Paiement validé');
      loadData();
    }
  }

  async function handleAddParticipation(student) {
    const montant = parseFloat(newMontant) || 0;
    const promotionId = student.promotion_id ?? activity?.promotion_id;
    const facultyId = student.promotions?.faculty_id ?? activity?.promotions?.faculty_id ?? activity?.faculty_id;
    const { error } = await supabase.from('participations').insert([
      {
        activity_id: id,
        student_id: student.id,
        nom_complet: student.nom_complet,
        matricule: student.matricule,
        promotion_id: promotionId,
        faculty_id: facultyId,
        type_participant: 'etudiant',
        montant,
        statut_paiement: 'en_attente',
      },
    ]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Inscription ajoutée');
    setAddingFor(null);
    setSearchSelectedStudent(null);
    setNewMontant('');
    loadData();
  }

  async function handleEnrollSubmit(e) {
    e.preventDefault();
    const nom = enrollForm.nom_complet?.trim();
    if (!nom) {
      toast.error('Le nom de l\'étudiant est obligatoire');
      return;
    }
    setSubmitting(true);
    const montant = parseFloat(enrollForm.montant) || 0;
    const activityFacultyId = activity?.faculty_id || activity?.promotions?.faculty_id;
    const payload = {
      activity_id: id,
      nom_complet: nom,
      faculty_id: activityFacultyId || null,
      type_participant: 'etudiant',
      montant,
      statut_paiement: enrollForm.validerPaiement ? 'valide' : 'en_attente',
    };
    if (enrollForm.validerPaiement) {
      payload.validated_at = new Date().toISOString();
      payload.validated_by = adminProfile?.id || null;
    }
    const { error } = await supabase.from('participations').insert([payload]);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Inscription enregistrée');
    setEnrollForm({ nom_complet: '', montant: '', validerPaiement: false });
    loadData();
  }

  async function handleUpdateCote(participationId, cote) {
    const { error } = await supabase.from('participations').update({ cote: cote || null }).eq('id', participationId);
    if (error) toast.error(error.message);
    else loadData();
  }

  async function handleUpdateMontant(participationId, montant) {
    const { error } = await supabase
      .from('participations')
      .update({ montant: parseFloat(montant) || 0 })
      .eq('id', participationId);
    if (error) toast.error(error.message);
    else loadData();
  }

  async function handleDeleteActivity() {
    if (!window.confirm(`Supprimer l'activité « ${activity.nom} » ?\nLes inscriptions associées seront aussi supprimées.`)) return;
    try {
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
      toast.success('Activité supprimée.');
      navigate('/admin/activites');
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Activité introuvable</p>
        <Link to="/admin/activites" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux activités
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/admin/activites"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux activités
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-xl font-bold text-slate-800 flex-1">{activity.nom}</h1>
              <div className="flex gap-2 shrink-0">
                <Link
                  to="/admin/activites"
                  state={{ editId: id }}
                  className="p-2 rounded-lg text-slate-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </Link>
                <button
                  onClick={handleDeleteActivity}
                  className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-slate-500 text-sm mt-1">{activity.activity_types?.nom}</p>
            {activity.promotions && (
              <p className="text-primary-600 text-sm font-medium mt-1">
                {activity.promotions.faculties?.nom} • {activity.promotions.departments?.nom} • {activity.promotions.nom}
              </p>
            )}
            {activity.formateurs && (
              <p className="text-slate-600 text-sm mt-1">
                Superviseur : {activity.formateurs.nom_complet}
              </p>
            )}
            <p className="text-slate-600 text-sm mt-2">
              {activity.date_debut} • {activityScheduleLine(activity)}
            </p>
            {capacite != null && (
              <p className={`text-sm mt-1 font-medium ${atCapacity ? 'text-amber-600' : 'text-slate-600'}`}>
                Capacité : {participations.length} sur {capacite}
              </p>
            )}
            {prixDefault > 0 && (
              <p className="text-sm text-slate-600 mt-0.5">Prix par défaut : {prixDefault.toLocaleString()} FC</p>
            )}
            {activity.notes && (
              <p className="text-xs text-slate-500 mt-2 p-2 bg-slate-50 rounded-lg">{activity.notes}</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">QR Code – Inscription</h2>
            <p className="text-xs text-slate-500 mb-2">Scannez pour ouvrir le formulaire d&apos;enregistrement direct</p>
            <div className="bg-slate-50 rounded-xl p-4 flex justify-center">
              <QRCodeSVG value={qrUrl} size={180} />
            </div>
            <p className="text-xs text-slate-500 mt-3 break-all">{qrUrl}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(qrUrl);
                toast.success('Lien copié ! Partagez-le pour les inscriptions.');
              }}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Copy className="w-4 h-4" /> Copier le lien d&apos;inscription
            </button>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-2">QR Code – Réservation (à valider par le secrétariat)</p>
              <div className="bg-slate-50 rounded-xl p-3 flex justify-center">
                <QRCodeSVG value={reserveQrUrl} size={140} />
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reserveQrUrl);
                  toast.success('Lien de réservation copié !');
                }}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" /> Copier le lien de réservation
              </button>
              <p className="text-xs text-slate-400 mt-2">
                <a href={getReservationCalendarUrl()} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  Calendrier des activités
                </a>
                {' '}– pour formateurs et utilisateurs
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-2xl border p-4 shadow-sm ${atCapacity ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-2 text-slate-500">
                <Users className="w-4 h-4" />
                <span className="text-xs font-medium">Participants</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {participations.length}
                {capacite != null && ` sur ${capacite}`}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Coins className="w-4 h-4" />
                <span className="text-xs font-medium">Total encaissé</span>
              </div>
              <p className="text-xl font-bold text-primary-600 mt-1">{total.toLocaleString()} FC</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">Rapport secrétaire (paiements)</p>
            <div className="flex gap-2">
              <button onClick={() => { exportActivityToExcel(activity, participations, adminProfile?.nom_complet || 'Secrétaire'); toast.success('Export Excel téléchargé'); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={async () => { try { await exportActivityToPDF(activity, participations, adminProfile?.nom_complet || 'Secrétaire'); toast.success('Export PDF téléchargé'); } catch (e) { toast.error(e?.message || 'Erreur export PDF'); } }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-3">Liste de cotation (notes)</p>
            <div className="flex gap-2">
              <button onClick={() => { exportActivityToExcelCotation(activity, participations, adminProfile?.nom_complet || 'Secrétaire'); toast.success('Liste cotation Excel téléchargée'); }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={async () => { try { await exportActivityToPDFCotation(activity, participations, adminProfile?.nom_complet || 'Secrétaire'); toast.success('Liste cotation PDF téléchargée'); } catch (e) { toast.error(e?.message || 'Erreur export PDF'); } }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors">
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Recherche rapide étudiant */}
          {!atCapacity && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary-500" />
                  Recherche rapide étudiant
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Tapez un nom ou matricule pour attacher un étudiant</p>
              </div>
              <div className="p-4">
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <StudentSearch
                      facultyId={activity?.faculty_id || activity?.promotions?.faculty_id}
                      promotionId={activity?.promotion_id}
                      excludeIds={enrolledStudentIds}
                      onSelect={(student) => {
                        setSearchSelectedStudent(student);
                        setNewMontant(String(prixDefault || ''));
                      }}
                      placeholder="Nom ou matricule..."
                    />
                  </div>
                  {searchSelectedStudent && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 truncate max-w-[120px]">
                        {searchSelectedStudent.nom_complet}
                      </span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Montant"
                        value={newMontant}
                        onChange={(e) => setNewMontant(e.target.value)}
                        className="input-field w-28"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          handleAddParticipation(searchSelectedStudent);
                          setSearchSelectedStudent(null);
                          setNewMontant('');
                        }}
                        className="btn-primary text-sm py-2"
                      >
                        Ajouter
                      </button>
                      <button
                        onClick={() => {
                          setSearchSelectedStudent(null);
                          setNewMontant('');
                        }}
                        className="text-slate-500 hover:text-slate-700 text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
                {searchSelectedStudent && !officialStudents.find((s) => s.id === searchSelectedStudent.id) && (
                  <p className="text-xs text-amber-600 mt-2">
                    Étudiant hors liste officielle – le bouton Ajouter enregistrera quand même l&apos;inscription.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Formulaire d'enregistrement manuel */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-500" />
                Enregistrer un participant
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">Nom complet et paiement (visiteur ou étudiant hors liste)</p>
            </div>
            <form onSubmit={handleEnrollSubmit} className="p-6 space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom complet</label>
                  <input
                    type="text"
                    required
                    value={enrollForm.nom_complet}
                    onChange={(e) => setEnrollForm((f) => ({ ...f, nom_complet: e.target.value }))}
                    placeholder="Nom de l'étudiant"
                    className="input-field"
                  />
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Montant (FC)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={enrollForm.montant}
                    onChange={(e) => setEnrollForm((f) => ({ ...f, montant: e.target.value }))}
                    placeholder="0"
                    className="input-field"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enrollForm.validerPaiement}
                    onChange={(e) => setEnrollForm((f) => ({ ...f, validerPaiement: e.target.checked }))}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Valider le paiement</span>
                </label>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex items-center gap-2"
                >
                  {submitting ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>

          {/* Liste officielle promotion (quand activité cible une promotion) */}
          {activity.promotion_id && officialStudents.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-primary-50/30">
                <h2 className="text-lg font-semibold text-slate-800">Liste officielle – {activity.promotions?.nom}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Paiement et validation par le secrétaire</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 text-left text-sm text-slate-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">Nom</th>
                      <th className="px-6 py-3 font-medium">Matricule</th>
                      <th className="px-6 py-3 font-medium">Montant</th>
                      <th className="px-6 py-3 font-medium">Statut</th>
                      <th className="px-6 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {officialStudents.map((student) => {
                      const part = participationsByStudent[student.id];
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 font-medium text-slate-800">{student.nom_complet}</td>
                          <td className="px-6 py-3 text-slate-600">{student.matricule}</td>
                          <td className="px-6 py-3">
                            {part ? (
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={part.montant}
                                onChange={(e) => handleUpdateMontant(part.id, e.target.value)}
                                className="w-20 px-2 py-1 border rounded-lg text-sm"
                              />
                            ) : addingFor === student.id ? (
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={newMontant}
                                onChange={(e) => setNewMontant(e.target.value)}
                                className="w-20 px-2 py-1 border rounded-lg text-sm"
                                autoFocus
                              />
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {part && (
                              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${STATUT_CLASS[part.statut_paiement] || STATUT_CLASS.en_attente}`}>
                                {STATUT_LABEL[part.statut_paiement] || part.statut_paiement}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {part ? (
                              part.statut_paiement !== 'valide' && (
                                <button
                                  onClick={() => handleValidate(part.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg"
                                  title="Valider le paiement"
                                >
                                  <CheckCircle className="w-4 h-4" /> Valider
                                </button>
                              )
                            ) : addingFor === student.id ? (
                              <button
                                onClick={() => handleAddParticipation(student)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                              >
                                Enregistrer
                              </button>
                            ) : (
                              <button
                                onClick={() => setAddingFor(student.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                <Plus className="w-4 h-4" /> Ajouter
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Liste de cotation (notes académiques) – distincte du rapport secrétaire */}
          {(activity.cotations?.length > 0) && (
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-emerald-100 bg-emerald-50/30">
                <h2 className="text-lg font-semibold text-slate-800">Liste de cotation</h2>
                <p className="text-sm text-slate-500 mt-0.5">Notes académiques – distincte du rapport secrétaire</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/80 text-left text-sm text-slate-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">N°</th>
                      <th className="px-6 py-3 font-medium">Nom</th>
                      <th className="px-6 py-3 font-medium">Matricule</th>
                      <th className="px-6 py-3 font-medium">Cote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {participations.map((p, i) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3 text-slate-600">{i + 1}</td>
                        <td className="px-6 py-3 font-medium text-slate-800">{p.nom_complet}</td>
                        <td className="px-6 py-3 text-slate-600">{p.matricule || '-'}</td>
                        <td className="px-6 py-3">
                          <select
                            value={p.cote || ''}
                            onChange={(e) => handleUpdateCote(p.id, e.target.value)}
                            className="input-field py-1.5 w-24 text-sm"
                          >
                            <option value="">-</option>
                            {(activity.cotations || []).map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Inscriptions externes (QR, visiteurs) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {activity.promotion_id ? 'Inscriptions externes (QR)' : 'Liste des participants'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{participations.length} inscription{participations.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/80 text-left text-sm text-slate-600">
                  <tr>
                    <th className="px-6 py-3 font-medium">Nom</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Faculté</th>
                    <th className="px-6 py-3 font-medium">Montant</th>
                    <th className="px-6 py-3 font-medium">Statut</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {externalParticipations.length > 0 ? (
                    externalParticipations.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-medium text-slate-800">{p.nom_complet}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${p.type_participant === 'etudiant' ? 'bg-primary-50 text-primary-700' : 'bg-purple-50 text-purple-700'}`}>
                            {p.type_participant === 'etudiant' ? 'Étudiant' : 'Visiteur'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{p.faculties?.nom || '-'}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{Number(p.montant).toLocaleString()} FC</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${STATUT_CLASS[p.statut_paiement] || STATUT_CLASS.en_attente}`}>
                            {STATUT_LABEL[p.statut_paiement] || 'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {p.statut_paiement !== 'valide' && (
                            <button
                              onClick={() => handleValidate(p.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg"
                            >
                              <CheckCircle className="w-4 h-4" /> Valider
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : !activity.promotion_id ? (
                    participations.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-medium text-slate-800">{p.nom_complet}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${p.type_participant === 'etudiant' ? 'bg-primary-50 text-primary-700' : 'bg-purple-50 text-purple-700'}`}>
                            {p.type_participant === 'etudiant' ? 'Étudiant' : 'Visiteur'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{p.faculties?.nom || '-'}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{Number(p.montant).toLocaleString()} FC</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${STATUT_CLASS[p.statut_paiement] || STATUT_CLASS.en_attente}`}>
                            {STATUT_LABEL[p.statut_paiement] || 'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {p.statut_paiement !== 'valide' && (
                            <button onClick={() => handleValidate(p.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg">
                              <CheckCircle className="w-4 h-4" /> Valider
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : null}
                  {((activity.promotion_id && externalParticipations.length === 0) || (!activity.promotion_id && participations.length === 0)) && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                        Aucune inscription. Partagez le QR code pour les inscriptions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
