/**
 * Import liste d'étudiants depuis Excel (.xlsx, .xls, .csv) ou PDF
 * Colonnes attendues: Matricule, Nom (complet)
 */
import * as XLSX from 'xlsx';

function normalizeHeader(h) {
  return String(h || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function findColumns(headers) {
  const matriculeCol = headers.findIndex((h) =>
    /matricule|matr|numero|numéro|n°|no\.|code|id\s*etudiant|student\s*id|ref/i.test(h)
  );
  const nomCol = headers.findIndex((h) =>
    /nom\s*complet|nom\s*et\s*prénom|prénom\s*et\s*nom|^nom$|^name$|étudiant|etudiant|full\s*name/i.test(h) || /^\s*nom\s*$/i.test(h)
  );
  return { matriculeCol, nomCol };
}

function parseExcelRows(rows) {
  if (!rows || rows.length < 1) return [];
  let startRow = 0;
  let colMatricule = -1;
  let colNom = -1;

  for (let tryRow = 0; tryRow < Math.min(3, rows.length); tryRow++) {
    const rawHeaders = rows[tryRow] || [];
    const headers = rawHeaders.map(normalizeHeader);
    const { matriculeCol, nomCol } = findColumns(headers);

    if (matriculeCol >= 0 && nomCol >= 0 && matriculeCol !== nomCol) {
      colMatricule = matriculeCol;
      colNom = nomCol;
      startRow = tryRow + 1;
      break;
    }
    if (headers.length >= 2 && tryRow === 0) {
      colMatricule = 0;
      colNom = 1;
      startRow = 1;
      break;
    }
  }

  if (colMatricule < 0 || colNom < 0 || colMatricule === colNom) {
    if (rows.length >= 2) {
      colMatricule = 0;
      colNom = 1;
      startRow = 1;
    } else {
      return null;
    }
  }

  const result = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i] || [];
    const matricule = String(row[colMatricule] ?? '').trim();
    const nom_complet = String(row[colNom] ?? '').trim();
    if (matricule && nom_complet) {
      result.push({ matricule, nom_complet });
    }
  }
  return result;
}

/**
 * Import depuis Excel/CSV
 */
export async function importFromExcel(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  return parseExcelRows(rows);
}

/**
 * Import depuis PDF - extraction texte puis parsing
 * Format attendu: tableau avec matricule et nom (séparés par espaces/tabs)
 */
export async function importFromPDF(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.mjs`;
  const { getDocument } = pdfjs;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument(arrayBuffer).promise;
  const allLines = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items || [];
    let line = '';
    let lastY = null;
    for (const item of items) {
      const str = item.str || '';
      const y = (item.transform && item.transform[5]) ?? 0;
      if (lastY !== null && y < lastY - 3) {
        if (line.trim()) allLines.push(line.trim());
        line = str;
      } else {
        line += (line ? ' ' : '') + str;
      }
      lastY = y;
    }
    if (line.trim()) allLines.push(line.trim());
  }
  const result = [];
  for (const line of allLines) {
    const parts = line.split(/\s{2,}|\t+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      result.push({ matricule: parts[0], nom_complet: parts.slice(1).join(' ') });
    } else {
      const m = line.match(/^([A-Z0-9]{4,15})\s+(.+)$/i);
      if (m) result.push({ matricule: m[1].trim(), nom_complet: m[2].trim() });
    }
  }
  return result;
}

/**
 * Génère un fichier Excel modèle
 */
export function downloadTemplate() {
  const data = [
    ['Matricule', 'Nom complet'],
    ['UNI12345', 'Jean Dupont'],
    ['UNI12346', 'Marie Kanyinda'],
    ['UNI12347', 'Françoise Tshilombo'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 14 }, { wch: 36 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Étudiants');
  XLSX.writeFile(wb, 'modele_liste_etudiants.xlsx');
}
