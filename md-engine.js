const MDEngine = {
    async deduct(cost) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("login_required");
        const uid = user.uid;
        const doc = await firebase.firestore().collection("users").doc(uid).get();
        const current = doc.data()?.credits || 0;
        if (current < cost) throw new Error("insufficient_credits");
        await firebase.firestore().collection("users").doc(uid).update({ credits: current - cost });
        return current - cost;
    }
};
