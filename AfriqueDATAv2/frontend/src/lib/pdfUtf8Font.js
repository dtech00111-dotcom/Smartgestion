/**
 * Enregistre Noto Sans (UTF-8 / accents français) pour jsPDF.
 * Police servie depuis /fonts/NotoSans-Regular.ttf (public/).
 */

let cachedBinary = null;

function arrayBufferToBinaryString(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return binary;
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @returns {Promise<boolean>} true si Noto Sans est disponible
 */
export async function registerNotoSansForPdf(doc) {
  try {
    if (!cachedBinary) {
      const base = typeof process !== 'undefined' && process.env.PUBLIC_URL != null
        ? String(process.env.PUBLIC_URL).replace(/\/$/, '')
        : '';
      const res = await fetch(`${base}/fonts/NotoSans-Regular.ttf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      cachedBinary = arrayBufferToBinaryString(buf);
    }
    doc.addFileToVFS('NotoSans-Regular.ttf', cachedBinary);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.setFont('NotoSans', 'normal');
    return true;
  } catch {
    doc.setFont('helvetica', 'normal');
    return false;
  }
}
