// Page Protection Script for W.A.V.E Platform
// Adds authentication protection to all pages

const protectedPages = [
  'AI.html',
  'RESEARCH.html', 
  'QUERY.html',
  'PREDICTION.html',
  'COMMUNITY.html',
  'CHANGE-DETECTION.html',
  'COMPARE.html'
];

// Check if current page needs protection
function getCurrentPage() {
  const path = window.location.pathname;
  const filename = path.split('/').pop();
  return filename || 'index.html';
}

function isProtectedPage(pageName) {
  return protectedPages.includes(pageName);
}

// Add auth scripts to protected pages
function addAuthProtection() {
  const currentPage = getCurrentPage();
  
  if (isProtectedPage(currentPage)) {
    // Add auth scripts if not already present
    if (!document.querySelector('script[src*="firebase-init.js"]')) {
      const firebaseScript = document.createElement('script');
      firebaseScript.type = 'module';
      firebaseScript.src = './script/firebase-init.js';
      document.head.appendChild(firebaseScript);
    }
    
    if (!document.querySelector('script[src*="auth.js"]')) {
      const authScript = document.createElement('script');
      authScript.type = 'module';
      authScript.src = './script/auth.js';
      document.head.appendChild(authScript);
    }
    
    if (!document.querySelector('script[src*="auth-guard.js"]')) {
      const guardScript = document.createElement('script');
      guardScript.type = 'module';
      guardScript.src = './script/auth-guard.js';
      document.head.appendChild(guardScript);
    }
  }
}

// Run when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addAuthProtection);
} else {
  addAuthProtection();
}
