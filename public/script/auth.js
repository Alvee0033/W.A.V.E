// Authentication Module for W.A.V.E Platform
// Handles persistent login, user management, and session state

import { 
  getAuth, 
  onAuthStateChanged, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

class AuthManager {
  constructor() {
    this.auth = getAuth(window.firebase.app);
    this.db = getFirestore(window.firebase.app);
    this.currentUser = null;
    this.userProfile = null;
    this.listeners = [];
    this.isInitialized = false;
    
    this.init();
  }

  async init() {
    try {
      // Listen for auth state changes
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          this.currentUser = user;
          await this.loadUserProfile(user);
          this.notifyListeners('login', { user, profile: this.userProfile });
        } else {
          this.currentUser = null;
          this.userProfile = null;
          this.notifyListeners('logout', null);
        }
      });

      // Handle redirect result for Google auth
      const redirectResult = await getRedirectResult(this.auth);
      if (redirectResult && redirectResult.user) {
        await this.handleNewUser(redirectResult.user);
      }

      this.isInitialized = true;
      this.notifyListeners('ready', { user: this.currentUser, profile: this.userProfile });
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.notifyListeners('error', error);
    }
  }

  // User profile management
  async loadUserProfile(user) {
    try {
      const userRef = doc(this.db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        this.userProfile = userSnap.data();
      } else {
        // Create new user profile
        await this.createUserProfile(user);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.userProfile = null;
    }
  }

  async createUserProfile(user) {
    try {
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Anonymous User',
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: true
        },
        activity: {
          totalSessions: 0,
          lastActiveAt: serverTimestamp()
        }
      };

      const userRef = doc(this.db, 'users', user.uid);
      await setDoc(userRef, userData);
      this.userProfile = userData;
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  }

  async updateUserProfile(updates) {
    if (!this.currentUser) return false;
    
    try {
      const userRef = doc(this.db, 'users', this.currentUser.uid);
      await updateDoc(userRef, {
        ...updates,
        lastUpdatedAt: serverTimestamp()
      });
      
      // Update local profile
      this.userProfile = { ...this.userProfile, ...updates };
      this.notifyListeners('profile_updated', this.userProfile);
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      return false;
    }
  }

  async updateLastActivity() {
    if (!this.currentUser) return;
    
    try {
      const userRef = doc(this.db, 'users', this.currentUser.uid);
      await updateDoc(userRef, {
        'activity.lastActiveAt': serverTimestamp(),
        'activity.totalSessions': (this.userProfile?.activity?.totalSessions || 0) + 1
      });
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }

  // Authentication methods
  async signInWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      await this.handleNewUser(result.user);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  async signUpWithEmail(email, password, displayName) {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      await this.handleNewUser(result.user);
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(this.auth, provider);
      await this.handleNewUser(result.user);
      return { success: true, user: result.user };
    } catch (error) {
      // Fallback to redirect if popup is blocked
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(this.auth, provider);
          return { success: true, redirect: true };
        } catch (redirectError) {
          return { success: false, error: this.getErrorMessage(redirectError.code) };
        }
      }
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(this.auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  async signOut() {
    try {
      await signOut(this.auth);
      this.currentUser = null;
      this.userProfile = null;
      return { success: true };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error.code) };
    }
  }

  async handleNewUser(user) {
    await this.updateLastActivity();
    // Profile will be loaded by onAuthStateChanged
  }

  // Utility methods
  isAuthenticated() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserProfile() {
    return this.userProfile;
  }

  // Event listeners
  addListener(callback) {
    this.listeners.push(callback);
    
    // If already initialized, call immediately with current state
    if (this.isInitialized) {
      callback('ready', { user: this.currentUser, profile: this.userProfile });
    }
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'Email already in use.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed.',
      'auth/cancelled-popup-request': 'Sign-in was cancelled.',
      'auth/operation-not-supported-in-this-environment': 'This sign-in method is not supported.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-token-expired': 'Your session has expired. Please sign in again.',
      'auth/invalid-credential': 'Invalid credentials. Please check your email and password.'
    };
    return errorMessages[errorCode] || 'An error occurred. Please try again.';
  }

  // Route protection
  requireAuth() {
    return new Promise((resolve) => {
      if (this.isInitialized) {
        resolve(this.isAuthenticated());
      } else {
        const checkAuth = (event, data) => {
          if (event === 'ready' || event === 'login' || event === 'logout') {
            this.removeListener(checkAuth);
            resolve(this.isAuthenticated());
          }
        };
        this.addListener(checkAuth);
      }
    });
  }
}

// Create global instance
window.authManager = new AuthManager();

// Export for module use
export default window.authManager;
