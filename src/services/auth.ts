import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Gmail modify scope configured via set_up_oauth
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
provider.setCustomParameters({
  prompt: 'select_account',
});

const TOKEN_KEY = 'mailpilot_gmail_access_token';
const USER_KEY = 'mailpilot_gmail_user_meta';

let isSigningIn = false;
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
let cachedUser: User | null = null;

// If token exists on load, ensure backend worker is synced
if (typeof window !== 'undefined' && cachedAccessToken) {
  try {
    const storedUser = localStorage.getItem(USER_KEY);
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    fetch('/api/worker/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cachedAccessToken, email: parsedUser?.email }),
    }).catch(() => {});
  } catch {}
}

type AuthSubscriber = (user: User | null, token: string | null) => void;
const subscribers = new Set<AuthSubscriber>();

export const subscribeAuth = (cb: AuthSubscriber) => {
  subscribers.add(cb);
  cb(cachedUser, cachedAccessToken);
  return () => {
    subscribers.delete(cb);
  };
};

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try {
      cb(cachedUser, cachedAccessToken);
    } catch (err) {
      console.error('Subscriber error:', err);
    }
  });
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user && cachedAccessToken) {
      notifySubscribers();
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (user && !cachedAccessToken) {
      // Check localStorage once more
      const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      if (stored) {
        cachedAccessToken = stored;
        notifySubscribers();
        if (onAuthSuccess) onAuthSuccess(user, stored);
      } else if (!isSigningIn) {
        notifySubscribers();
        if (onAuthFailure) onAuthFailure();
      }
    } else if (!user && !isSigningIn) {
      if (!cachedAccessToken) {
        notifySubscribers();
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export const autoReconnectSession = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    return await googleSignIn();
  } catch (err: any) {
    console.debug('Automatic reconnect attempt postponed:', err.message);
    return null;
  }
};

export const clearExpiredSession = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
  notifySubscribers();
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Failed to obtain Google access token. Please ensure popup permissions are allowed in your browser.'
      );
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;

    // Persist to localStorage so refreshing the browser never disconnects or restarts
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, credential.accessToken);
      if (result.user?.email) {
        localStorage.setItem(
          USER_KEY,
          JSON.stringify({
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          })
        );
      }
    }

    // Inform server background worker daemon to run 24/7 autonomously
    try {
      await fetch('/api/worker/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credential.accessToken, email: result.user?.email }),
      });
    } catch (e) {
      console.warn('Worker token sync notice:', e);
    }

    notifySubscribers();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    let friendlyMessage = error.message || 'Failed to connect to Google.';
    if (error.code === 'auth/popup-blocked') {
      friendlyMessage =
        'The Google Sign-in popup was blocked by your browser. Please allow popups for this site and click Connect Gmail again.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      friendlyMessage =
        'The sign-in window was closed before completing authorization. Please try again.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      friendlyMessage = 'Another sign-in window is already open. Please check your browser windows.';
    } else if (error.code === 'auth/unauthorized-domain') {
      friendlyMessage =
        'This domain is not yet authorized in Firebase OAuth. Please verify your domain in Firebase Authentication settings.';
    }
    const enhancedError = new Error(friendlyMessage);
    (enhancedError as any).code = error.code;
    throw enhancedError;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem(TOKEN_KEY);
  }
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return cachedUser;
};

export const hasValidToken = (): boolean => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem(TOKEN_KEY);
  }
  return Boolean(cachedAccessToken);
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  try {
    await fetch('/api/worker/token', { method: 'DELETE' });
  } catch {}
  notifySubscribers();
};
