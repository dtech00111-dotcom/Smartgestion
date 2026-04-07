import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Wallet, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { CAISSE_CATEGORIES, MODULE_NAMES, labelCaisseCategorie, labelModuleName } from '../lib/billingLabels';

export default function Facturation() {
  const { adminProfile } = useAuth();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jourFilter, setJourFilter] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({
    sens: 'encaissement',
    categorie: 'abonnement',
    module_name: '',
    montant_fc: '',
    montant_usd: '',
    libelle: '',
    nom_complet: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cash_ledger')
      .select('*')
      .eq('jour', jourFilter)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01' || error.message?.includes('cash_ledger')) {
        toast.error('Table caisse absente : exécutez la migration SQL 024 sur Supabase.');
        setLines([]);
        setLoading(false);
        return;
      }
      toast.error(error.message);
    }
    setLines(data || []);
    setLoading(false);
  }, [jourFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let encFc = 0;
    let encUsd = 0;
    let decFc = 0;
    let decUsd = 0;
    (lines || []).forEach((l) => {
      if (l.sens === 'encaissement') {
        encFc += Number(l.montant_fc) || 0;
        encUsd += Number(l.montant_usd) || 0;
      } else {
        decFc += Number(l.montant_fc) || 0;
        decUsd += Number(l.montant_usd) || 0;
      }
    });
    return {
      encFc,
      encUsd,
      decFc,
      decUsd,
      soldeFc: encFc - decFc,
      soldeUsd: encUsd - decUsd,
    };
  }, [lines]);

  async function handleAdd(e) {
    e.preventDefault();
    const fc = parseFloat(String(form.montant_fc).replace(',', '.')) || 0;
    const usd = parseFloat(String(form.montant_usd).replace(',', '.')) || 0;
    if (fc <= 0 && usd <= 0) {
      toast.error('Saisissez au moins un montant FC ou USD');
      return;
    }
    try {
      const payload = {
        jour: jourFilter,
        sens: form.sens,
        categorie: form.categorie,
        module_name: form.categorie === 'module' && form.module_name ? form.module_name : null,
        montant_fc: fc,
        montant_usd: usd,
        libelle: form.libelle || null,
        nom_complet: form.nom_complet || null,
        notes: form.notes || null,
        created_by: adminProfile?.id || null,
      };
      const { error } = await supabase.from('cash_ledger').insert([payload]);
      if (error) throw error;
      toast.success(form.sens === 'decaissement' ? 'Décaissement enregistré' : 'Encaissement enregistré');
      setForm({
        sens: 'encaissement',
        categorie: 'abonnement',
        module_name: '',
        montant_fc: '',
        montant_usd: '',
        libelle: '',
        nom_complet: '',
        notes: '',
      });
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cette ligne ?')) return;
    const { error } = await supabase.from('cash_ledger').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Ligne supprimée');
      load();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Facturation & caisse</h1>
        <p className="text-slate-500 text-sm mt-1">
          Encaissements ventilés (abonnement, formation, modules, location, etc.) et décaissements — totaux journaliers FC / USD
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
          <input
            type="date"
            value={jourFilter}
            onChange={(e) => setJourFilter(e.target.value)}
            className="input-field w-auto"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-800 text-sm font-medium">
            <TrendingUp size={18} /> Encaissements FC
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{totals.encFc.toLocaleString()} FC</p>
        </div>
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-800 text-sm font-medium">
            <TrendingUp size={18} /> Encaissements USD
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{totals.encUsd.toLocaleString()} USD</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-rose-800 text-sm font-medium">
            <TrendingDown size={18} /> Décaissements FC
          </div>
          <p className="text-2xl font-bold text-rose-900 mt-1">{totals.decFc.toLocaleString()} FC</p>
        </div>
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
            <Wallet size={18} /> Solde du jour
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {totals.soldeFc.toLocaleString()} FC
          </p>
          <p className="text-sm text-slate-600">{totals.soldeUsd.toLocaleString()} USD (net)</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" /> Nouvelle écriture
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sens</label>
            <select
              value={form.sens}
              onChange={(e) => setForm({ ...form, sens: e.target.value })}
              className="input-field"
            >
              <option value="encaissement">Encaissement</option>
              <option value="decaissement">Décaissement (retranche sur les entrées)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Catégorie</label>
            <select
              value={form.categorie}
              onChange={(e) => setForm({ ...form, categorie: e.target.value })}
              className="input-field"
            >
              {CAISSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          {form.categorie === 'module' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Module</label>
              <select
                value={form.module_name}
                onChange={(e) => setForm({ ...form, module_name: e.target.value })}
                className="input-field"
              >
                <option value="">—</option>
                {MODULE_NAMES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant FC</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.montant_fc}
              onChange={(e) => setForm({ ...form, montant_fc: e.target.value })}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant USD</label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={form.montant_usd}
              onChange={(e) => setForm({ ...form, montant_usd: e.target.value })}
              className="input-field"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom (payeur / bénéficiaire)</label>
            <input
              type="text"
              value={form.nom_complet}
              onChange={(e) => setForm({ ...form, nom_complet: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Libellé</label>
            <input
              type="text"
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              className="input-field"
              placeholder="Détail facture, référence…"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 font-semibold text-slate-800">
          Journal du {new Date(jourFilter + 'T12:00:00').toLocaleDateString('fr-FR')}
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <th className="px-4 py-3">Heure</th>
                  <th className="px-4 py-3">Sens</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">FC</th>
                  <th className="px-4 py-3">USD</th>
                  <th className="px-4 py-3">Libellé</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {l.created_at ? new Date(l.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg ${l.sens === 'encaissement' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {l.sens === 'encaissement' ? 'Enc.' : 'Déc.'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{labelCaisseCategorie(l.categorie)}</td>
                    <td className="px-4 py-3 text-sm">{l.module_name ? labelModuleName(l.module_name) : '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium">{l.nom_complet || '—'}</td>
                    <td className="px-4 py-3 text-sm">{Number(l.montant_fc).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{Number(l.montant_usd).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={l.libelle}>{l.libelle || '—'}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => handleDelete(l.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length === 0 && (
              <p className="text-center py-12 text-slate-400 text-sm">Aucune écriture ce jour. Les encaissements sont ventilés par catégorie.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
