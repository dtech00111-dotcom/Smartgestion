import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Coins, CheckCircle, Clock, ChevronRight, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { ENCAISSEMENT_PARTICIPATION_OPTIONS, labelParticipationEncaissement } from '../lib/billingLabels';

export default function Paiements() {
  const { adminProfile } = useAuth();
  const [participations, setParticipations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [validatingId, setValidatingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    loadPaiements();
  }, []);

  async function loadPaiements() {
    const { data, error } = await supabase
      .from('participations')
      .select(`
        id,
        nom_complet,
        type_participant,
        montant,
        statut_paiement,
        created_at,
        activity_id,
        module_formation,
        date_debut_formation,
        encaissement_type,
        activities(id, nom, date_debut),
        faculties(nom),
        promotions(nom)
      `)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn(error);
      toast.error('Certaines colonnes peuvent manquer : exécutez la migration 024 sur Supabase.');
    }
    const rows = data || [];
    setParticipations(rows);
    setTotal(rows.reduce((s, p) => s + Number(p.montant), 0));
    setLoading(false);
  }

  async function handleApprove(participationId) {
    setValidatingId(participationId);
    try {
      const { error } = await supabase
        .from('participations')
        .update({
          statut_paiement: 'valide',
          validated_at: new Date().toISOString(),
          validated_by: adminProfile?.id || null,
        })
        .eq('id', participationId);
      if (error) throw error;
      toast.success('Inscription approuvée');
      loadPaiements();
    } catch (err) {
      toast.error(err?.message || 'Erreur');
    } finally {
      setValidatingId(null);
    }
  }

  async function updateEncaissementType(id, encaissement_type) {
    setUpdatingId(id);
    try {
      const { error } = await supabase.from('participations').update({ encaissement_type }).eq('id', id);
      if (error) throw error;
      toast.success('Catégorie mise à jour');
      loadPaiements();
    } catch (err) {
      toast.error(err?.message || 'Erreur');
    } finally {
      setUpdatingId(null);
    }
  }

  const totauxParType = useMemo(() => {
    const m = {};
    participations.forEach((p) => {
      const k = p.encaissement_type || 'inscription_activite';
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [participations]);

  function exportVisiteursXlsx() {
    const vis = participations.filter((p) => p.type_participant === 'visiteur');
    const rows = vis.map((p) => ({
      'Nom complet': p.nom_complet,
      Date: p.created_at ? new Date(p.created_at).toLocaleString('fr-FR') : '',
      Catégorie: labelParticipationEncaissement(p.encaissement_type),
      'Module à apprendre': p.module_formation || '',
      'Début formation': p.date_debut_formation || '',
      Activité: p.activities?.nom || '',
      Montant_FC: Number(p.montant),
      Statut: p.statut_paiement,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: 'Aucun visiteur inscrit' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visiteurs');
    XLSX.writeFile(wb, `participants_visiteurs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Export généré');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const enAttente = participations.filter((p) => p.statut_paiement === 'en_attente');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paiements & facturation (inscriptions)</h1>
          <p className="text-slate-500 text-sm mt-1">
            Inscription formation : nom, module, début — paiements modules (Word, Excel…) — ventiler par type pour le total activité
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportVisiteursXlsx}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={18} />
            Excel visiteurs
          </button>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary-600" />
            <span className="text-sm text-slate-600">Total inscriptions :</span>
            <span className="font-bold text-slate-800">{total.toLocaleString()} FC</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Total activité (nombre d’inscriptions par type)</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(totauxParType).length === 0 ? (
            <span className="text-slate-500 text-sm">Aucune donnée</span>
          ) : (
            Object.entries(totauxParType).map(([k, n]) => (
              <span key={k} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border text-sm">
                <span className="font-medium text-slate-800">{labelParticipationEncaissement(k)}</span>
                <span className="text-primary-600 font-bold">{n}</span>
              </span>
            ))
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2 mb-0">
          Les encaissements détaillés (abonnement, location salle, etc.) sont saisis dans <Link to="/admin/facturation" className="text-primary-600">Facturation & caisse</Link>.
        </p>
      </div>

      {enAttente.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-amber-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-amber-800">
              {enAttente.length} inscription{enAttente.length > 1 ? 's' : ''} en attente d&apos;approbation
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-amber-100/50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase">Activité</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase">Montant</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-amber-800 uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-amber-800 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200">
                {enAttente.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{p.nom_complet}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${p.type_participant === 'etudiant' ? 'bg-primary-50 text-primary-700' : 'bg-purple-50 text-purple-700'}`}>
                        {p.type_participant === 'etudiant' ? 'Étudiant' : 'Visiteur'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <Link to={p.activity_id ? `/admin/activites/${p.activity_id}` : '#'} className="text-primary-600 hover:underline inline-flex items-center gap-1">
                        {p.activities?.nom || '-'}
                        {p.activity_id && <ChevronRight size={14} />}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{Number(p.montant).toLocaleString()} FC</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={validatingId === p.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
                      >
                        <CheckCircle size={16} />
                        {validatingId === p.id ? '…' : 'Approuver'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-2">
          <Coins className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-800">Toutes les inscriptions (détail facturation)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Encaissement</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Module / formation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Début form.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Activité</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Faculté</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Montant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participations.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4 text-sm font-medium text-slate-800">{p.nom_complet}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${p.type_participant === 'etudiant' ? 'bg-primary-50 text-primary-700' : 'bg-purple-50 text-purple-700'}`}>
                      {p.type_participant === 'etudiant' ? 'Étudiant' : 'Visiteur'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm min-w-[200px]">
                    <select
                      value={p.encaissement_type || 'inscription_activite'}
                      disabled={updatingId === p.id}
                      onChange={(e) => updateEncaissementType(p.id, e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                    >
                      {ENCAISSEMENT_PARTICIPATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 max-w-[140px]">{p.module_formation || '—'}</td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {p.date_debut_formation ? new Date(p.date_debut_formation).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">
                    {p.activity_id ? (
                      <Link to={`/admin/activites/${p.activity_id}`} className="text-primary-600 hover:underline inline-flex items-center gap-1">
                        {p.activities?.nom || '-'}
                        <ChevronRight size={14} />
                      </Link>
                    ) : (
                      p.activities?.nom || '-'
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600">{p.faculties?.nom || '-'}</td>
                  <td className="px-4 py-4 text-sm font-medium text-slate-700">{Number(p.montant).toLocaleString()} FC</td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      p.statut_paiement === 'valide' ? 'bg-green-50 text-green-700' :
                      p.statut_paiement === 'paye' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {p.statut_paiement === 'valide' ? 'Approuvée' : p.statut_paiement === 'paye' ? 'Payée' : 'En attente'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-500">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {participations.length === 0 && (
          <p className="text-center py-12 text-slate-400 text-sm">Aucune inscription.</p>
        )}
      </div>
    </div>
  );
}
