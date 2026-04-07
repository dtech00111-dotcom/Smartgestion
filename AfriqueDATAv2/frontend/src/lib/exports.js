import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerNotoSansForPdf } from './pdfUtf8Font';
import { activityScheduleLine } from './activityTime';

const DEVISE_LABEL = 'FC';
const DEVISE_LIBELLE = 'Franc congolais (FC)';

/** Logo plateforme depuis /public (ex. logo-salle-numerique.png) — null si absent */
export async function loadPlatformLogoForPdf() {
  if (typeof window === 'undefined') return null;
  const paths = ['/logo-salle-numerique.png', '/logo.png'];
  for (const p of paths) {
    try {
      const res = await fetch(new URL(p, window.location.origin).href);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const mime = blob.type || '';
      const fmt = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG';
      return { dataUrl, format: fmt };
    } catch {
      /* essai suivant */
    }
  }
  return null;
}

function drawPdfHeader(doc, font, logo, subtitle = 'Salle du Numérique – UNILU', titleY = 14) {
  const pageW = doc.internal.pageSize.width;
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 32, 'F');
  if (logo?.dataUrl) {
    try {
      doc.addImage(logo.dataUrl, logo.format, 11, 8, 14, 14);
    } catch {
      /* image invalide : en-tête texte seul */
    }
  }
  doc.setFont(font, 'bold');
  doc.setTextColor(255, 255, 255);
  const textX = logo ? 34 : pageW / 2;
  const align = logo ? 'left' : 'center';
  doc.setFontSize(17);
  doc.text('SMART GESTION', textX, titleY, { align });
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.text(subtitle, textX, titleY + 7, { align });
  doc.setTextColor(0, 0, 0);
}

function drawSignatureBlock(doc, font, adminName, startY) {
  const pageH = doc.internal.pageSize.height;
  let y = startY;
  const blockH = 36;
  if (y + blockH > pageH - 22) {
    doc.addPage();
    y = 24;
  }
  doc.setFont(font, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Secrétaire : ${adminName || '—'}`, 14, y);
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Signature et cachet (après contrôle du document)', 14, y + 7);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.line(14, y + 18, 110, y + 18);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Signé le : ___ / ___ / ________    à ___________________', 14, y + 25);
  doc.setTextColor(0, 0, 0);
  return y + blockH;
}

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
  const logo = await loadPlatformLogoForPdf();
  const secName = adminName?.trim() || 'Secrétaire';

  const total = participations.reduce((s, p) => s + Number(p.montant), 0);
  const dateGen = new Date().toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const pageHeight = doc.internal.pageSize.height;

  const addHeader = () => {
    drawPdfHeader(doc, font, logo, 'Rapport secrétaire – Salle du Numérique UNILU', 14);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Secrétaire : ${secName}`, doc.internal.pageSize.width - 14, 28, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  addHeader();

  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`Activité : ${activity.nom || ''}`, 14, 40);
  doc.text(`Type : ${activity.activity_types?.nom || '-'}`, 14, 45);
  doc.text(`Date : ${activity.date_debut} • Créneau : ${activityScheduleLine(activity)}`, 14, 50);

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
    startY: 56,
    styles: { font: font, fontStyle: 'normal', fontSize: 8 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'normal', font: font },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) return;
      addHeader();
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, finalY - 2, 196, finalY - 2);
  doc.setFont(font, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total encaissé : ${formatMontantFC(total)} (${DEVISE_LIBELLE})`, 14, finalY + 6);
  doc.setFontSize(9);
  doc.text(`Document généré le ${dateGen}`, 14, finalY + 13);
  drawSignatureBlock(doc, font, secName, finalY + 20);
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
  const logo = await loadPlatformLogoForPdf();
  const secName = adminName?.trim() || 'Secrétaire';

  const dateGen = new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  const pageHeight = doc.internal.pageSize.height;

  drawPdfHeader(doc, font, logo, 'Liste de cotation – Salle du Numérique UNILU', 13);
  doc.setFont(font, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Secrétaire : ${secName}`, doc.internal.pageSize.width - 14, 28, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`Activité : ${activity.nom || ''}`, 14, 38);
  doc.text(`Type : ${activity.activity_types?.nom || '-'}`, 14, 44);

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
    startY: 50,
    styles: { font: font, fontStyle: 'normal', fontSize: 8 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'normal', font: font },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.text(`Document généré le ${dateGen}`, 14, finalY);
  drawSignatureBlock(doc, font, secName, finalY + 10);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Liste de cotation – Document académique – SMART GESTION', 105, pageHeight - 8, { align: 'center' });
  doc.save(`liste-cotation-${sanitizeExportFilename(activity.nom)}-${activity.date_debut}.pdf`);
}

/**
 * Excel – Rapport secrétaire (montants numériques en colonne, devise indiquée)
 */
export function exportActivityToExcel(activity, participations, adminName = 'Secrétaire') {
  const total = participations.reduce((s, p) => s + Number(p.montant), 0);
  const dateGen = new Date().toLocaleDateString('fr-FR');
  const typeNom = activity.activity_types?.nom || '-';
  const secName = adminName?.trim() || 'Secrétaire';

  const header = [
    ['SMART GESTION – Rapport secrétaire'],
    ['Salle du Numérique – UNILU'],
    [`Secrétaire : ${secName}`],
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
    [`Secrétaire (confirmé) : ${secName}`],
    ['Signature et cachet (après contrôle) :'],
    ['', '', '', '', '_____________________________________________'],
    ['Date de signature : ___ / ___ / ________    Lieu : ___________________'],
    [],
    [`Fichier généré le ${dateGen} – SMART GESTION`],
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
export function exportActivityToExcelCotation(activity, participations, adminName = 'Secrétaire') {
  const dateGen = new Date().toLocaleDateString('fr-FR');
  const secName = adminName?.trim() || 'Secrétaire';
  const header = [
    ['SMART GESTION – Liste de cotation'],
    ['Salle du Numérique – UNILU'],
    [`Secrétaire : ${secName}`],
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
  const footer = [
    [],
    [`Secrétaire : ${secName}`],
    ['Signature et cachet :'],
    ['', '', '', '', '', '_____________________________________'],
    [`Document généré le ${dateGen} – SMART GESTION`],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...header, ...rows, ...footer]);
  applyExcelColWidths(ws, [5, 28, 14, 22, 22, 10]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cotation');
  XLSX.writeFile(wb, `liste-cotation-${sanitizeExportFilename(activity.nom)}-${activity.date_debut}.xlsx`);
}
