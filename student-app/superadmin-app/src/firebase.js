// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeoTH1ZiOaifIf214ZSFsD0vOT6C_FoL4",
  authDomain: "academia-de-san-jose.firebaseapp.com",
  projectId: "academia-de-san-jose",
  storageBucket: "academia-de-san-jose.firebasestorage.app",
  messagingSenderId: "774087940662",
  appId: "1:774087940662:web:a5bd8ffb9e481b0508d697",
  measurementId: "G-SYLVYF8E4V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, analytics, db, auth, storage };
