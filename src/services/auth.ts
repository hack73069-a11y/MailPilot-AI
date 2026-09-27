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

export interface ConnectedGoogleAccount {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  accessToken: string;
  connectedAt: number;
  lastActive: number;
  isWorkspace: boolean;
}

const TOKEN_KEY = 'mailpilot_gmail_access_token';
const USER_KEY = 'mailpilot_gmail_user_meta';
const ACCOUNTS_KEY = 'mailpilot_connected_google_accounts';

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: any = null;

if (typeof window !== 'undefined') {
  try {
    // Clear any stale persistent tokens to prevent expired token loops
    localStorage.removeItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedUser) {
      cachedUser = JSON.parse(storedUser);
    }
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
      notifySubscribers();
      if (onAuthFailure) onAuthFailure();
    } else if (!user && !isSigningIn) {
      cachedAccessToken = null;
      notifySubscribers();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getConnectedAccounts = (): ConnectedGoogleAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    let accounts: ConnectedGoogleAccount[] = raw ? JSON.parse(raw) : [];

    // If accounts is empty but active token/user exists, auto-migrate current session
    if (accounts.length === 0 && cachedAccessToken) {
      const storedUser = localStorage.getItem(USER_KEY);
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      if (parsedUser?.email) {
        const isWs = !(
          parsedUser.email.toLowerCase().endsWith('@gmail.com') ||
          parsedUser.email.toLowerCase().endsWith('@googlemail.com')
        );
        const initialAccount: ConnectedGoogleAccount = {
          uid: parsedUser.uid || 'current-user',
          email: parsedUser.email,
          displayName: parsedUser.displayName || null,
          photoURL: parsedUser.photoURL || null,
          accessToken: cachedAccessToken,
          connectedAt: Date.now(),
          lastActive: Date.now(),
          isWorkspace: isWs,
        };
        accounts = [initialAccount];
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      }
    }
    return accounts;
  } catch {
    return [];
  }
};

export const switchConnectedAccount = async (targetEmail: string): Promise<ConnectedGoogleAccount | null> => {
  const accounts = getConnectedAccounts();
  const target = accounts.find((a) => a.email.toLowerCase() === targetEmail.toLowerCase());
  if (!target) return null;

  cachedAccessToken = target.accessToken;
  const userObj: any = {
    uid: target.uid,
    email: target.email,
    displayName: target.displayName,
    photoURL: target.photoURL,
  };
  cachedUser = userObj;

  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, target.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userObj));
    target.lastActive = Date.now();
    const updatedAccounts = accounts.map((a) =>
      a.email.toLowerCase() === target.email.toLowerCase() ? target : a
    );
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
  }

  // Update backend worker with new active token & email
  try {
    await fetch('/api/worker/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: target.accessToken, email: target.email }),
    });
  } catch (e) {
    console.warn('Worker account switch sync notice:', e);
  }

  notifySubscribers();
  return target;
};

export const removeConnectedAccount = async (targetEmail: string): Promise<void> => {
  const accounts = getConnectedAccounts();
  const remaining = accounts.filter((a) => a.email.toLowerCase() !== targetEmail.toLowerCase());
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remaining));
  }

  // If the removed account is the active one:
  if (cachedUser?.email?.toLowerCase() === targetEmail.toLowerCase()) {
    if (remaining.length > 0) {
      await switchConnectedAccount(remaining[0].email);
    } else {
      await logout();
    }
  } else {
    notifySubscribers();
  }
};

export const autoReconnectSession = async (hintEmail?: string): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    return await googleSignIn(hintEmail || cachedUser?.email);
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
  fetch('/api/worker/token', { method: 'DELETE' }).catch(() => {});
  notifySubscribers();
};

export const googleSignIn = async (hintEmail?: string): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    if (hintEmail) {
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: hintEmail,
      });
    } else {
      provider.setCustomParameters({
        prompt: 'select_account',
      });
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Failed to obtain Google access token. Please ensure popup permissions are allowed in your browser.'
      );
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;

    const email = result.user.email || '';
    const isWs = !(
      email.toLowerCase().endsWith('@gmail.com') ||
      email.toLowerCase().endsWith('@googlemail.com')
    );

    const newAccount: ConnectedGoogleAccount = {
      uid: result.user.uid,
      email: email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      accessToken: credential.accessToken,
      connectedAt: Date.now(),
      lastActive: Date.now(),
      isWorkspace: isWs,
    };

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, credential.accessToken);
      if (result.user?.email) {
        localStorage.setItem(
          USER_KEY,
          JSON.stringify({
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          })
        );
      }

      // Add or update in connected accounts registry
      const existingAccounts = getConnectedAccounts();
      const otherAccounts = existingAccounts.filter(
        (a) => a.email.toLowerCase() !== email.toLowerCase()
      );
      const updatedAccounts = [newAccount, ...otherAccounts];
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
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
    localStorage.removeItem(ACCOUNTS_KEY);
  }
  try {
    await fetch('/api/worker/token', { method: 'DELETE' });
  } catch {}
  notifySubscribers();
};
