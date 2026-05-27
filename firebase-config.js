// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBjVzVwEa5tTOjsYtsCB2h3kcqUhyxYOTg",
    authDomain: "mercadream-4b4b3.firebaseapp.com",
    projectId: "mercadream-4b4b3",
    storageBucket: "mercadream-4b4b3.firebasestorage.app",
    messagingSenderId: "257560928442",
    appId: "1:257560928442:web:06983f27629a13eeed6283",
    measurementId: "G-F0CLDJCV42"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, googleProvider };
