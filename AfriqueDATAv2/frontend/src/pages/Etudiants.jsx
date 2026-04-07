import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, LayoutList, Network } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../components/ui/DataTable';

const PAGE_SIZE = 10;
/** Promotions sans department_id */
const ORPHAN_DEPT = '__orphan__';

export default function Etudiants() {
  const [students, setStudents] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [facultes, setFacultes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, item: null });
  const [form, setForm] = useState({
    faculty_id: '',
    department_id: '',
    promotion_id: '',
    matricule: '',
    nom_complet: '',
    telephone: '',
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [viewMode, setViewMode] = useState('liste'); // 'liste' | 'groupe'

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [stuRes, promRes, facRes, depRes] = await Promise.all([
      supabase
        .from('students')
        .select('*, promotions(nom, faculty_id, department_id, faculties(nom), departments(id, nom))')
        .order('nom_complet'),
      supabase.from('promotions').select('id, nom, faculty_id, department_id, faculties(nom), departments(id, nom)').order('nom'),
      supabase.from('faculties').select('id, nom').order('nom'),
      supabase.from('departments').select('id, nom, faculty_id').order('nom'),
    ]);
    setStudents(stuRes.data || []);
    setPromotions(promRes.data || []);
    setFacultes(facRes.data || []);
    setDepartments(depRes.data || []);
    setLoading(false);
    setSelected(new Set());
  }

  const hasOrphanPromotions = useMemo(() => {
    return (fid) => promotions.some((p) => p.faculty_id === fid && !p.department_id);
  }, [promotions]);

  const departmentOptionsForFaculty = useMemo(() => {
    const fid = form.faculty_id;
    if (!fid) return [];
    const depts = departments.filter((d) => d.faculty_id === fid);
    const out = depts.map((d) => ({ ...d, key: d.id }));
    if (hasOrphanPromotions(fid)) {
      out.push({ id: ORPHAN_DEPT, nom: 'Sans département', faculty_id: fid, key: ORPHAN_DEPT });
    }
    return out;
  }, [departments, form.faculty_id, hasOrphanPromotions]);

  const promotionsForForm = useMemo(() => {
    return promotions.filter((p) => {
      if (p.faculty_id !== form.faculty_id) return false;
      if (form.department_id === ORPHAN_DEPT) return !p.department_id;
      if (!form.department_id) return true;
      return p.department_id === form.department_id;
    });
  }, [promotions, form.faculty_id, form.department_id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        (s.nom_complet || '').toLowerCase().includes(q) ||
        (s.matricule || '').toLowerCase().includes(q) ||
        (s.promotions?.nom || '').toLowerCase().includes(q) ||
        (s.promotions?.faculties?.nom || '').toLowerCase().includes(q) ||
        (s.promotions?.departments?.nom || '').toLowerCase().includes(q) ||
        (s.telephone || '').includes(q)
    );
  }, [students, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const groupedStructure = useMemo(() => {
    const tree = {};
    for (const s of filtered) {
      const fac = s.promotions?.faculties?.nom || '—';
      const dep = s.promotions?.departments?.nom || 'Sans département';
      const pro = s.promotions?.nom || '—';
      if (!tree[fac]) tree[fac] = {};
      if (!tree[fac][dep]) tree[fac][dep] = {};
      if (!tree[fac][dep][pro]) tree[fac][dep][pro] = [];
      tree[fac][dep][pro].push(s);
    }
    return tree;
  }, [filtered]);

  function toggleAllPage() {
    const pageIds = paginated.map((s) => s.id);
    const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Supprimer ${selected.size} étudiant(s) ?`)) return;
    const ids = [...selected];
    const { error } = await supabase.from('students').delete().in('id', ids);
    if (error) toast.error(error.message);
    else {
      toast.success('Suppression effectuée');
      loadData();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const payload = {
        promotion_id: form.promotion_id,
        matricule: form.matricule,
        nom_complet: form.nom_complet,
        telephone: form.telephone || null,
        email: null,
        updated_at: new Date().toISOString(),
      };
      if (modal.item) {
        await supabase.from('students').update(payload).eq('id', modal.item.id);
        toast.success('Étudiant modifié');
      } else {
        await supabase.from('students').insert([payload]);
        toast.success('Étudiant ajouté');
      }
      setModal({ open: false, item: null });
      setForm({ faculty_id: '', department_id: '', promotion_id: '', matricule: '', nom_complet: '', telephone: '' });
      loadData();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer cet étudiant ?')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Étudiant supprimé');
      loadData();
    }
  }

  function pickDefaultDepartment(fid) {
    const depts = departments.filter((d) => d.faculty_id === fid);
    if (depts.length > 0) return depts[0].id;
    if (hasOrphanPromotions(fid)) return ORPHAN_DEPT;
    return '';
  }

  function pickDefaultPromotion(fid, deptId) {
    const list = promotions.filter((p) => {
      if (p.faculty_id !== fid) return false;
      if (deptId === ORPHAN_DEPT) return !p.department_id;
      if (!deptId) return true;
      return p.department_id === deptId;
    });
    return list[0]?.id || '';
  }

  function openEdit(s) {
    const fid = s.promotions?.faculty_id || '';
    const did = s.promotions?.department_id || ORPHAN_DEPT;
    setForm({
      faculty_id: fid,
      department_id: did,
      promotion_id: s.promotion_id,
      matricule: s.matricule,
      nom_complet: s.nom_complet,
      telephone: s.telephone || '',
    });
    setModal({ open: true, item: s });
  }

  function openAdd() {
    const fid = facultes[0]?.id || '';
    const did = fid ? pickDefaultDepartment(fid) : '';
    const pid = fid && did !== undefined ? pickDefaultPromotion(fid, did) : '';
    setForm({
      faculty_id: fid,
      department_id: did,
      promotion_id: pid,
      matricule: '',
      nom_complet: '',
      telephone: '',
    });
    setModal({ open: true, item: null });
  }

  const columns = useMemo(
    () => [
      {
        key: '_sel',
        label: (
          <input
            type="checkbox"
            checked={paginated.length > 0 && paginated.every((s) => selected.has(s.id))}
            onChange={toggleAllPage}
            aria-label="Sélectionner la page"
          />
        ),
        render: (s) => (
          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} aria-label={`Sélectionner ${s.nom_complet}`} />
        ),
      },
      { key: 'nom_complet', label: 'Nom complet', render: (s) => <span className="font-medium text-slate-800">{s.nom_complet}</span> },
      { key: 'faculty', label: 'Faculté', render: (s) => s.promotions?.faculties?.nom || '—' },
      { key: 'department', label: 'Département', render: (s) => s.promotions?.departments?.nom || '—' },
      { key: 'promotion', label: 'Promotion', render: (s) => s.promotions?.nom || '—' },
      { key: 'telephone', label: 'Téléphone', render: (s) => s.telephone || '—' },
      {
        key: 'actions',
        label: 'Actions',
        align: 'right',
        render: (s) => (
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => openEdit(s)}
              className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Modifier"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [paginated, selected]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Étudiants</h1>
          <p className="text-slate-500 text-sm mt-1">
            Liste globale : faculté, département et promotion sont distincts. Utilisez la vue « Par structure » pour des tableaux séparés par département et promotion.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <button type="button" onClick={handleBulkDelete} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700">
              Supprimer la sélection ({selected.size})
            </button>
          )}
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
            <button
              type="button"
              onClick={() => setViewMode('liste')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'liste' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'}`}
            >
              <LayoutList className="w-4 h-4" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode('groupe')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'groupe' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'}`}
            >
              <Network className="w-4 h-4" />
              Par structure
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'liste' ? (
        <DataTable
          columns={columns}
          data={paginated}
          searchPlaceholder="Rechercher par nom, matricule, faculté, département, promotion ou téléphone..."
          searchValue={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          emptyMessage="Aucun étudiant."
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer la vue groupée..."
              className="input-field w-full pl-10"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {Object.keys(groupedStructure).length === 0 ? (
            <p className="text-slate-400 text-sm py-8 text-center">Aucun étudiant ne correspond au filtre.</p>
          ) : (
            Object.entries(groupedStructure).map(([facName, byDept]) => (
              <div key={facName} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-800">{facName}</h2>
                </div>
                <div className="p-4 space-y-6">
                  {Object.entries(byDept).map(([depName, byPromo]) => (
                    <div key={`${facName}-${depName}`} className="rounded-xl border border-slate-100 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-sm font-semibold text-slate-700">{depName}</h3>
                      </div>
                      <div className="p-3 space-y-4">
                        {Object.entries(byPromo).map(([promoName, list]) => (
                          <div key={promoName}>
                            <p className="text-xs font-medium text-slate-500 mb-2">
                              Promotion : {promoName} <span className="text-slate-400">({list.length})</span>
                            </p>
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-left text-slate-600">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">Nom complet</th>
                                    <th className="px-3 py-2 font-medium">Matricule</th>
                                    <th className="px-3 py-2 font-medium">Téléphone</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {list.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-50/50">
                                      <td className="px-3 py-2 font-medium text-slate-800">{s.nom_complet}</td>
                                      <td className="px-3 py-2 text-slate-600">{s.matricule}</td>
                                      <td className="px-3 py-2 text-slate-600">{s.telephone || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <button
        onClick={openAdd}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 hover:shadow-xl transition-all flex items-center justify-center z-40"
        title="Ajouter un étudiant"
      >
        <Plus className="w-6 h-6" />
      </button>

      {modal.open && (
        <div className="modal-overlay" onClick={() => setModal({ open: false, item: null })}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{modal.item ? "Modifier l'étudiant" : 'Nouvel étudiant'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nom complet</label>
                <input
                  type="text"
                  value={form.nom_complet}
                  onChange={(e) => setForm({ ...form, nom_complet: e.target.value })}
                  required
                  className="input-field"
                  placeholder="Prénom Nom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Matricule</label>
                <input
                  type="text"
                  value={form.matricule}
                  onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                  required
                  className="input-field"
                  placeholder="ex: UNI12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Faculté</label>
                <select
                  value={form.faculty_id}
                  onChange={(e) => {
                    const fid = e.target.value;
                    const did = pickDefaultDepartment(fid);
                    const pid = pickDefaultPromotion(fid, did);
                    setForm({ ...form, faculty_id: fid, department_id: did, promotion_id: pid });
                  }}
                  required
                  className="input-field"
                >
                  <option value="">-- Sélectionner --</option>
                  {facultes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Département</label>
                <select
                  value={form.department_id}
                  onChange={(e) => {
                    const did = e.target.value;
                    const pid = pickDefaultPromotion(form.faculty_id, did);
                    setForm({ ...form, department_id: did, promotion_id: pid });
                  }}
                  required
                  className="input-field"
                  disabled={!form.faculty_id}
                >
                  <option value="">-- Sélectionner --</option>
                  {departmentOptionsForFaculty.map((d) => (
                    <option key={d.key} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Promotion</label>
                <select
                  value={form.promotion_id}
                  onChange={(e) => setForm({ ...form, promotion_id: e.target.value })}
                  required
                  className="input-field"
                >
                  <option value="">-- Sélectionner --</option>
                  {promotionsForForm.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="input-field"
                  placeholder="+243 XXX XXX XXX"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setModal({ open: false, item: null })} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  {modal.item ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
