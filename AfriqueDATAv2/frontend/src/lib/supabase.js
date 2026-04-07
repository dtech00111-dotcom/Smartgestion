import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();

const isValidUrl = (s) => typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://'));

/** Valeurs du .env.example non remplacées → échecs réseau confus (« Failed to fetch »). */
const isPlaceholderConfig =
  (supabaseUrl && supabaseUrl.includes('votre-projet')) ||
  (supabaseAnonKey && /votre_cle/i.test(supabaseAnonKey));

let supabase;
try {
  if (isPlaceholderConfig) {
    throw new Error('placeholder');
  }
  if (isValidUrl(supabaseUrl) && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lock: (_name, _acquireTimeout, fn) => fn(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } else {
    throw new Error('Config manquante');
  }
} catch (e) {
  const err = new Error(
    'Supabase non configuré : dans AfriqueDATAv2/frontend/.env, renseignez REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_ANON_KEY (dashboard Supabase → Settings → API), puis redémarrez npm start. En production, définissez les mêmes variables sur votre hébergeur (ex. Vercel).'
  );
  supabase = new Proxy(
    {},
    {
      get() {
        throw err;
      },
    }
  );
}

/** Indique si l’URL et la clé semblent correctement renseignées (sans révéler la clé). */
export function getSupabaseConfigHint() {
  const url = (process.env.REACT_APP_SUPABASE_URL || '').trim();
  const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || '').trim();
  let host = null;
  try {
    if (isValidUrl(url)) host = new URL(url).hostname;
  } catch {
    host = null;
  }
  const placeholder =
    (url && url.includes('votre-projet')) || (key && /votre_cle/i.test(key));
  const missing = !isValidUrl(url) || !key;
  return {
    host,
    placeholder,
    missing,
    /** Prêt pour un test réseau (pas d’exemple, pas de trou). */
    ready: !missing && !placeholder,
    urlPreview: host || (url ? '(URL invalide)' : '(absente)'),
  };
}

export { supabase };
