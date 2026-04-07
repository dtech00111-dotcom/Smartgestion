import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { activityScheduleLine } from '../lib/activityTime';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Clock,
  MapPin,
} from 'lucide-react';

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

export default function ReservationCalendrier() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [formateurMode, setFormateurMode] = useState(false);
  const [formateurEmail, setFormateurEmail] = useState('');
  const [formateurValid, setFormateurValid] = useState(null);

  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate.year, viewDate.month, formateurValid]);

  async function loadActivities() {
    setLoading(true);
    try {
      const startOfMonth = new Date(year, month, 1).toISOString().slice(0, 10);
      const endOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      let query = supabase
        .from('activities')
        .select('id, nom, date_debut, heure_debut, heure_fin, duree_minutes, lieu, activity_types(nom), formateurs(nom_complet, email)')
        .eq('actif', true)
        .gte('date_debut', startOfMonth)
        .lte('date_debut', endOfMonth);

      if (formateurMode && formateurValid?.id) {
        query = query.eq('formateur_id', formateurValid.id);
      }

      const { data } = await query.order('date_debut').order('heure_debut');
      setActivities(data || []);
    } catch (err) {
      console.error('loadActivities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  async function checkFormateurEmail() {
    const email = formateurEmail?.trim().toLowerCase();
    if (!email) {
      setFormateurValid(null);
      return;
    }
    const { data } = await supabase
      .from('formateurs')
      .select('id, nom_complet, email')
      .ilike('email', email)
      .eq('actif', true)
      .maybeSingle();
    setFormateurValid(data || null);
  }

  const byDate = {};
  activities.forEach((a) => {
    const key = a.date_debut ? String(a.date_debut).slice(0, 10) : null;
    if (key) {
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(a);
    }
  });

  const { year, month } = viewDate;
  const days = getDaysInMonth(year, month);
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function prevMonth() {
    setViewDate((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));
  }
  function nextMonth() {
    setViewDate((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <img src="/logo-salle-numerique.png" alt="Salle du Numérique" className="w-14 h-14 mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-bold text-slate-800">RÉSERVATION PAR CALENDRIER</h1>
          <p className="text-slate-500 text-sm mt-1">Salle du Numérique – UNILU</p>
          <a href="/formateur/login" className="inline-block mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Formateur / Enseignant ? Accéder à votre espace →
          </a>
        </div>

        {/* Mode formateur */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-6 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setFormateurMode(!formateurMode);
              if (!formateurMode) setFormateurValid(null);
            }}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors"
          >
            <User size={18} />
            {formateurMode ? 'Masquer le mode formateur' : 'Je suis formateur / enseignant'}
          </button>
          {formateurMode && (
            <div className="mt-4 flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-slate-500 mb-1">Votre email (formateur)</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formateurEmail}
                    onChange={(e) => setFormateurEmail(e.target.value)}
                    onBlur={checkFormateurEmail}
                    placeholder="votre@email.unilu.cd"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white focus:border-primary-500 outline-none text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={checkFormateurEmail}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Afficher mes activités
              </button>
              {formateurValid === null && formateurEmail.trim() && (
                <p className="text-amber-600 text-xs">Aucun formateur trouvé pour cet email.</p>
              )}
              {formateurValid && (
                <p className="text-emerald-600 text-xs flex items-center gap-1">
                  <User size={14} /> {formateurValid.nom_complet} – vos activités uniquement
                </p>
              )}
            </div>
          )}
        </div>

        {/* Calendrier */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="Mois précédent"
            >
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <CalendarIcon size={22} />
              {MOIS[month]} {year}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="Mois suivant"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-slate-100">
                {JOURS_SEMAINE.map((j) => (
                  <div key={j} className="py-2 text-center text-xs font-medium text-slate-500">
                    {j}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  if (d === null) return <div key={`pad-${i}`} className="min-h-[80px] bg-slate-50/30" />;
                  const key = formatDateKey(year, month, d);
                  const dayActivities = byDate[key] || [];
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] p-2 border-b border-r border-slate-100 last:border-r-0 ${
                        isToday ? 'bg-primary-50/50' : 'bg-white'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium ${
                          isToday ? 'bg-primary-600 text-white' : 'text-slate-700'
                        }`}
                      >
                        {d}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayActivities.slice(0, 3).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => navigate(`/reserve/${a.id}`)}
                            className="block w-full text-left px-2 py-1 rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-800 text-xs font-medium truncate transition-colors"
                            title={a.nom}
                          >
                            {a.nom}
                          </button>
                        ))}
                        {dayActivities.length > 3 && (
                          <span className="text-xs text-slate-400">+{dayActivities.length - 3}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Liste détaillée du mois */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Activités du mois</h3>
          {activities.length === 0 && !loading && (
            <p className="text-slate-500 text-sm py-4 text-center">Aucune activité programmée.</p>
          )}
          <div className="space-y-2">
            {activities.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/reserve/${a.id}`)}
                className="w-full text-left p-4 rounded-xl border border-slate-100 bg-white hover:border-primary-200 hover:bg-primary-50/30 transition-all shadow-sm"
              >
                <div className="flex flex-wrap gap-2 items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{a.nom}</p>
                    <p className="text-sm text-slate-500">{a.activity_types?.nom}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CalendarIcon size={14} />
                      {a.date_debut}
                    </span>
                    {a.heure_debut && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {activityScheduleLine(a)}
                      </span>
                    )}
                    {a.lieu && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {a.lieu}
                      </span>
                    )}
                  </div>
                </div>
                {a.formateurs?.nom_complet && (
                  <p className="text-xs text-slate-400 mt-2">Formateur : {a.formateurs.nom_complet}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Cliquez sur une activité pour réserver. Le secrétariat validera votre demande.
        </p>
      </div>
    </div>
  );
}
