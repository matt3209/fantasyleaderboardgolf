// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBaKjOHFm-xh8ZZ09zx9_QJ4Thg852KQac",
    authDomain: "fantasy-golf-draft.firebaseapp.com",
    projectId: "fantasy-golf-draft",
    storageBucket: "fantasy-golf-draft.firebasestorage.app",
    messagingSenderId: "672277007988",
    appId: "1:672277007988:web:6a1a927c4b67a454b98b21"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
