// Using firebase compat SDK; assumes firebase-config.js loaded first
(function (global) {
    function ensureFirebase() {
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK not loaded');
        }

        if (!firebase.apps.length) {
            throw new Error('Firebase app has not been initialized. Make sure firebase-config.js runs first.');
        }

        return {
            auth: firebase.auth(),
            database: firebase.database()
        };
    }

    async function loginDriver(email, password) {
        const { auth, database } = ensureFirebase();

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const driverRef = database.ref(`users/${user.uid}`);
            const snapshot = await driverRef.once('value');

            if (!snapshot.exists()) {
                await auth.signOut();
                throw new Error('No account found for this email. Please register as a driver.');
            }

            const driverData = snapshot.val();
            if (driverData.role !== 'driver') {
                await auth.signOut();
                throw new Error('Access denied. This account is not registered as a driver.');
            }

            if (driverData.status && driverData.status !== 'approved') {
                await auth.signOut();
                throw new Error('Your driver account is not yet approved. Please wait for admin approval.');
            }

            return { user, driverData };
        } catch (error) {
            console.error('Driver login error:', error);
            throw error;
        }
    }

    function checkAuthState(callback) {
        try {
            const { auth, database } = ensureFirebase();

            return auth.onAuthStateChanged(async (user) => {
                if (!user) {
                    callback({ isAuthenticated: false });
                    return;
                }

                try {
                    const snapshot = await database.ref(`users/${user.uid}`).once('value');
                    if (!snapshot.exists()) {
                        await auth.signOut();
                        callback({ isAuthenticated: false, error: 'Account not found' });
                        return;
                    }

                    const userData = snapshot.val();
                    if (userData.role !== 'driver') {
                        await auth.signOut();
                        callback({ isAuthenticated: false, error: 'Unauthorized access' });
                        return;
                    }

                    callback({ isAuthenticated: true, user, profile: userData });
                } catch (error) {
                    console.error('Auth state error:', error);
                    callback({ isAuthenticated: false, error: error.message });
                }
            });
        } catch (error) {
            console.error('Failed to attach auth state listener:', error);
            callback({ isAuthenticated: false, error: error.message });
            return () => {};
        }
    }

    async function logoutDriver() {
        const { auth } = ensureFirebase();
        await auth.signOut();
    }

    global.AuthHandler = {
        loginDriver,
        checkAuthState,
        logoutDriver
    };
})(window);
