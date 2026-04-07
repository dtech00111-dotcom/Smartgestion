import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerNotoSansForPdf } from './pdfUtf8Font';
import { activityScheduleLine } from './activityTime';

const DEVISE_LABEL = 'FC';
const DEVISE_LIBELLE = 'Franc congolais (FC)';

/** Nom de fichier sans caractères problématiques pour le disque */
export function sanitizeExportFilename(str) {
  if (!str || typeof str !== 'string') return 'activite';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'activite';
}

export function formatMontantFC(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${DEVISE_LABEL}`;
}

function applyExcelColWidths(ws, widths) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

/**
 * Rapport secrétaire – PDF
 */
export async function exportActivityToPDF(activity, participations, adminName = 'Secrétaire') {
  const doc = new jsPDF();
  const usedNoto = await registerNotoSansForPdf(doc);
  const font = usedNoto ? 'NotoSans' : 'helvetica';

  const total = participations.reduce((s, p) => s + Number(p.montant), 0);
  const dateGen = new Date().toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const pageHeight = doc.internal.pageSize.height;

  const addHeader = (y = 12) => {
    doc.setFont(font, 'bold');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, doc.internal.pageSize.width, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('SMART GESTION', 105, y, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(font, 'normal');
    doc.text('Rapport secrétaire – Salle du Numérique UNILU', 105, y + 14, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  addHeader();

  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`Activité : ${activity.nom || ''}`, 14, 38);
  doc.text(`Type : ${activity.activity_types?.nom || '-'}`, 14, 43);
  doc.text(`Date : ${activity.date_debut} • Créneau : ${activityScheduleLine(activity)}`, 14, 48);

  const headers = [[`N°`, `Nom complet`, `Faculté`, `Promotion`, `Montant (${DEVISE_LABEL})`]];
  const rows = participations.map((p, i) => [
    String(i + 1),
    p.nom_complet || '',
    p.faculties?.nom || '-',
    p.promotions?.nom || '-',
    formatMontantFC(p.montant),
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 54,
    styles: { font: font, fontStyle: 'normal', fontSize: 8 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'normal', font: font },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) return;
      addHeader(14);
    },
  });

  const finalY = doc.lastAutoTable.finalY + 14;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, finalY - 4, 196, finalY - 4);
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total encaissé : ${formatMontantFC(total)} (${DEVISE_LIBELLE})`, 14, finalY + 4);
  doc.text(`Généré par : ${adminName}`, 14, finalY + 10);
  doc.text(`Date et heure : ${dateGen}`, 14, finalY + 16);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Document officiel – SMART GESTION – Salle du Numérique UNILU', 105, pageHeight - 8, { align: 'center' });
  doc.save(`rapport-secretaire-${sanitizeExportFilename(activity.nom)}-${activity.date_debut}.pdf`);
}

/**
 * Liste de cotation – PDF
 */
export async function exportActivityToPDFCotation(activity, participations, adminName = 'Secrétaire') {
  const doc = new jsPDF();
  const usedNoto = await registerNotoSansForPdf(doc);
  const font = usedNoto ? 'NotoSans' : 'helvetica';

  const dateGen = new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  const pageHeight = doc.internal.pageSize.height;

  doc.setFont(font, 'bold');
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, doc.internal.pageSize.width, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('SMART GESTION', 105, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont(font, 'normal');
  doc.text('Liste de cotation – Salle du Numérique UNILU', 105, 18, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`Activité : ${activity.nom || ''}`, 14, 34);
  doc.text(`Type : ${activity.activity_types?.nom || '-'}`, 14, 40);

  const headers = [['N°', 'Nom complet', 'Matricule', 'Faculté', 'Promotion', 'Cote']];
  const rows = participations.map((p, i) => [
    String(i + 1),
    p.nom_complet || '',
    p.matricule || '-',
    p.faculties?.nom || '-',
    p.promotions?.nom || '-',
    p.cote || '-',
  ]);

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 46,
    styles: { font: font, fontStyle: 'normal', fontSize: 8 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'normal', font: font },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 12;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`Généré par : ${adminName}`, 14, finalY);
  doc.text(`Date : ${dateGen}`, 14, finalY + 6);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Liste de cotation – Document académique', 105, pageHeight - 8, { align: 'center' });
  doc.save(`liste-cotation-${sanitizeExportFilename(activity.nom)}-${activity.date_debut}.pdf`);
}

/**
 * Excel – Rapport secrétaire (montants numériques en colonne, devise indiquée)
 */
export function exportActivityToExcel(activity, participations) {
  const total = participations.reduce((s, p) => s + Number(p.montant), 0);
  const dateGen = new Date().toLocaleDateString('fr-FR');
  const typeNom = activity.activity_types?.nom || '-';

  const header = [
    ['SMART GESTION – Rapport secrétaire'],
    ['Salle du Numérique – UNILU'],
    [`Devise des montants : ${DEVISE_LIBELLE}`],
    [],
    [`Nom activité : ${activity.nom}`],
    [`Type : ${typeNom}`],
    [`Date : ${activity.date_debut}`],
    [`Créneau : ${activityScheduleLine(activity)}`],
    [],
    ['N°', 'Nom complet', 'Faculté', 'Promotion', `Montant (${DEVISE_LABEL})`],
  ];
  const rows = participations.map((p, i) => [
    i + 1,
    p.nom_complet ?? '',
    p.faculties?.nom || '-',
    p.promotions?.nom || '-',
    Number(p.montant) || 0,
  ]);
  const footer = [
    [],
    ['Total encaissé (FC)', '', '', '', total],
    [],
    ['Signature secrétaire : ___________________________'],
    [`Date de génération : ${dateGen}`],
  ];
  const sheet1Data = [...header, ...rows, ...footer];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  applyExcelColWidths(ws1, [5, 32, 24, 22, 16]);

  const etudiants = participations.filter((p) => p.type_participant === 'etudiant').length;
  const visiteurs = participations.filter((p) => p.type_participant === 'visiteur').length;
  const statsData = [
    ['STATISTIQUES'],
    [`Activité : ${activity.nom}`],
    [],
    ['Indicateur', 'Valeur'],
    ['Total participants', participations.length],
    ['Étudiants', etudiants],
    ['Visiteurs', visiteurs],
    [`Total encaissé (${DEVISE_LABEL})`, total],
    ['Date de génération', dateGen],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(statsData);
  applyExcelColWidths(ws2, [28, 24]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Activité');
  XLSX.utils.book_append_sheet(wb, ws2, 'Statistiques');
  XLSX.writeFile(wb, `rapport-secretaire-${sanitizeExportFilename(activity.nom)}-${activity.date_debut}.xlsx`);
}

/**
 * Excel – Liste de cotation
 */
export function exportActivityToExcelCotation(activity, participations) {
  const dateGen = new Date().toLocaleDateString('fr-FR');
  const header = [
    ['SMART GESTION – Liste de cotation'],
    ['Salle du Numérique – UNILU'],
    [],
    [`Activité : ${activity.nom}`],
    [`Type : ${activity.activity_types?.nom || '-'}`],
    [`Date : ${activity.date_debut}`],
    [],
    ['N°', 'Nom complet', 'Matricule', 'Faculté', 'Promotion', 'Cote'],
  ];
  const rows = participations.map((p, i) => [
    i + 1,
    p.nom_complet ?? '',
    p.matricule || '',
    p.faculties?.nom || '-',
    p.promotions?.nom || '-',
    p.cote || '',
  ]);
  const footer = [[], [`Document généré le ${dateGen} – Salle du Numérique UNILU`]];
  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...footer]);
  applyExcelColWidths(ws, [5, 28, 14, 22, 22, 10]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cotation');
  XLSX.writeFile(wb, `liste-cotation-${sanitizeExportFilename(activity.nom)}-${activity.date_debut}.xlsx`);
}
