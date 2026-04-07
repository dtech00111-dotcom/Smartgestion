import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Pencil, Trash2, Upload, ChevronDown, ChevronRight, Download, FlaskConical } from 'lucide-react';
import { importFromExcel, importFromPDF, downloadTemplate } from '../lib/importStudents';
import toast from 'react-hot-toast';

export default function FaculteDetail() {
  const { id } = useParams();
  const [faculty, setFaculty] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [promotionsByDept, setPromotionsByDept] = useState({});
  const [studentsByPromo, setStudentsByPromo] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedDept, setExpandedDept] = useState({});
  const [expandedPromo, setExpandedPromo] = useState({});
  const [modalDept, setModalDept] = useState({ open: false, item: null, facultyId: id });
  const [modalPromo, setModalPromo] = useState({ open: false, item: null, departmentId: '' });
  const [formDept, setFormDept] = useState({ nom: '', code: '' });
  const [formPromo, setFormPromo] = useState({ nom: '', annee: '' });
  const [importing, setImporting] = useState(null);
  const [pratiques, setPratiques] = useState([]);
  const [expandedPratiques, setExpandedPratiques] = useState(true);
  /** Sélection par promotion : { [promotionId]: string[] } */
  const [studentSelection, setStudentSelection] = useState({});
  const [studentModal, setStudentModal] = useState({ open: false, promotionId: '' });
  const [studentForm, setStudentForm] = useState({ matricule: '', nom_complet: '', telephone: '' });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    let deptData = [];
    try {
      const { data, error } = await supabase.from('departments').select('*').eq('faculty_id', id).order('nom');
      deptData = error ? [] : (data || []);
    } catch {
      deptData = [];
    }
    const pratResPromise = (async () => {
      try {
        const { data, error } = await supabase.from('activities').select('*, activity_types(nom), formateurs(nom_complet)').eq('faculty_id', id).order('date_debut', { ascending: false });
        return error ? [] : (data || []);
      } catch {
        return [];
      }
    })();
    const [facRes, promRes, pratRes] = await Promise.all([
      supabase.from('faculties').select('*').eq('id', id).single(),
      supabase.from('promotions').select('*, departments(nom)').eq('faculty_id', id).order('nom'),
      pratResPromise,
    ]);
    setFaculty(facRes.data);
    setDepartments(deptData);
    setPratiques(Array.isArray(pratRes) ? pratRes : []);

    const byDept = {};
    (promRes.data || []).forEach((p) => {
      const did = p.department_id || 'none';
      if (!byDept[did]) byDept[did] = [];
      byDept[did].push(p);
    });
    setPromotionsByDept(byDept);
    setLoading(false);
  }

  async function loadStudents(promoId) {
    const { data } = await supabase.from('students').select('*').eq('promotion_id', promoId).order('nom_complet');
    setStudentsByPromo((s) => ({ ...s, [promoId]: data || [] }));
    setStudentSelection((sel) => ({ ...sel, [promoId]: [] }));
  }

  function toggleStudentSelect(promoId, studentId) {
    setStudentSelection((prev) => {
      const cur = new Set(prev[promoId] || []);
      if (cur.has(studentId)) cur.delete(studentId);
      else cur.add(studentId);
      return { ...prev, [promoId]: [...cur] };
    });
  }

  function toggleAllStudentsOnPromo(promoId, students) {
    const ids = students.map((s) => s.id);
    setStudentSelection((prev) => {
      const cur = new Set(prev[promoId] || []);
      const all = ids.length > 0 && ids.every((id) => cur.has(id));
      const next = new Set(cur);
      if (all) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return { ...prev, [promoId]: [...next] };
    });
  }

  async function bulkDeleteStudents(promoId) {
    const ids = studentSelection[promoId] || [];
    if (ids.length === 0) return;
    if (!window.confirm(`Supprimer ${ids.length} étudiant(s) de cette promotion ?`)) return;
    const { error } = await supabase.from('students').delete().in('id', ids);
    if (error) toast.error(error.message);
    else {
      toast.success('Étudiants supprimés');
      loadStudents(promoId);
    }
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    const promotionId = studentModal.promotionId;
    if (!promotionId) return;
    try {
      const { error } = await supabase.from('students').insert([
        {
          promotion_id: promotionId,
          matricule: studentForm.matricule.trim(),
          nom_complet: studentForm.nom_complet.trim(),
          telephone: studentForm.telephone.trim() || null,
        },
      ]);
      if (error) throw error;
      toast.success('Étudiant ajouté');
      setStudentModal({ open: false, promotionId: '' });
      setStudentForm({ matricule: '', nom_complet: '', telephone: '' });
      loadStudents(promotionId);
    } catch (err) {
      toast.error(err?.message || 'Erreur');
    }
  }

  async function deleteOneStudent(promoId, studentId) {
    if (!window.confirm('Supprimer cet étudiant ?')) return;
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) toast.error(error.message);
    else {
      toast.success('Étudiant supprimé');
      loadStudents(promoId);
    }
  }

  function toggleDept(deptId) {
    setExpandedDept((e) => ({ ...e, [deptId]: !e[deptId] }));
  }

  function togglePromo(promoId) {
    const next = !expandedPromo[promoId];
    setExpandedPromo((e) => ({ ...e, [promoId]: next }));
    if (next) loadStudents(promoId);
  }

  async function handleSubmitDept(e) {
    e.preventDefault();
    try {
      const payload = { faculty_id: id, nom: formDept.nom, code: formDept.code || null };
      if (modalDept.item) {
        await supabase.from('departments').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modalDept.item.id);
        toast.success('Département modifié');
      } else {
        await supabase.from('departments').insert([payload]);
        toast.success('Département ajouté');
      }
      setModalDept({ open: false, item: null });
      setFormDept({ nom: '', code: '' });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleSubmitPromo(e) {
    e.preventDefault();
    const nom = (formPromo.nom || '').trim();
    if (!nom) {
      toast.error('Le nom de la promotion est requis');
      return;
    }
    const anneeVal = formPromo.annee ? String(formPromo.annee).trim() : '';
    const annee = anneeVal ? (parseInt(anneeVal, 10) || null) : null;
    const deptId = (modalPromo.departmentId || '').trim() || null;
    try {
      const payload = {
        faculty_id: id,
        nom,
        ...(annee != null && { annee }),
        ...(deptId && { department_id: deptId }),
      };
      if (modalPromo.item) {
        const updatePayload = { nom, faculty_id: id, updated_at: new Date().toISOString() };
        if (annee != null) updatePayload.annee = annee;
        updatePayload.department_id = deptId;
        const { error } = await supabase.from('promotions').update(updatePayload).eq('id', modalPromo.item.id);
        if (error) throw error;
        toast.success('Promotion modifiée');
      } else {
        const { error } = await supabase.from('promotions').insert([payload]);
        if (error) {
          if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
            throw new Error('Une promotion avec ce nom existe déjà dans ce département.');
          }
          if (error.code === '23503' || error.message?.includes('foreign key')) {
            throw new Error('Département invalide. Vérifiez que le département existe.');
          }
          throw error;
        }
        toast.success('Promotion ajoutée');
      }
      setModalPromo({ open: false, item: null, departmentId: '' });
      setFormPromo({ nom: '', annee: '' });
      loadData();
    } catch (err) {
      toast.error(err?.message || 'Erreur lors de l\'enregistrement');
    }
  }

  async function handleImport(e, promotionId) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(promotionId);
    try {
      let toInsert = [];
      const ext = (file.name || '').toLowerCase();
      if (ext.endsWith('.pdf')) {
        toInsert = await importFromPDF(file);
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
        const parsed = await importFromExcel(file);
        if (parsed === null) {
          toast.error('Colonnes requises: Matricule (ou N°, Code) et Nom complet. Vérifiez les en-têtes de la 1ère ligne. Téléchargez le modèle si besoin.');
          return;
        }
        toInsert = parsed;
      } else {
        toast.error('Format non supporté. Utilisez Excel (.xlsx, .csv) ou PDF.');
        return;
      }
      if (toInsert.length === 0) {
        toast.error('Aucune ligne valide trouvée. Excel: colonnes Matricule, Nom. PDF: tableau matricule + nom.');
        return;
      }
      const rows = toInsert.map((r) => ({ promotion_id: promotionId, ...r }));
      const { error } = await supabase.from('students').upsert(rows, {
        onConflict: 'promotion_id,matricule',
      });
      if (error) throw error;
      toast.success(`${rows.length} étudiant(s) importé(s)`);
      loadStudents(promotionId);
    } catch (err) {
      toast.error(err.message || 'Erreur import');
    } finally {
      setImporting(null);
      e.target.value = '';
    }
  }

  async function handleDeleteDept(deptId) {
    if (!window.confirm('Supprimer ce département ?')) return;
    const { error } = await supabase.from('departments').delete().eq('id', deptId);
    if (error) toast.error(error.message);
    else {
      toast.success('Département supprimé');
      loadData();
    }
  }

  async function handleDeletePromo(promoId) {
    if (!window.confirm('Supprimer cette promotion ?')) return;
    const { error } = await supabase.from('promotions').delete().eq('id', promoId);
    if (error) toast.error(error.message);
    else {
      toast.success('Promotion supprimée');
      loadData();
    }
  }

  if (loading || !faculty) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/admin/facultes" className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" /> Retour aux facultés
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{faculty.nom}</h1>
          <p className="text-slate-500 text-sm">{faculty.code || ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Télécharger modèle Excel
          </button>
          <button
            onClick={() => {
              setFormDept({ nom: '', code: '' });
              setModalDept({ open: true, item: null, facultyId: id });
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Ajouter un département
          </button>
        </div>
      </div>

      {/* Départements */}
      <div className="space-y-4">
        {departments.length === 0 && (
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-8 text-center">
            <p className="text-slate-500 mb-4">Aucun département. Créez-en un pour organiser les promotions, ou ajoutez une promotion directement.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => { setFormDept({ nom: 'Principal', code: 'PRIN' }); setModalDept({ open: true, item: null, facultyId: id }); }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" /> Créer le premier département
              </button>
              <button
                onClick={() => { setFormPromo({ nom: '', annee: new Date().getFullYear() }); setModalPromo({ open: true, item: null, departmentId: '' }); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Ajouter une promotion
              </button>
            </div>
          </div>
        )}
        {departments.map((dept) => {
          const promos = promotionsByDept[dept.id] || [];
          const isExpanded = expandedDept[dept.id] !== false;
          return (
            <div key={dept.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50/50"
                onClick={() => toggleDept(dept.id)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                  <h2 className="font-semibold text-slate-800">{dept.nom}</h2>
                  <span className="text-slate-400 text-sm">({promos.length} promotion{promos.length !== 1 ? 's' : ''})</span>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setFormDept({ nom: dept.nom, code: dept.code || '' }); setModalDept({ open: true, item: dept }); }} className="p-2 text-slate-500 hover:text-primary-600 rounded-lg"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteDept(dept.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  <button
                    onClick={() => { setFormPromo({ nom: '', annee: new Date().getFullYear() }); setModalPromo({ open: true, item: null, departmentId: dept.id }); }}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" /> Promotion
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-2">
                  {promos.length === 0 ? (
                    <p className="text-slate-400 text-sm py-2">Aucune promotion. Cliquez sur + Promotion pour ajouter.</p>
                  ) : (
                    promos.map((promo) => {
                      const students = studentsByPromo[promo.id] || [];
                      const isPromoExpanded = expandedPromo[promo.id];
                      return (
                        <div key={promo.id} className="rounded-xl border border-slate-100 overflow-hidden">
                          <div
                            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 cursor-pointer"
                            onClick={() => togglePromo(promo.id)}
                          >
                            <div className="flex items-center gap-2">
                              {isPromoExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="font-medium text-slate-700">{promo.nom}</span>
                              <span className="text-slate-400 text-sm">({promo.annee || '-'})</span>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <label className="cursor-pointer">
                                <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={(e) => handleImport(e, promo.id)} />
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100">
                                  <Upload className="w-4 h-4" />
                                  {importing === promo.id ? 'Import...' : 'Importer (Excel/PDF)'}
                                </span>
                              </label>
                              <button onClick={() => { setFormPromo({ nom: promo.nom, annee: promo.annee || '' }); setModalPromo({ open: true, item: promo, departmentId: dept.id }); }} className="p-1.5 text-slate-500 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => handleDeletePromo(promo.id)} className="p-1.5 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                          {isPromoExpanded && (
                            <div className="bg-slate-50/50 px-4 py-3 border-t border-slate-100">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <p className="text-xs text-slate-500">
                                  Liste officielle • {students.length} étudiant(s) — nom complet, téléphone ; sélection et suppression groupée possible
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {(studentSelection[promo.id] || []).length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => bulkDeleteStudents(promo.id)}
                                      className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
                                    >
                                      Supprimer ({(studentSelection[promo.id] || []).length})
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStudentForm({ matricule: '', nom_complet: '', telephone: '' });
                                      setStudentModal({ open: true, promotionId: promo.id });
                                    }}
                                    className="text-xs px-2 py-1 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                                  >
                                    + Ajouter un nom
                                  </button>
                                </div>
                              </div>
                              <div className="max-h-64 overflow-y-auto text-sm">
                                {students.length === 0 ? (
                                  <p className="text-slate-400">Aucun étudiant. Importez une liste Excel ou PDF (colonnes: Matricule, Nom complet) ou cliquez sur « Ajouter un nom ».</p>
                                ) : (
                                  <table className="w-full text-slate-700">
                                    <thead>
                                      <tr>
                                        <th className="text-left py-1 w-8">
                                          <input
                                            type="checkbox"
                                            title="Tout sélectionner"
                                            checked={students.length > 0 && students.every((s) => (studentSelection[promo.id] || []).includes(s.id))}
                                            onChange={() => toggleAllStudentsOnPromo(promo.id, students)}
                                          />
                                        </th>
                                        <th className="text-left py-1 font-medium">Matricule</th>
                                        <th className="text-left py-1 font-medium">Nom complet</th>
                                        <th className="text-left py-1 font-medium">Téléphone</th>
                                        <th className="text-right py-1 font-medium w-10"> </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {students.map((s) => (
                                        <tr key={s.id}>
                                          <td className="py-1 align-middle">
                                            <input
                                              type="checkbox"
                                              checked={(studentSelection[promo.id] || []).includes(s.id)}
                                              onChange={() => toggleStudentSelect(promo.id, s.id)}
                                            />
                                          </td>
                                          <td className="py-1">{s.matricule}</td>
                                          <td className="py-1 font-medium">{s.nom_complet}</td>
                                          <td className="py-1">{s.telephone || '—'}</td>
                                          <td className="py-1 text-right">
                                            <button
                                              type="button"
                                              onClick={() => deleteOneStudent(promo.id, s.id)}
                                              className="p-1 text-slate-400 hover:text-red-600"
                                              title="Supprimer"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Formateurs / Enseignants */}
      {/* Pratiques / Manipulations */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50/50"
          onClick={() => setExpandedPratiques((e) => !e)}
        >
          <div className="flex items-center gap-2">
            {expandedPratiques ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
            <FlaskConical className="w-5 h-5 text-primary-500" />
            <h2 className="font-semibold text-slate-800">Pratiques / Manipulations</h2>
            <span className="text-slate-400 text-sm">({pratiques.length})</span>
          </div>
          <div className="d-flex gap-2">
            <Link to="/admin/formateurs" onClick={(e) => e.stopPropagation()} className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg text-sm">
              Formateurs
            </Link>
            <Link to="/admin/activites" onClick={(e) => e.stopPropagation()} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg text-sm font-medium">
              Créer une activité
            </Link>
          </div>
        </div>
        {expandedPratiques && (
          <div className="border-t border-slate-100 p-4">
            {pratiques.length === 0 ? (
              <p className="text-slate-400 text-sm">Aucune pratique. Créez une activité liée à cette faculté.</p>
            ) : (
              <div className="space-y-2">
                {pratiques.map((a) => (
                  <Link key={a.id} to={`/admin/activites/${a.id}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary-200 hover:bg-primary-50/30 transition-colors">
                    <div>
                      <p className="font-medium text-slate-800">{a.nom}</p>
                      <p className="text-xs text-slate-500">{a.activity_types?.nom} • {a.date_debut} • {a.formateurs?.nom_complet || 'Sans superviseur'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Département */}
      {modalDept.open && (
        <div className="modal-overlay" onClick={() => setModalDept({ open: false })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{modalDept.item ? 'Modifier' : 'Nouveau département'}</h2>
            <form onSubmit={handleSubmitDept} className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Nom</label><input type="text" value={formDept.nom} onChange={(e) => setFormDept({ ...formDept, nom: e.target.value })} required className="input-field" /></div>
              <div><label className="block text-sm font-medium mb-2">Code</label><input type="text" value={formDept.code} onChange={(e) => setFormDept({ ...formDept, code: e.target.value })} className="input-field" /></div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModalDept({ open: false })} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ajout étudiant (une ligne) */}
      {studentModal.open && (
        <div className="modal-overlay" onClick={() => setStudentModal({ open: false, promotionId: '' })}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Ajouter un étudiant à cette promotion</h2>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Matricule</label>
                <input type="text" value={studentForm.matricule} onChange={(e) => setStudentForm({ ...studentForm, matricule: e.target.value })} required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nom complet</label>
                <input type="text" value={studentForm.nom_complet} onChange={(e) => setStudentForm({ ...studentForm, nom_complet: e.target.value })} required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Téléphone</label>
                <input type="tel" value={studentForm.telephone} onChange={(e) => setStudentForm({ ...studentForm, telephone: e.target.value })} className="input-field" />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setStudentModal({ open: false, promotionId: '' })} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl">
                  Annuler
                </button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Promotion */}
      {modalPromo.open && (
        <div className="modal-overlay" onClick={() => setModalPromo({ open: false })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{modalPromo.item ? 'Modifier' : 'Nouvelle promotion'}</h2>
            <form onSubmit={handleSubmitPromo} className="space-y-4">
              <div><label className="block text-sm font-medium mb-2">Nom</label><input type="text" value={formPromo.nom} onChange={(e) => setFormPromo({ ...formPromo, nom: e.target.value })} required className="input-field" placeholder="ex: L3 Informatique" /></div>
              <div><label className="block text-sm font-medium mb-2">Année</label><input type="number" value={formPromo.annee} onChange={(e) => setFormPromo({ ...formPromo, annee: e.target.value })} className="input-field" placeholder="2024" /></div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModalPromo({ open: false })} className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
                <button type="submit" className="btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
