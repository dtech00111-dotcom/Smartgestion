import { useEffect } from 'react';

/**
 * Au retour sur la fenêtre / l’onglet (autre app au premier plan, Alt+Tab, réduction),
 * force un recalcul de mise en page pour éviter un écran figé ou vide (Chromium / Electron).
 */
export default function ResumeRepaint() {
  useEffect(() => {
    function bumpPaint() {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        const body = document.body;
        if (body) {
          body.style.transform = 'translateZ(0)';
          requestAnimationFrame(() => {
            body.style.removeProperty('transform');
            window.dispatchEvent(new Event('resize'));
          });
        }
      });
    }

    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      bumpPaint();
      setTimeout(bumpPaint, 120);
      setTimeout(bumpPaint, 450);
    }

    function onFocus() {
      bumpPaint();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}
