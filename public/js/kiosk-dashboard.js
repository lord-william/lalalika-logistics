(() => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const form = document.getElementById('kiosk-form');
    const errorBox = document.getElementById('form-error');
    const successBox = document.getElementById('submission-success');
    const trackingDisplay = document.getElementById('generated-tracking');
    const recipientEmailPreview = document.getElementById('recipient-email-preview');
    const copyTrackingBtn = document.getElementById('copy-tracking-btn');
    const trackLink = document.getElementById('track-link');
    const submitBtn = document.getElementById('submit-btn');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    function ensureFirebase() {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            throw new Error('Firebase is not initialised. Please ensure firebase-config.js is loaded first.');
        }
        return {
            database: firebase.database(),
            auth: firebase.auth()
        };
    }

    async function ensureAnonymousAuth(auth) {
        if (!auth) {
            throw new Error('Firebase auth service unavailable.');
        }

        if (auth.currentUser) {
            return auth.currentUser;
        }

        try {
            const credential = await auth.signInAnonymously();
            return credential.user;
        } catch (error) {
            console.error('Anonymous authentication failed:', error);
            throw new Error('Unable to connect securely. Please refresh the page and try again.');
        }
    }

    async function generateUniqueTrackingNumber(database) {
        const prefix = 'LLK';
        const maxAttempts = 5;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const randomPart = Math.floor(Math.random() * 1_000_000_000).toString().padStart(9, '0');
            const trackingNumber = `${prefix}${randomPart}`;

            // Check for duplicates
            const snapshot = await database
                .ref('shipments')
                .orderByChild('trackingNumber')
                .equalTo(trackingNumber)
                .limitToFirst(1)
                .once('value');

            if (!snapshot.exists()) {
                return trackingNumber;
            }
        }

        throw new Error('Unable to generate a unique tracking number. Please try again.');
    }

    function normaliseField(value) {
        return typeof value === 'string' ? value.trim() : value;
    }

    function showError(message) {
        if (!errorBox) {
            alert(message);
            return;
        }
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
    }

    function hideError() {
        if (errorBox) {
            errorBox.classList.add('hidden');
        }
    }

    function setSubmittingState(isSubmitting) {
        if (!submitBtn) return;
        submitBtn.disabled = isSubmitting;
        submitBtn.classList.toggle('opacity-70', isSubmitting);
        submitBtn.innerHTML = isSubmitting
            ? '<i class="fas fa-spinner fa-spin mr-3"></i>Submitting...'
            : '<i class="fas fa-paper-plane mr-3"></i>Submit Package';
    }

    async function logActivity(database, activity) {
        try {
            await database.ref('activity').push({
                ...activity,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideError();

        try {
            const { database, auth } = ensureFirebase();

            await ensureAnonymousAuth(auth);

            const formData = new FormData(form);
            const senderName = normaliseField(formData.get('senderName'));
            const senderEmail = normaliseField(formData.get('senderEmail'));
            const senderPhone = normaliseField(formData.get('senderPhone'));
            const senderAddress = normaliseField(formData.get('senderAddress'));

            const recipientName = normaliseField(formData.get('recipientName'));
            const recipientEmail = normaliseField(formData.get('recipientEmail'));
            const recipientPhone = normaliseField(formData.get('recipientPhone'));
            const recipientAddress = normaliseField(formData.get('recipientAddress'));

            const packageDescription = normaliseField(formData.get('packageDescription'));
            const packageWeight = normaliseField(formData.get('packageWeight'));
            const additionalNotes = normaliseField(formData.get('additionalNotes'));

            if (!senderName || !senderEmail || !senderPhone || !senderAddress ||
                !recipientName || !recipientEmail || !recipientPhone || !recipientAddress ||
                !packageDescription) {
                showError('Please complete all required fields before submitting.');
                return;
            }

            setSubmittingState(true);

            const trackingNumber = await generateUniqueTrackingNumber(database);
            const submittedAt = Date.now();

            const shipmentsRef = database.ref('shipments');
            const newShipmentRef = shipmentsRef.push();
            const shipmentId = newShipmentRef.key;

            const timelineEntry = {
                timestamp: submittedAt,
                status: 'pending_kiosk',
                label: 'Package submitted at kiosk',
                actor: 'customer'
            };

            const payload = {
                id: shipmentId,
                trackingNumber,
                status: 'pending_kiosk',
                source: 'kiosk',
                createdAt: submittedAt,
                updatedAt: submittedAt,
                sender: {
                    name: senderName,
                    email: senderEmail,
                    phone: senderPhone,
                    address: senderAddress
                },
                recipient: {
                    name: recipientName,
                    email: recipientEmail,
                    phone: recipientPhone,
                    address: recipientAddress
                },
                package: {
                    description: packageDescription,
                    weight: packageWeight ? Number(packageWeight) : null,
                    notes: additionalNotes || null
                },
                timeline: [timelineEntry],
                kioskSubmission: {
                    submittedBy: senderName,
                    submittedAt
                }
            };

            await newShipmentRef.set(payload);

            await logActivity(database, {
                type: 'shipment',
                status: 'pending_kiosk',
                details: `Kiosk shipment created: ${trackingNumber}`,
                shipmentId,
                trackingNumber
            });

            form.reset();
            showSuccess(trackingNumber, recipientEmail);
        } catch (error) {
            console.error('Kiosk submission error:', error);
            showError(error.message || 'Failed to submit shipment. Please try again.');
        } finally {
            setSubmittingState(false);
        }
    }

    function showSuccess(trackingNumber, recipientEmail) {
        if (!successBox) return;
        trackingDisplay.textContent = trackingNumber;
        recipientEmailPreview.textContent = recipientEmail || 'Recipient email on record';
        trackLink.href = `track.html?number=${encodeURIComponent(trackingNumber)}`;
        successBox.classList.remove('hidden');
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function handleCopyTracking() {
        const trackingNumber = trackingDisplay?.textContent?.trim();
        if (!trackingNumber) return;

        try {
            await navigator.clipboard.writeText(trackingNumber);
            copyTrackingBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Copied!';
            setTimeout(() => {
                copyTrackingBtn.innerHTML = '<i class="fas fa-copy mr-2"></i>Copy';
            }, 2000);
        } catch (error) {
            console.error('Copy tracking error:', error);
        }
    }

    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    if (copyTrackingBtn) {
        copyTrackingBtn.addEventListener('click', (event) => {
            event.preventDefault();
            handleCopyTracking();
        });
    }
})();
