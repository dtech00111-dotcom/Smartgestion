import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Évite la mise en veille de l’écran tant qu’un utilisateur est connecté (admin ou formateur).
 * Réessaie au retour sur l’onglet (le wake lock est souvent relâché en arrière-plan).
 * Nécessite HTTPS (ou localhost) ; échoue silencieusement si non supporté.
 */
export default function KeepAliveSession() {
  const { user } = useAuth();
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (!user) {
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
      return undefined;
    }

    async function requestWakeLock() {
      try {
        if (!('wakeLock' in navigator)) return;
        wakeLockRef.current?.release?.().catch(() => {});
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current?.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      } catch {
        /* refus navigateur, non-HTTPS, etc. */
      }
    }

    requestWakeLock();

    function onVisibility() {
      if (document.visibilityState === 'visible') requestWakeLock();
    }

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [user]);

  return null;
}
