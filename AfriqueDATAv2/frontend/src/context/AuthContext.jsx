import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getSupabaseUserMessage } from '../lib/supabaseErrors';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [formateurProfile, setFormateurProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    /** Première tentative : au-delà, on ne considère pas « déconnecté » (évite déconnexion après veille / réseau lent). */
    const SESSION_FIRST_TRY_MS = 60000;

    async function getSessionResilient() {
      try {
        return await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('supabase_session_slow')), SESSION_FIRST_TRY_MS)
          ),
        ]);
      } catch {
        return supabase.auth.getSession();
      }
    }

    async function applySessionFromData(session) {
      setUser(session?.user ?? null);
      if (session?.user) {
        const [adminP, formateurP] = await Promise.all([
          fetchAdminProfile(session.user.id),
          fetchFormateurProfile(session.user.id),
        ]);
        setAdminProfile(adminP ?? null);
        setFormateurProfile(formateurP ?? null);
        if (!adminP && !formateurP) await supabase.auth.signOut();
      } else {
        setAdminProfile(null);
        setFormateurProfile(null);
      }
    }

    async function init() {
      try {
        const { data: { session } } = await getSessionResilient();
        if (!mounted) return;
        await applySessionFromData(session);
      } catch {
        if (mounted) {
          setUser(null);
          setAdminProfile(null);
          setFormateurProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setUser(session?.user ?? null);
          if (session?.user) {
            setLoading(true);
            const [adminP, formateurP] = await Promise.all([
              fetchAdminProfile(session.user.id),
              fetchFormateurProfile(session.user.id),
            ]);
            setAdminProfile(adminP ?? null);
            setFormateurProfile(formateurP ?? null);
            if (!adminP && !formateurP) await supabase.auth.signOut();
          } else {
            setAdminProfile(null);
            setFormateurProfile(null);
          }
        } finally {
          setLoading(false);
        }
      }
    );

    // Après réduction de fenêtre (Electron) : getSession peut rester en attente ; on resynchronise au retour visible.
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible' || !mounted) return;
      setTimeout(async () => {
        if (!mounted) return;
        try {
          const { data: { session } } = await getSessionResilient();
          await applySessionFromData(session);
        } catch {
          /* ignore */
        } finally {
          if (mounted) setLoading(false);
        }
      }, 120);
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  async function fetchAdminProfile(userId) {
    const { data } = await supabase.from('admin_profiles').select('*').eq('id', userId).single();
    return data;
  }

  async function fetchFormateurProfile(userId, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('formateur_profiles')
          .select('id, formateur_id, code_acces_admin, formateurs(id, nom_complet, email, telephone, type)')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) return data;
        if (attempt < retries) await new Promise((r) => setTimeout(r, 300));
      } catch {
        if (attempt < retries) await new Promise((r) => setTimeout(r, 300));
      }
    }
    return null;
  }

  async function fetchAdminProfileWithRetry(userId, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 400));
      const data = await fetchAdminProfile(userId);
      if (data) return data;
    }
    return null;
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(getSupabaseUserMessage(error));
    await new Promise((r) => setTimeout(r, 200));
    const profile = await fetchAdminProfileWithRetry(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('Accès refusé. Vous n\'êtes pas administrateur.');
    }
    return data;
  };

  const signInFormateur = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(getSupabaseUserMessage(error));
    await new Promise((r) => setTimeout(r, 200));
    const profile = await fetchFormateurProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('Votre email n\'est pas enregistré comme formateur ou enseignant.');
    }
    setFormateurProfile(profile);
    return data;
  };

  const signUpFormateur = async (email, password) => {
    const { data: formateur } = await supabase
      .from('formateurs')
      .select('id')
      .ilike('email', email)
      .eq('actif', true)
      .maybeSingle();
    if (!formateur) throw new Error('Votre email n\'est pas enregistré comme formateur. Contactez le secrétariat.');

    const { data: authData, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(getSupabaseUserMessage(error));
    if (!authData.user) throw new Error('Erreur lors de la création du compte');

    await supabase.from('formateur_profiles').insert({
      id: authData.user.id,
      formateur_id: formateur.id,
    });
    const profile = await fetchFormateurProfile(authData.user.id);
    setFormateurProfile(profile);
    return { authData, profile };
  };

  const signOut = async () => {
    sessionStorage.removeItem('crossAccessFormateur');
    sessionStorage.removeItem('crossAccessAdmin');
    await supabase.auth.signOut();
    setFormateurProfile(null);
  };

  const verifyCodeForFormateurAccess = async (code) => {
    const { data, error } = await supabase.rpc('verify_admin_to_formateur_access', { code_entered: code });
    if (error) throw error;
    return !!data;
  };

  const verifyCodeForAdminAccess = async (code) => {
    const { data, error } = await supabase.rpc('verify_formateur_to_admin_access', { code_entered: code });
    if (error) throw error;
    return !!data;
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const [adminP, formateurP] = await Promise.all([
        fetchAdminProfileWithRetry(user.id),
        fetchFormateurProfile(user.id),
      ]);
      setAdminProfile(adminP ?? null);
      setFormateurProfile(formateurP ?? null);
    }
  };

  const value = {
    user,
    adminProfile,
    formateurProfile,
    isAdmin: !!adminProfile,
    isFormateur: !!formateurProfile,
    loading,
    signIn,
    signInFormateur,
    signUpFormateur,
    signOut,
    refreshProfile,
    verifyCodeForFormateurAccess,
    verifyCodeForAdminAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return context;
}
