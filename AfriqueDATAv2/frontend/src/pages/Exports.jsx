import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { exportActivityToExcel, exportActivityToPDF, exportActivityToExcelCotation, exportActivityToPDFCotation } from '../lib/exports';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { activityScheduleLine } from '../lib/activityTime';

export default function Exports() {
  const { adminProfile } = useAuth();
  const [activities, setActivities] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [participations, setParticipations] = useState([]);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('activities')
      .select('id, nom, date_debut, heure_debut, heure_fin, duree_minutes, activity_types(nom)')
      .order('date_debut', { ascending: false })
      .then(({ data }) => {
        setActivities(data || []);
        if (data?.length && !selectedId) setSelectedId(data[0].id);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setActivity(null);
      setParticipations([]);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from('activities').select('*, activity_types(nom)').eq('id', selectedId).single(),
      supabase.from('participations').select('*, faculties(nom), promotions(nom)').eq('activity_id', selectedId).order('created_at'),
    ]).then(([actRes, partRes]) => {
      setActivity(actRes.data);
      setParticipations(partRes.data || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const total = participations.reduce((s, p) => s + Number(p.montant), 0);
  const dateGen = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  async function handleExportPDF() {
    if (!activity) return;
    try {
      await exportActivityToPDF(activity, participations, adminProfile?.nom_complet || 'Secrétaire');
      toast.success('Rapport secrétaire PDF téléchargé');
    } catch (err) {
      toast.error(err?.message || 'Erreur export PDF');
    }
  }

  function handleExportExcel() {
    if (!activity) return;
    try {
      exportActivityToExcel(activity, participations);
      toast.success('Rapport secrétaire Excel téléchargé');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleExportPDFCotation() {
    if (!activity) return;
    try {
      await exportActivityToPDFCotation(activity, participations, adminProfile?.nom_complet || 'Secrétaire');
      toast.success('Liste cotation PDF téléchargée');
    } catch (err) {
      toast.error(err?.message || 'Erreur export PDF');
    }
  }

  function handleExportExcelCotation() {
    if (!activity) return;
    try {
      exportActivityToExcelCotation(activity, participations);
      toast.success('Liste cotation Excel téléchargée');
    } catch (err) {
      toast.error(err.message);
    }
  }


  if (loading && !activity) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Exports</h1>
          <p className="text-slate-500 text-sm mt-1">
            Prévisualisez et exportez les listes de participants en Excel ou PDF
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input-field sm:max-w-xs"
          >
            <option value="">-- Sélectionner une activité --</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom} • {a.date_debut}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 print:hidden">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500">Rapport secrétaire :</span>
              <button onClick={handleExportPDF} disabled={!activity} className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={handleExportExcel} disabled={!activity} className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500">Liste cotation :</span>
              <button onClick={handleExportPDFCotation} disabled={!activity} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={handleExportExcelCotation} disabled={!activity} className="flex items-center gap-2 px-3 py-2 bg-emerald-700 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {!selectedId ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-slate-400">Sélectionnez une activité pour prévisualiser l'export.</p>
        </div>
      ) : (
        <div
          id="export-preview"
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none"
        >
          {/* Printable document layout */}
          <div className="p-8 print:p-6">
            {/* Header */}
            <div className="text-center border-b border-slate-200 pb-6 mb-6">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">SMART GESTION</h1>
              <p className="text-slate-600 text-sm mt-1">Salle du Numérique – UNILU</p>
              <div className="mt-4 h-px bg-slate-200 max-w-xs mx-auto" />
            </div>

            {/* Activity info */}
            {activity && (
              <div className="mb-6 space-y-1 text-sm text-slate-700">
                <p><span className="font-medium text-slate-500">Activité :</span> {activity.nom}</p>
                <p><span className="font-medium text-slate-500">Type :</span> {activity.activity_types?.nom || '-'}</p>
                <p><span className="font-medium text-slate-500">Date :</span> {activity.date_debut} • {activityScheduleLine(activity)}</p>
              </div>
            )}

            {/* Participants table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">N°</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Nom</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Faculté</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Promotion</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {participations.length > 0 ? (
                    participations.map((p, i) => (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-600">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{p.nom_complet}</td>
                        <td className="px-4 py-3 text-slate-600">{p.faculties?.nom || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{p.promotions?.nom || '-'}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{Number(p.montant).toLocaleString()} FC</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        Aucun participant
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="mt-6 flex justify-end">
              <div className="text-right">
                <p className="text-slate-500 text-sm">Total encaissé</p>
                <p className="text-xl font-bold text-primary-600">{total.toLocaleString()} FC</p>
              </div>
            </div>

            {/* Signature & Date */}
            <div className="mt-12 pt-6 border-t border-slate-200 grid sm:grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-2">Signature secrétaire</p>
                <div className="h-12 border-b-2 border-slate-300" />
                <p className="text-xs text-slate-400 mt-1">{adminProfile?.nom_complet || 'Secrétaire'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-2">Date de génération</p>
                <p className="text-slate-800 font-medium">{dateGen}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
