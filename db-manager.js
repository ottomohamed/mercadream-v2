// db-manager.js
// تأكد من تهيئة Firebase SDK في مشروعك مسبقاً
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

const db = getFirestore();

export const DBManager = {
    async saveGenesisRecord(genesisId, patternKey, ownerId, title) {
        try {
            const docRef = doc(db, "genesis_registry", genesisId);
            await setDoc(docRef, {
                genesisId: genesisId,
                pattern: patternKey, // مصفوفة الإحداثيات المشفرة
                owner: ownerId,
                title: title,
                timestamp: Date.now(),
                status: 'protected'
            });
            console.log('عقد الملكية تم توثيقه بنجاح في سجل Genesis Vault');
            return true;
        } catch (error) {
            console.error('خطأ في توثيق الفيديو:', error);
            return false;
        }
    }
};
