// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBBWaw-mdgC8KZ39uAdEDo6jQnbpy3r_h4",
  authDomain: "lalalika-6d426.firebaseapp.com",
  databaseURL: "https://lalalika-6d426-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lalalika-6d426",
  storageBucket: "lalalika-6d426.appspot.com",
  messagingSenderId: "413657923851",
  appId: "1:413657923851:web:36f94f8cbe3950dffaa20e"
};

// Initialize Firebase
let app, auth, database;

try {
  // Initialize Firebase if not already initialized
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }

  // Initialize services
  auth = firebase.auth();
  database = firebase.database();
  
  // Make available globally
  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDatabase = database;
  
  console.log('Firebase initialized successfully');
  
} catch (error) {
  console.error('Firebase initialization error:', error);
}