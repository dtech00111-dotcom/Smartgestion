import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';
import { activityScheduleLine, sliceTime } from '../lib/activityTime';

export default function ReserveForm() {
  const { activityId } = useParams();
  const [activity, setActivity] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    faculty_id: '',
    promotion_id: '',
    matricule: '',
    telephone: '',
    desired_date: '',
    desired_time_start: '',
    desired_time_end: '',
    duration_minutes: '',
    notes: '',
    creneau_alternatif: '',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  useEffect(() => {
    if (activity?.date_debut) {
      setForm((f) => ({ ...f, desired_date: activity.date_debut }));
    }
    if (activity?.heure_debut) {
      const [h, m] = String(activity.heure_debut).slice(0, 5).split(':');
      setForm((f) => ({ ...f, desired_time_start: `${h.padStart(2, '0')}:${m || '00'}` }));
    }
    if (activity?.heure_fin) {
      setForm((f) => ({ ...f, desired_time_end: sliceTime(activity.heure_fin) }));
    }
    if (activity?.duree_minutes) {
      setForm((f) => ({ ...f, duration_minutes: String(activity.duree_minutes) }));
    }
  }, [activity]);

  async function loadData() {
    if (!activityId) {
      setActivity(null);
      setLoading(false);
      return;
    }
    try {
      const [actRes, facRes, promRes] = await Promise.all([
        supabase.from('activities').select('*, activity_types(nom), promotions(id, nom, faculty_id)').eq('id', activityId).eq('actif', true).maybeSingle(),
        supabase.from('faculties').select('id, nom').order('nom'),
        supabase.from('promotions').select('id, nom, faculty_id').order('nom'),
      ]);
      if (actRes.error) throw actRes.error;
      if (!actRes.data) {
        setActivity(null);
        setLoading(false);
        return;
      }
      setActivity(actRes.data);
      setFaculties(facRes.data || []);
      setPromotions(promRes.data || []);
    } catch (err) {
      console.error('ReserveForm loadData:', err);
      setActivity(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const fullName = form.full_name?.trim();
    if (!fullName) {
      alert('Le nom complet est obligatoire.');
      return;
    }
    if (!form.telephone?.trim()) {
      alert('Le téléphone est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      const facultyId = form.faculty_id || null;
      const promotionId = form.promotion_id || null;
      const desiredTimeStart = form.desired_time_start || null;
      const desiredTimeEnd = form.desired_time_end || null;
      const duration = form.duration_minutes ? parseInt(form.duration_minutes, 10) : null;
      const desiredDate = form.desired_date || null;
      const notesCombined = [form.notes?.trim(), form.creneau_alternatif?.trim() ? `Créneau alternatif souhaité : ${form.creneau_alternatif}` : null].filter(Boolean).join('\n') || null;

      const { data: existing } = await supabase
        .from('reservations')
        .select('id')
        .eq('activity_id', activityId)
        .ilike('full_name', fullName)
        .in('status', ['pending', 'approved'])
        .limit(1);
      if (existing?.length) {
        setSubmitting(false);
        alert(`Une réservation existe déjà pour "${fullName}" sur cette activité.`);
        return;
      }

      const capacite = activity?.capacite;
      if (capacite != null) {
        const [partRes, resRes] = await Promise.all([
          supabase.from('participations').select('id', { count: 'exact', head: true }).eq('activity_id', activityId),
          supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('activity_id', activityId).in('status', ['pending', 'approved']),
        ]);
        const spotsTaken = (partRes.count || 0) + (resRes.count || 0);
        if (spotsTaken >= capacite) {
          setSubmitting(false);
          alert('Cette activité a atteint sa capacité maximale.');
          return;
        }
      }

      const { error } = await supabase.from('reservations').insert([
        {
          activity_id: activityId,
          full_name: fullName,
          faculty_id: facultyId,
          promotion_id: promotionId,
          matricule: form.matricule?.trim() || null,
          telephone: form.telephone.trim(),
          desired_date: desiredDate,
          desired_time_start: desiredTimeStart,
          desired_time_end: desiredTimeEnd || null,
          duration_minutes: duration,
          notes: notesCombined,
          status: 'pending',
        },
      ]);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      setSubmitting(false);
      alert(err?.message || 'Erreur lors de la réservation.');
    }
  }

  const promotionsByFaculty = form.faculty_id
    ? promotions.filter((p) => p.faculty_id === form.faculty_id)
    : [];

  if (loading) {
    return (
      <div className="inscription-form-page min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!activity && activityId) {
    return (
      <div className="inscription-form-page min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm text-center">
          <img src="/logo-salle-numerique.png" alt="Salle du Numérique" className="w-12 h-12 mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-bold text-slate-800">Activité introuvable</h1>
          <p className="text-slate-500 mt-2 text-sm">Ce lien n&apos;est plus valide ou l&apos;activité a été désactivée.</p>
          <Link to="/reserve" className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
            Voir le calendrier des activités
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="inscription-form-page min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Réservation enregistrée</h1>
          <p className="text-slate-500 mt-2 text-sm">
            Votre réservation a été soumise. Le secrétariat la validera et vous serez notifié.
          </p>
          <p className="text-slate-600 font-medium mt-4">{activity.nom}</p>
          <p className="text-slate-400 text-xs mt-1">
            {activity.activity_types?.nom} • {activity.date_debut}
          </p>
          <p className="text-slate-400 text-xs mt-6">SMART GESTION – Salle du Numérique UNILU</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inscription-form-page min-h-screen bg-slate-50 pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <img src="/logo-salle-numerique.png" alt="Salle du Numérique" className="w-16 h-16 mx-auto mb-3 object-contain" />
          <h1 className="text-lg font-bold text-slate-800">RÉSERVER UNE ACTIVITÉ</h1>
          <p className="text-slate-500 text-sm mt-1">Salle du Numérique – UNILU</p>
          <div className="mt-4 p-4 rounded-2xl border bg-white border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Activité</p>
            <p className="font-semibold text-slate-800 mt-1">{activity.nom}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {activity.activity_types?.nom} • {activity.date_debut} • {activityScheduleLine(activity)}
            </p>
            <Link
              to="/reserve"
              className="inline-block mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              ← Changer d&apos;activité (calendrier)
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nom complet *</label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              placeholder="Prénom et nom"
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone *</label>
            <input
              type="tel"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              required
              placeholder="+243..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Faculté</label>
            <select
              value={form.faculty_id}
              onChange={(e) => setForm({ ...form, faculty_id: e.target.value, promotion_id: '' })}
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
            >
              <option value="">-- Optionnel --</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.id}>{f.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Promotion</label>
            <select
              value={form.promotion_id}
              onChange={(e) => setForm({ ...form, promotion_id: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
            >
              <option value="">-- Optionnel --</option>
              {promotionsByFaculty.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Matricule</label>
            <input
              type="text"
              value={form.matricule}
              onChange={(e) => setForm({ ...form, matricule: e.target.value })}
              placeholder="Optionnel"
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date souhaitée</label>
              <input
                type="date"
                value={form.desired_date}
                onChange={(e) => setForm({ ...form, desired_date: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Heure début</label>
              <input
                type="time"
                value={form.desired_time_start}
                onChange={(e) => setForm({ ...form, desired_time_start: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Heure fin (optionnel)</label>
              <input
                type="time"
                value={form.desired_time_end}
                onChange={(e) => setForm({ ...form, desired_time_end: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Durée (minutes)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                placeholder={activity.duree_minutes || '60'}
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Créneau alternatif souhaité</label>
            <input
              type="text"
              value={form.creneau_alternatif}
              onChange={(e) => setForm({ ...form, creneau_alternatif: e.target.value })}
              placeholder="Ex : Mardi 14h-16h ou Jeudi matin"
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Remarques ou besoins spécifiques"
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 text-base font-semibold bg-primary-600 text-white rounded-2xl hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/25"
          >
            {submitting ? 'Envoi...' : 'Réserver'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Le secrétariat validera votre réservation. Vous recevrez une notification.
        </p>
      </div>
    </div>
  );
}
