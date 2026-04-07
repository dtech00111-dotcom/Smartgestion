import { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Visiteurs() {
  const [visiteurs, setVisiteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, item: null });
  const [form, setForm] = useState({ nom_complet: '', email: '', telephone: '', institution: '', categorie: '' });
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    loadVisiteurs();
  }, []);

  async function loadVisiteurs() {
    const { data, error } = await supabase.from('visitors').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error(error.message);
      setVisiteurs([]);
    } else {
      setVisiteurs(data || []);
    }
    setLoading(false);
    setSelected(new Set());
  }

  function toggleAll() {
    if (selected.size === visiteurs.length) setSelected(new Set());
    else setSelected(new Set(visiteurs.map((v) => v.id)));
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Supprimer ${selected.size} visiteur(s) sélectionné(s) ?`)) return;
    const ids = [...selected];
    const { error } = await supabase.from('visitors').delete().in('id', ids);
    if (error) toast.error(error.message);
    else {
      toast.success('Suppression effectuée');
      loadVisiteurs();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (modal.item) {
        await supabase.from('visitors').update({
          ...form,
          updated_at: new Date().toISOString(),
        }).eq('id', modal.item.id);
        toast.success('Visiteur modifié');
      } else {
        await supabase.from('visitors').insert([form]);
        toast.success('Visiteur ajouté');
      }
      setModal({ open: false, item: null });
      setForm({ nom_complet: '', email: '', telephone: '', institution: '', categorie: '' });
      loadVisiteurs();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer ce visiteur ?')) return;
    const { error } = await supabase.from('visitors').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Visiteur supprimé');
      loadVisiteurs();
    }
  }

  function exportXlsx() {
    const rows = visiteurs.map((v) => ({
      'Nom complet': v.nom_complet,
      Date: v.created_at ? new Date(v.created_at).toLocaleString('fr-FR') : '',
      Catégorie: v.categorie || '',
      Email: v.email || '',
      Téléphone: v.telephone || '',
      Institution: v.institution || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: 'Aucune fiche' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visiteurs');
    XLSX.writeFile(wb, `visiteurs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Export Excel prêt');
  }

  const countLabel = useMemo(() => visiteurs.length, [visiteurs]);

  if (loading) {
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
          <h1 className="text-2xl font-bold text-slate-800">Visiteurs</h1>
          <p className="text-slate-500 text-sm mt-1">
            <span className="font-semibold text-slate-700">{countLabel}</span> fiche{countLabel > 1 ? 's' : ''} — nom complet, date, email, téléphone, institution, catégorie (visible aussi sur le tableau de bord)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <button type="button" onClick={handleBulkDelete} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700">
              Supprimer la sélection ({selected.size})
            </button>
          )}
          <button type="button" onClick={exportXlsx} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium">
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => {
              setForm({ nom_complet: '', email: '', telephone: '', institution: '', categorie: '' });
              setModal({ open: true, item: null });
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      <div className="card-table overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/80 text-left text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={visiteurs.length > 0 && selected.size === visiteurs.length} onChange={toggleAll} aria-label="Tout sélectionner" />
                </th>
                <th className="px-4 py-3 font-medium">Nom complet</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 w-28 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visiteurs.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggleOne(v.id)} aria-label={`Sélectionner ${v.nom_complet}`} />
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800">{v.nom_complet}</td>
                  <td className="px-4 py-4 text-slate-600 text-sm">{v.created_at ? new Date(v.created_at).toLocaleString('fr-FR') : '—'}</td>
                  <td className="px-4 py-4 text-slate-600 text-sm">{v.categorie || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{v.email || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{v.telephone || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{v.institution || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setForm({ nom_complet: v.nom_complet, email: v.email || '', telephone: v.telephone || '', institution: v.institution || '', categorie: v.categorie || '' }); setModal({ open: true, item: v }); }} className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Modifier"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(v.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visiteurs.length === 0 && (
          <p className="text-center py-12 text-slate-400 text-sm">Aucun visiteur. Utilisez « Ajouter » pour enregistrer des noms.</p>
        )}
      </div>

      {modal.open && (
        <div className="modal-overlay" onClick={() => setModal({ open: false, item: null })}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{modal.item ? 'Modifier le visiteur' : 'Nouveau visiteur'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Nom complet</label><input type="text" value={form.nom_complet} onChange={(e) => setForm({ ...form, nom_complet: e.target.value })} required className="input-field" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Catégorie</label><input type="text" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} className="input-field" placeholder="ex: Chercheur, Partenaire, Grand public…" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Téléphone</label><input type="tel" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="input-field" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-2">Institution</label><input type="text" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} placeholder="Université, entreprise..." className="input-field" /></div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setModal({ open: false })} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
