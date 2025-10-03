// Authentication Guard for W.A.V.E Platform
// Protects pages and redirects unauthenticated users

import authManager from './auth.js';

class AuthGuard {
  constructor() {
    this.protectedPages = [
      'AI.html',
      'RESEARCH.html',
      'QUERY.html',
      'PREDICTION.html',
      'COMMUNITY.html',
      'CHANGE-DETECTION.html',
      'COMPARE.html'
    ];
    
    this.init();
  }

  init() {
    // Check if current page needs protection
    const currentPage = this.getCurrentPage();
    if (this.isProtectedPage(currentPage)) {
      this.protectPage();
    }
  }

  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    return filename || 'index.html';
  }

  isProtectedPage(pageName) {
    return this.protectedPages.includes(pageName);
  }

  async protectPage() {
    try {
      const isAuthenticated = await authManager.requireAuth();
      
      if (!isAuthenticated) {
        this.redirectToLogin();
        return;
      }

      // User is authenticated, set up auth state management
      this.setupAuthStateManagement();
      
    } catch (error) {
      console.error('Auth guard error:', error);
      this.redirectToLogin();
    }
  }

  setupAuthStateManagement() {
    // Listen for auth state changes
    authManager.addListener((event, data) => {
      switch (event) {
        case 'logout':
          this.redirectToLogin();
          break;
        case 'error':
          console.error('Auth error:', data);
          break;
        case 'profile_updated':
          this.updateUserInterface(data);
          break;
      }
    });

    // Update UI with current user info
    this.updateUserInterface();
  }

  updateUserInterface(profile = null) {
    const user = authManager.getCurrentUser();
    const userProfile = profile || authManager.getUserProfile();
    
    if (user && userProfile) {
      // Update user display elements
      this.updateUserDisplay(user, userProfile);
      
      // Update navigation with user info
      this.updateNavigation(user, userProfile);
    }
  }

  updateUserDisplay(user, profile) {
    // Update user avatar/name in any user display elements
    const userDisplays = document.querySelectorAll('[data-user-display]');
    userDisplays.forEach(element => {
      if (profile.photoURL) {
        const img = element.querySelector('img');
        if (img) img.src = profile.photoURL;
      }
      
      const nameElement = element.querySelector('[data-user-name]');
      if (nameElement) {
        nameElement.textContent = profile.displayName || user.email;
      }
    });
  }

  updateNavigation(user, profile) {
    // Add logout functionality to logout buttons
    const logoutButtons = document.querySelectorAll('[data-logout]');
    logoutButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleLogout();
      });
    });

    // Add profile management to profile buttons
    const profileButtons = document.querySelectorAll('[data-profile]');
    profileButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.showProfileModal(user, profile);
      });
    });
  }

  async handleLogout() {
    try {
      const result = await authManager.signOut();
      if (result.success) {
        this.redirectToLogin();
      } else {
        console.error('Logout failed:', result.error);
        alert('Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed. Please try again.');
    }
  }

  showProfileModal(user, profile) {
    // Create and show profile modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4 border border-white/10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-white">Profile</h3>
          <button class="text-zinc-400 hover:text-white" onclick="this.closest('.fixed').remove()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div class="space-y-4">
          <div class="flex items-center space-x-3">
            ${profile.photoURL ? `
              <img src="${profile.photoURL}" alt="Profile" class="w-12 h-12 rounded-full">
            ` : `
              <div class="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <span class="text-white font-semibold">${(profile.displayName || user.email).charAt(0).toUpperCase()}</span>
              </div>
            `}
            <div>
              <div class="text-white font-medium">${profile.displayName || 'User'}</div>
              <div class="text-zinc-400 text-sm">${user.email}</div>
            </div>
          </div>
          
          <div class="pt-4 border-t border-white/10">
            <div class="text-sm text-zinc-400 space-y-2">
              <div>Member since: ${profile.createdAt ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</div>
              <div>Last login: ${profile.lastLoginAt ? new Date(profile.lastLoginAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</div>
              <div>Sessions: ${profile.activity?.totalSessions || 0}</div>
            </div>
          </div>
          
          <div class="pt-4 border-t border-white/10">
            <button 
              onclick="this.closest('.fixed').remove()" 
              class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
            >
              Close
            </button>
            <button 
              data-logout 
              class="w-full mt-2 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners for the new logout button
    const logoutBtn = modal.querySelector('[data-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleLogout();
      });
    }
  }

  redirectToLogin() {
    // Don't redirect if already on login page
    if (this.getCurrentPage() === 'LOGIN.html') {
      return;
    }
    
    window.location.href = '/LOGIN.html';
  }

  // Public method to check auth status
  async isAuthenticated() {
    return await authManager.requireAuth();
  }

  // Public method to get current user
  getCurrentUser() {
    return authManager.getCurrentUser();
  }

  // Public method to get user profile
  getUserProfile() {
    return authManager.getUserProfile();
  }
}

// Create global instance
window.authGuard = new AuthGuard();

// Export for module use
export default window.authGuard;
