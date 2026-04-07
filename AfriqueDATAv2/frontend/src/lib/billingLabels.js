/** Libellés français pour les types d'encaissement (participations + caisse). */

export const ENCAISSEMENT_PARTICIPATION_OPTIONS = [
  { value: 'inscription_activite', label: 'Inscription activité (QR)' },
  { value: 'inscription_formation', label: 'Paiement inscription formation' },
  { value: 'module_word', label: 'Module Word' },
  { value: 'module_excel', label: 'Module Excel' },
  { value: 'module_powerpoint', label: 'Module PowerPoint' },
  { value: 'module_ia', label: 'Module IA' },
  { value: 'module_certification', label: 'Certification' },
  { value: 'location_salle', label: 'Location salle' },
  { value: 'photocopie', label: 'Photocopie' },
  { value: 'pratique', label: 'Pratique' },
  { value: 'autre', label: 'Autre' },
];

export function labelParticipationEncaissement(v) {
  return ENCAISSEMENT_PARTICIPATION_OPTIONS.find((o) => o.value === v)?.label || v || '—';
}

export const CAISSE_CATEGORIES = [
  { value: 'abonnement', label: 'Abonnement' },
  { value: 'inscription_formation', label: 'Inscription formation' },
  { value: 'module', label: 'Module (Word, Excel…)' },
  { value: 'location_salle', label: 'Location salle' },
  { value: 'photocopie', label: 'Photocopie' },
  { value: 'pratique', label: 'Pratique' },
  { value: 'autre', label: 'Autre' },
];

export const MODULE_NAMES = [
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'ia', label: 'IA' },
  { value: 'certification', label: 'Certification' },
];

export function labelCaisseCategorie(v) {
  return CAISSE_CATEGORIES.find((c) => c.value === v)?.label || v;
}

export function labelModuleName(v) {
  return MODULE_NAMES.find((m) => m.value === v)?.label || v || '—';
}
