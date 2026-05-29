// api/referral-reward.js - Vercel Serverless Function
// يتم استدعاؤها عند إتمام عملية شحن ناجحة

export default async function handler(req, res) {
    // السماح فقط بـ POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId, rechargeAmount, rechargeId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    // إعدادات Firebase Admin (تستخدم Service Account)
    // ملاحظة: تحتاج إلى إضافة service account key في Vercel environment variables
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
        // في Vercel، يجب إضافة متغيرات البيئة:
        // FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    const db = admin.firestore();

    try {
        // 1. البحث عن سجل الإحالة لهذا المستخدم
        const referralRef = db.collection('referrals').doc(userId);
        const referralSnap = await referralRef.get();

        if (!referralSnap.exists) {
            return res.status(200).json({ message: 'No referral record found for this user' });
        }

        const referralData = referralSnap.data();

        // 2. التأكد من أن الإحالة لا تزال pending
        if (referralData.status !== 'pending') {
            return res.status(200).json({ message: 'Referral already processed' });
        }

        const referrerId = referralData.referrerId;

        if (!referrerId) {
            return res.status(400).json({ error: 'Invalid referral data' });
        }

        // 3. إضافة 20 نقطة للمُحيل
        const referrerRef = db.collection('users').doc(referrerId);
        const referrerSnap = await referrerRef.get();

        if (!referrerSnap.exists) {
            return res.status(404).json({ error: 'Referrer not found' });
        }

        const currentCredits = referrerSnap.data()?.credits || 0;
        const currentTotalReferred = referrerSnap.data()?.totalReferred || 0;
        const currentReferralEarnings = referrerSnap.data()?.referralEarnings || 0;

        await referrerRef.update({
            credits: currentCredits + 20,
            totalReferred: currentTotalReferred + 1,
            referralEarnings: currentReferralEarnings + 20,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. تحديث سجل الإحالة إلى completed
        await referralRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            rechargeAmount: rechargeAmount || 0,
            rewardGiven: 20
        });

        // 5. (اختياري) إضافة 10 نقاط ترحيبية للمستخدم الجديد
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        const userCredits = userSnap.data()?.credits || 0;
        await userRef.update({
            credits: userCredits + 10,
            welcomeBonusGiven: true
        });

        console.log(` Referral reward: ${referrerId} gained 20 credits from user ${userId}`);

        return res.status(200).json({
            success: true,
            message: 'Referral reward processed successfully',
            referrerId: referrerId,
            reward: 20,
            newReferrerCredits: currentCredits + 20
        });

    } catch (error) {
        console.error('Error processing referral reward:', error);
        return res.status(500).json({ error: error.message });
    }
}
