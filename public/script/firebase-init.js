// Firebase initialization (ESM via CDN)
// Docs: https://firebase.google.com/docs/web/setup#available-libraries

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyD8FElSg64vqF9HweLIKsAoJAjscQXu3vM',
  authDomain: 'wave-6de7f.firebaseapp.com',
  projectId: 'wave-6de7f',
  storageBucket: 'wave-6de7f.firebasestorage.app',
  messagingSenderId: '224459653739',
  appId: '1:224459653739:web:65b0a5b15db30d6a4ae72e',
  measurementId: 'G-7TT020899D',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Expose minimal global for other modules
window.firebase = {
  app,
  analytics: null,
  logEvent: () => {}, // no-op to avoid errors when analytics is unavailable
};