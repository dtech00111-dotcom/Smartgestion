/** Affichage HH:MM pour une colonne TIME Supabase */
export function sliceTime(t) {
  if (t == null || t === '') return '';
  return String(t).slice(0, 5);
}

export function addMinutesToTime(hhmm, mins) {
  const parts = String(hhmm || '09:00').slice(0, 5).split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const total = h * 60 + m + (Number(mins) || 0);
  const wrap = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrap / 60)).padStart(2, '0')}:${String(wrap % 60).padStart(2, '0')}`;
}

/** Durée en minutes entre deux heures le même jour ; si fin <= début, fin est le lendemain. */
export function minutesBetweenTimes(startHHMM, endHHMM) {
  const p1 = String(startHHMM || '00:00').slice(0, 5).split(':');
  const p2 = String(endHHMM || '00:00').slice(0, 5).split(':');
  const sh = parseInt(p1[0], 10) || 0;
  const sm = parseInt(p1[1], 10) || 0;
  const eh = parseInt(p2[0], 10) || 0;
  const em = parseInt(p2[1], 10) || 0;
  let sMin = sh * 60 + sm;
  let eMin = eh * 60 + em;
  if (eMin <= sMin) eMin += 24 * 60;
  return Math.max(1, eMin - sMin);
}

/** Ligne lisible : « 09:00 – 10:00 » ou repli sur durée. */
export function activityScheduleLine(activity) {
  const deb = sliceTime(activity?.heure_debut) || '-';
  const fin = activity?.heure_fin ? sliceTime(activity.heure_fin) : null;
  if (fin) return `${deb} – ${fin}`;
  const d = activity?.duree_minutes;
  if (d != null && deb !== '-') return `${deb} (${d} min)`;
  return deb;
}

export function inferHeureFinFromActivity(activity) {
  if (!activity) return '10:00';
  if (activity.heure_fin) return sliceTime(activity.heure_fin);
  return addMinutesToTime(activity.heure_debut, activity.duree_minutes || 60);
}
