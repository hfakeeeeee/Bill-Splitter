import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// DÁN CONFIG CỦA BẠN Ở ĐÂY
const firebaseConfig = {
    apiKey: "AIzaSyA5Um4xAmmm0AE-ZYCWfexjZ47EMs2LBx4",
    authDomain: "bill-splitter-b9d24.firebaseapp.com",
    projectId: "bill-splitter-b9d24",
    storageBucket: "bill-splitter-b9d24.firebasestorage.app",
    messagingSenderId: "328057328202",
    appId: "1:328057328202:web:3ff7943c6394d20e280cb3"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
