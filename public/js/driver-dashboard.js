(() => {
    const authUtils = window.AuthHandler || {};
    const { checkAuthState, logoutDriver } = authUtils;

    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not available.');
        return;
    }

    if (typeof checkAuthState !== 'function' || typeof logoutDriver !== 'function') {
        console.error('AuthHandler helpers are missing.');
        return;
    }

    function ensureFirebase() {
        if (!firebase.apps || !firebase.apps.length) {
            throw new Error('Firebase app not initialized. Ensure firebase-config.js runs first.');
        }
        return {
            auth: firebase.auth(),
            database: firebase.database(),
            storage: firebase.storage ? firebase.storage() : null
        };
    }

    const { auth, database, storage } = ensureFirebase();

    // DOM elements
    const driverNameEl = document.getElementById('driver-name');
    const mobileDriverNameEl = document.getElementById('mobile-driver-name');
    const driverFullNameEl = document.getElementById('driver-full-name');
    const driverEmailEl = document.getElementById('driver-email');
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const adminDashboardBtn = document.getElementById('admin-dashboard-btn');
    const notificationEl = document.getElementById('notification');

    const assignedTab = document.getElementById('assigned-tab');
    const completedTab = document.getElementById('completed-tab');
    const reportsTab = document.getElementById('reports-tab');

    const assignedSection = document.getElementById('assigned-deliveries-section');
    const assignedList = document.getElementById('assigned-deliveries-list');
    const completedSection = document.getElementById('completed-deliveries-section');
    const completedList = document.getElementById('completed-deliveries-list');
    const reportsSection = document.getElementById('issue-reports-section');
    const reportsList = document.getElementById('reports-list');
    const newReportBtn = document.getElementById('new-report-btn');

    const deliveryModal = document.getElementById('delivery-modal');
    const deliveryStatusSelect = document.getElementById('delivery-status');
    const signatureSection = document.getElementById('signature-section');
    const signatureCanvas = document.getElementById('signature-pad');
    const clearSignatureBtn = document.getElementById('clear-signature');
    const failureReasonContainer = document.getElementById('failure-reason');
    const failureReasonInput = document.getElementById('failure-reason-text');

    const reportModal = document.getElementById('report-modal');
    const reportDeliverySelect = document.getElementById('report-delivery');
    const issueTypeSelect = document.getElementById('issue-type');
    const issueDescriptionInput = document.getElementById('issue-description');
    const needsAssistanceCheckbox = document.getElementById('needs-assistance');
    const reportFileInput = document.getElementById('issue-photo');
    const reportFileName = document.getElementById('file-name');
    const imagePreviewContainer = document.getElementById('image-preview');
    const imagePreview = document.getElementById('preview');

    const viewReportModal = document.getElementById('view-report-modal');
    const reportTitleEl = document.getElementById('report-title');
    const reportIdEl = document.getElementById('report-id');
    const reportDateEl = document.getElementById('report-date');
    const reportDeliveryIdEl = document.getElementById('report-delivery-id');
    const reportStatusEl = document.getElementById('report-status');
    const reportIssueTypeEl = document.getElementById('report-issue-type');
    const reportDescriptionEl = document.getElementById('report-description');
    const reportPhotoContainer = document.getElementById('report-photo-container');
    const reportPhotoEl = document.getElementById('report-photo');
    const reportResponseContainer = document.getElementById('report-response');
    const adminResponseEl = document.getElementById('admin-response');

    let signaturePad = null;
    let currentDeliveryId = null;
    let currentDriverId = null;
    let currentDriverData = null;
    let shipmentsListener = null;
    let reportsListener = null;
    const shipmentsCache = new Map();

    initSignaturePad();
    attachEventListeners();
    attachAuthListener();

    function initSignaturePad() {
        if (!signatureCanvas || typeof SignaturePad === 'undefined') {
            return;
        }
        signaturePad = new SignaturePad(signatureCanvas, {
            backgroundColor: '#f8fafc',
            penColor: '#1d4ed8'
        });
    }

    function attachEventListeners() {
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', handleLogout);
        }
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => mobileMenu?.classList.toggle('hidden'));
        }
        if (adminDashboardBtn) {
            adminDashboardBtn.addEventListener('click', () => {
                window.location.href = 'admin-dashboard.html';
            });
        }
        if (assignedTab && completedTab && reportsTab) {
            assignedTab.addEventListener('click', () => switchTab('assigned'));
            completedTab.addEventListener('click', () => switchTab('completed'));
            reportsTab.addEventListener('click', () => switchTab('reports'));
        }

        if (clearSignatureBtn && signaturePad) {
            clearSignatureBtn.addEventListener('click', (event) => {
                event.preventDefault();
                signaturePad.clear();
            });
        }

        if (deliveryStatusSelect) {
            deliveryStatusSelect.addEventListener('change', handleDeliveryStatusChange);
        }

        if (newReportBtn) {
            newReportBtn.addEventListener('click', () => openModal(reportModal));
        }

        if (reportFileInput) {
            reportFileInput.addEventListener('change', handleReportFileSelect);
        }

        window.confirmDelivery = confirmDelivery;
        window.closeModal = closeModal;
        window.submitReport = submitReport;
        window.viewReportDetails = viewReportDetails;
        window.openReportModal = () => openModal(reportModal);
    }

    function attachAuthListener() {
        checkAuthState(async ({ isAuthenticated, user, profile, error }) => {
            if (!isAuthenticated) {
                window.location.href = 'login.html';
                return;
            }

            currentDriverId = user.uid;
            currentDriverData = profile || {};

            const displayName = `${(profile?.firstName || '').trim()} ${(profile?.lastName || '').trim()}`.trim();
            updateProfileUI({
                displayName: displayName || user.displayName || profile?.name || '',
                email: profile?.email || user.email || '',
                phone: profile?.phone || ''
            });

            if (adminDashboardBtn) {
                checkAdminPrivileges(currentDriverId);
            }

            subscribeToDriverData(currentDriverId);
        });
    }

    function updateProfileUI({ displayName, email }) {
        if (displayName) {
            if (driverNameEl) driverNameEl.textContent = displayName;
            if (mobileDriverNameEl) mobileDriverNameEl.textContent = displayName;
            if (driverFullNameEl) driverFullNameEl.textContent = displayName;
        }
        if (email && driverEmailEl) {
            driverEmailEl.textContent = email;
        }
    }

    async function checkAdminPrivileges(uid) {
        try {
            const snapshot = await database.ref(`admins/${uid}`).once('value');
            if (snapshot.exists()) {
                adminDashboardBtn?.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to check admin privileges:', error);
        }
    }

    function subscribeToDriverData(driverId) {
        detachRealtimeListeners();

        const shipmentsQuery = database.ref('shipments').orderByChild('driverId').equalTo(driverId);
        shipmentsListener = shipmentsQuery.on('value', snapshot => {
            const assigned = [];
            const completed = [];
            shipmentsCache.clear();

            snapshot.forEach(child => {
                const payload = child.val() || {};
                const shipment = { id: child.key, ...payload };
                shipmentsCache.set(child.key, shipment);
                if (shipment.status === 'delivered' || shipment.status === 'failed') {
                    completed.push(shipment);
                } else {
                    assigned.push(shipment);
                }
            });

            renderShipmentList(assignedList, assigned, true);
            renderShipmentList(completedList, completed, false);
            populateReportDeliveryOptions(assigned.concat(completed));
        }, error => {
            console.error('Shipments listener error:', error);
            showNotification('Unable to load deliveries. Please refresh.', 'error');
        });

        const reportsQuery = database.ref('reports').orderByChild('driverId').equalTo(driverId);
        reportsListener = reportsQuery.on('value', snapshot => {
            const reports = [];
            snapshot.forEach(child => {
                reports.push({ id: child.key, ...child.val() });
            });
            renderReports(reports);
        }, error => {
            console.error('Reports listener error:', error);
            showNotification('Unable to load reports. Please refresh.', 'error');
        });
    }

    function detachRealtimeListeners() {
        if (shipmentsListener) {
            database.ref('shipments').off('value', shipmentsListener);
            shipmentsListener = null;
        }
        if (reportsListener) {
            database.ref('reports').off('value', reportsListener);
            reportsListener = null;
        }
    }

    function renderShipmentList(container, shipments, allowActions) {
        if (!container) return;
        container.innerHTML = '';

        if (!shipments.length) {
            container.innerHTML = '<p class="text-gray-500">No deliveries found.</p>';
            return;
        }

        shipments.forEach(shipment => {
            container.appendChild(createShipmentCard(shipment, allowActions));
        });
    }

    function createShipmentCard(shipment, allowActions) {
        const {
            id,
            trackingNumber = 'N/A',
            status = 'pending',
            scheduledDate,
            expectedDelivery,
            priority
        } = shipment;

        const pickupAddress = getPickupAddress(shipment);
        const dropoffAddress = getDropoffAddress(shipment);
        const pickupContact = formatContactInfo(getPickupContact(shipment));
        const dropoffContact = formatContactInfo(getDropoffContact(shipment));
        const locationSummary = formatLocationPath(pickupAddress, dropoffAddress);

        const statusMap = {
            pending: { text: 'Pending', class: 'bg-yellow-100 text-yellow-800' },
            pending_kiosk: { text: 'Pending Kiosk', class: 'bg-yellow-100 text-yellow-800' },
            picked_up: { text: 'Picked Up', class: 'bg-blue-100 text-blue-800' },
            in_transit: { text: 'In Transit', class: 'bg-blue-100 text-blue-800' },
            out_for_delivery: { text: 'Out for Delivery', class: 'bg-indigo-100 text-indigo-800' },
            loaded_for_delivery: { text: 'Loaded for Delivery', class: 'bg-indigo-100 text-indigo-800' },
            delivered: { text: 'Delivered', class: 'bg-green-100 text-green-800' },
            failed: { text: 'Delivery Failed', class: 'bg-red-100 text-red-800' }
        };

        const statusMeta = statusMap[status] || { text: status, class: 'bg-gray-100 text-gray-800' };

        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow mb-4';
        card.dataset.id = id;
        card.dataset.tracking = trackingNumber;

        const priorityBadge = priority ? `<span class="ml-2 px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">${priority}</span>` : '';

        card.innerHTML = `
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                    <h3 class="font-semibold text-lg">${trackingNumber}</h3>
                    <p class="text-sm text-gray-600">${locationSummary}</p>
                    <div class="mt-2 text-sm text-gray-600 space-y-1">
                        <p><span class="font-medium text-gray-700">Pickup:</span> ${pickupAddress}</p>
                        ${pickupContact ? `<p class="pl-4 text-xs text-gray-500">Contact: ${pickupContact}</p>` : ''}
                        <p><span class="font-medium text-gray-700">Drop-off:</span> ${dropoffAddress}</p>
                        ${dropoffContact ? `<p class="pl-4 text-xs text-gray-500">Contact: ${dropoffContact}</p>` : ''}
                    </div>
                    <div class="mt-2 flex items-center space-x-2">
                        <span class="px-2 py-1 text-xs rounded-full ${statusMeta.class}">${statusMeta.text}</span>
                        ${priorityBadge}
                    </div>
                    ${scheduledDate ? `<p class="mt-2 text-xs text-gray-500">Scheduled: ${formatDate(scheduledDate)}</p>` : ''}
                    ${expectedDelivery ? `<p class="text-xs text-gray-500">Expected: ${formatDate(expectedDelivery)}</p>` : ''}
                </div>
                <div class="flex items-center space-x-3">
                    <button class="text-blue-600 hover:text-blue-800" data-action="view" data-id="${id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${allowActions ? `
                        <button class="text-green-600 hover:text-green-800" data-action="complete" data-id="${id}">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="text-red-600 hover:text-red-800" data-action="report" data-id="${id}">
                            <i class="fas fa-exclamation-triangle"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', (event) => {
            const actionBtn = event.target.closest('button[data-action]');
            if (!actionBtn) return;

            event.stopPropagation();
            const action = actionBtn.dataset.action;
            const deliveryId = actionBtn.dataset.id;

            if (action === 'view') {
                viewDeliveryDetails(shipment);
                return;
            }

            if (action === 'complete') {
                openDeliveryModal(shipment);
                return;
            }

            if (action === 'report') {
                openReportForDelivery(deliveryId);
            }
        });

        return card;
    }

    function formatLocationPath(origin, destination) {
        const originLabel = formatAddress(origin);
        const destinationLabel = formatAddress(destination);
        return `${originLabel} → ${destinationLabel}`;
    }

    function formatAddress(address) {
        if (!address) return 'Location unavailable';

        if (typeof address === 'string') {
            const trimmed = address.trim();
            return trimmed || 'Location unavailable';
        }

        if (Array.isArray(address)) {
            const parts = address.map(part => (typeof part === 'string' ? part.trim() : part)).filter(Boolean);
            return parts.length ? parts.join(', ') : 'Location unavailable';
        }

        if (typeof address === 'object') {
            const parts = [
                address.address,
                address.addressLine1,
                address.addressLine2,
                address.street,
                address.suburb,
                address.city,
                address.town,
                address.province || address.state,
                address.country,
                address.postalCode || address.zip
            ].filter(Boolean);

            if (parts.length) {
                return parts.join(', ');
            }
        }

        return String(address) || 'Location unavailable';
    }

    function getPickupAddress(shipment) {
        if (!shipment) return 'Location unavailable';

        const origin = shipment.origin || shipment.pickupLocation;
        if (origin) {
            return formatAddress(origin);
        }

        const sender = shipment.sender || shipment.pickup || {};
        const raw = sender.address || sender.location || {
            addressLine1: sender.addressLine1,
            addressLine2: sender.addressLine2,
            street: sender.street,
            city: sender.city,
            province: sender.province || sender.state,
            country: sender.country,
            postalCode: sender.postalCode || sender.zip
        };

        return formatAddress(raw);
    }

    function getDropoffAddress(shipment) {
        if (!shipment) return 'Location unavailable';

        const destination = shipment.destination || shipment.dropoffLocation;
        if (destination) {
            return formatAddress(destination);
        }

        const recipient = shipment.recipient || shipment.dropoff || {};
        const raw = recipient.address || recipient.location || {
            addressLine1: recipient.addressLine1,
            addressLine2: recipient.addressLine2,
            street: recipient.street,
            city: recipient.city,
            province: recipient.province || recipient.state,
            country: recipient.country,
            postalCode: recipient.postalCode || recipient.zip
        };

        return formatAddress(raw);
    }

    function getPickupContact(shipment) {
        const sender = shipment?.sender || shipment?.pickupContact || {};
        const name = sender.name || sender.fullName || shipment?.pickupContactName || shipment?.originContactName;
        const phone = sender.phone || sender.phoneNumber || shipment?.pickupContactPhone || shipment?.originContactPhone;
        const email = sender.email || shipment?.pickupContactEmail || shipment?.originContactEmail;

        if (!name && !phone && !email) {
            return null;
        }

        return { name, phone, email };
    }

    function getDropoffContact(shipment) {
        const recipient = shipment?.recipient || shipment?.dropoffContact || {};
        const name = recipient.name || recipient.fullName || shipment?.dropoffContactName || shipment?.destinationContactName;
        const phone = recipient.phone || recipient.phoneNumber || shipment?.dropoffContactPhone || shipment?.destinationContactPhone;
        const email = recipient.email || shipment?.dropoffContactEmail || shipment?.destinationContactEmail;

        if (!name && !phone && !email) {
            return null;
        }

        return { name, phone, email };
    }

    function formatContactInfo(contact) {
        if (!contact) return '';

        const parts = [];
        if (contact.name) {
            parts.push(contact.name);
        }

        const detail = [contact.phone, contact.email].filter(Boolean).join(' • ');
        if (detail) {
            parts.push(detail);
        }

        return parts.join(' — ');
    }

    function renderReports(reports) {
        if (!reportsList) return;
        reportsList.innerHTML = '';

        if (!reports.length) {
            reportsList.innerHTML = '<p class="text-gray-500">No issue reports submitted.</p>';
            return;
        }

        reports.sort((a, b) => (b.reportedAt || 0) - (a.reportedAt || 0));

        reports.forEach(report => {
            const reportCard = document.createElement('div');
            reportCard.className = 'bg-white p-4 rounded-lg shadow';

            const statusMeta = getReportStatusMeta(report.status);

            reportCard.innerHTML = `
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                        <h3 class="font-semibold">Report #${report.id}</h3>
                        <p class="text-sm text-gray-600">Delivery: ${report.deliveryTracking || report.deliveryId || 'N/A'}</p>
                        <p class="text-xs text-gray-500 mt-1">${formatDate(report.reportedAt)}</p>
                        <p class="mt-2 text-sm">${report.description || 'No description provided.'}</p>
                    </div>
                    <div class="flex items-center space-x-3">
                        <span class="px-2 py-1 text-xs rounded-full ${statusMeta.class}">${statusMeta.text}</span>
                        <button class="text-blue-600 hover:text-blue-800" data-action="view-report" data-id="${report.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `;

            reportCard.addEventListener('click', (event) => {
                const btn = event.target.closest('button[data-action="view-report"]');
                if (!btn) return;
                event.stopPropagation();
                viewReportDetails(report);
            });

            reportsList.appendChild(reportCard);
        });
    }

    function getReportStatusMeta(status = 'open') {
        const map = {
            open: { text: 'Open', class: 'bg-yellow-100 text-yellow-800' },
            in_progress: { text: 'In Progress', class: 'bg-blue-100 text-blue-800' },
            resolved: { text: 'Resolved', class: 'bg-green-100 text-green-800' },
            closed: { text: 'Closed', class: 'bg-gray-100 text-gray-800' }
        };
        return map[status] || map.open;
    }

    function populateReportDeliveryOptions(shipments) {
        if (!reportDeliverySelect) return;
        const options = ['<option value="">Select a delivery</option>'];
        shipments.forEach(shipment => {
            const label = `${shipment.trackingNumber || shipment.id || 'Delivery'} — ${formatLocationPath(shipment.origin, shipment.destination)}`;
            options.push(`<option value="${shipment.id}">${label}</option>`);
        });
        reportDeliverySelect.innerHTML = options.join('');
    }

    function handleDeliveryStatusChange() {
        const value = deliveryStatusSelect?.value;
        if (!value) return;

        const isFailed = value === 'failed';
        if (failureReasonContainer) {
            failureReasonContainer.classList?.toggle('hidden', !isFailed);
            failureReasonContainer.style.display = isFailed ? 'block' : 'none';
        }
        if (signatureSection) {
            signatureSection.style.display = isFailed ? 'none' : 'block';
        }
    }

    function openDeliveryModal(shipment) {
        currentDeliveryId = shipment.id;
        if (deliveryStatusSelect) {
            deliveryStatusSelect.value = shipment.status === 'failed' ? 'failed' : 'delivered';
        }
        handleDeliveryStatusChange();
        if (signaturePad) signaturePad.clear();
        failureReasonInput.value = '';
        openModal(deliveryModal);
    }

    async function confirmDelivery() {
        if (!currentDeliveryId) {
            showNotification('No delivery selected.', 'error');
            return;
        }

        const status = deliveryStatusSelect?.value || 'delivered';
        const isFailed = status === 'failed';
        const failureReason = failureReasonInput?.value.trim() || '';

        if (isFailed && !failureReason) {
            showNotification('Please provide a reason for the failed delivery.', 'error');
            return;
        }

        let signatureDataUrl = null;
        if (!isFailed && signaturePad) {
            if (signaturePad.isEmpty()) {
                showNotification('Please capture the recipient signature.', 'error');
                return;
            }
            signatureDataUrl = signaturePad.toDataURL('image/png');
        }

        try {
            const updates = {
                status,
                updatedAt: Date.now(),
                completionDetails: {
                    confirmedBy: currentDriverId,
                    confirmedAt: Date.now(),
                    failureReason: isFailed ? failureReason : null,
                    signatureUrl: null
                }
            };

            if (signatureDataUrl && storage) {
                const path = `signatures/${currentDriverId}/${currentDeliveryId}-${Date.now()}.png`;
                const ref = storage.ref(path);
                await ref.putString(signatureDataUrl, 'data_url');
                updates.completionDetails.signatureUrl = await ref.getDownloadURL();
            }

            await database.ref(`shipments/${currentDeliveryId}`).update(updates);
            await logActivity({
                type: 'delivery',
                status,
                details: `Delivery ${currentDeliveryId} marked as ${status}`,
                driverId: currentDriverId
            });

            closeModal(deliveryModal);
            showNotification('Delivery status updated successfully.', 'success');
        } catch (error) {
            console.error('Failed to update delivery status:', error);
            showNotification('Failed to update delivery status. Please try again.', 'error');
        }
    }

    function handleReportFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            reportFileName.textContent = 'No file chosen';
            imagePreviewContainer.classList.add('hidden');
            return;
        }

        reportFileName.textContent = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    async function submitReport() {
        if (!currentDriverId) {
            showNotification('User not authenticated.', 'error');
            return;
        }

        const deliveryId = reportDeliverySelect?.value || '';
        const issueType = issueTypeSelect?.value || 'other';
        const description = issueDescriptionInput?.value.trim();
        const needsAssistance = !!needsAssistanceCheckbox?.checked;

        if (!deliveryId) {
            showNotification('Please select a delivery.', 'error');
            return;
        }

        if (!description) {
            showNotification('Please provide a description of the issue.', 'error');
            return;
        }

        let photoUrl = null;
        const file = reportFileInput?.files?.[0];
        if (file && storage) {
            try {
                const path = `reports/${currentDriverId}/${deliveryId}-${Date.now()}-${file.name}`;
                const ref = storage.ref(path);
                await ref.put(file);
                photoUrl = await ref.getDownloadURL();
            } catch (error) {
                console.error('Photo upload failed:', error);
                showNotification('Unable to upload photo. Please try again.', 'error');
                return;
            }
        }

        try {
            const reportRef = database.ref('reports').push();
            const payload = {
                deliveryId,
                driverId: currentDriverId,
                driverName: driverFullNameEl?.textContent || '',
                driverEmail: driverEmailEl?.textContent || '',
                issueType,
                description,
                needsAssistance,
                photoUrl,
                status: 'open',
                reportedAt: Date.now(),
                deliveryTracking: getShipmentTracking(deliveryId)
            };

            await reportRef.set(payload);
            await logActivity({
                type: 'issue',
                status: 'open',
                details: `Issue reported for delivery ${deliveryId}`,
                driverId: currentDriverId
            });

            closeModal(reportModal);
            resetReportForm();
            showNotification('Issue report submitted successfully.', 'success');
        } catch (error) {
            console.error('Failed to submit report:', error);
            showNotification('Failed to submit report. Please try again.', 'error');
        }
    }

    function resetReportForm() {
        if (reportDeliverySelect) reportDeliverySelect.value = '';
        if (issueTypeSelect) issueTypeSelect.value = 'traffic';
        if (issueDescriptionInput) issueDescriptionInput.value = '';
        if (needsAssistanceCheckbox) needsAssistanceCheckbox.checked = false;
        if (reportFileInput) reportFileInput.value = '';
        if (reportFileName) reportFileName.textContent = 'No file chosen';
        imagePreviewContainer.classList.add('hidden');
    }

    function viewReportDetails(report) {
        if (!report) return;

        reportTitleEl.textContent = `Issue Report #${report.id}`;
        reportIdEl.textContent = report.id;
        reportDateEl.textContent = formatDate(report.reportedAt);
        reportDeliveryIdEl.textContent = report.deliveryTracking || report.deliveryId || 'N/A';

        const statusMeta = getReportStatusMeta(report.status);
        reportStatusEl.textContent = statusMeta.text;
        reportStatusEl.className = `px-2 py-1 rounded-md text-sm font-medium ${statusMeta.class}`;

        reportIssueTypeEl.textContent = formatIssueType(report.issueType);
        reportDescriptionEl.textContent = report.description || '—';

        if (report.photoUrl) {
            reportPhotoEl.src = report.photoUrl;
            reportPhotoContainer.classList.remove('hidden');
        } else {
            reportPhotoContainer.classList.add('hidden');
        }

        if (report.adminResponse) {
            adminResponseEl.textContent = report.adminResponse;
            reportResponseContainer.classList.remove('hidden');
        } else {
            reportResponseContainer.classList.add('hidden');
        }

        openModal(viewReportModal);
    }

    function formatIssueType(type) {
        if (!type) return 'Other';
        return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function openModal(modal) {
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeModal(modalIdOrElement) {
        const modal = typeof modalIdOrElement === 'string'
            ? document.getElementById(modalIdOrElement)
            : modalIdOrElement;
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (modal === deliveryModal) {
            currentDeliveryId = null;
            failureReasonInput.value = '';
            if (signaturePad) signaturePad.clear();
        }
    }

    function switchTab(tab) {
        const tabs = {
            assigned: { button: assignedTab, section: assignedSection },
            completed: { button: completedTab, section: completedSection },
            reports: { button: reportsTab, section: reportsSection }
        };

        Object.keys(tabs).forEach(key => {
            const { button, section } = tabs[key];
            if (!button || !section) return;

            const isActive = key === tab;
            section.classList.toggle('hidden', !isActive);
            button.classList.toggle('bg-blue-100', isActive);
            button.classList.toggle('text-blue-700', isActive);
        });
    }

    async function handleLogout() {
        try {
            await logoutDriver();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            showNotification('Failed to logout. Please try again.', 'error');
        }
    }

    function showNotification(message, type = 'info') {
        if (!notificationEl) {
            alert(message);
            return;
        }

        notificationEl.textContent = message;
        notificationEl.className = 'mb-4 px-4 py-3 rounded-md';

        const classes = {
            success: 'bg-green-100 text-green-800',
            error: 'bg-red-100 text-red-800',
            info: 'bg-blue-100 text-blue-800'
        };

        notificationEl.classList.add(classes[type] || classes.info);
        notificationEl.classList.remove('hidden');

        setTimeout(() => {
            notificationEl.classList.add('hidden');
            notificationEl.className = 'hidden mb-4 px-4 py-3 rounded-md';
        }, 4000);
    }

    function formatDate(timestamp) {
        if (!timestamp) return '—';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString();
    }

    function getShipmentTracking(deliveryId) {
        const shipment = shipmentsCache.get(deliveryId);
        return shipment?.trackingNumber || null;
    }

    async function logActivity(activity) {
        try {
            await database.ref('activity').push({
                ...activity,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to log activity:', error);
        }
    }

    function viewDeliveryDetails(shipment) {
        const details = `Tracking: ${shipment.trackingNumber || 'N/A'}\n` +
            `Origin: ${formatAddress(shipment.origin)}\n` +
            `Destination: ${formatAddress(shipment.destination)}\n` +
            `Status: ${shipment.status || 'N/A'}\n` +
            `Scheduled: ${formatDate(shipment.scheduledDate)}\n` +
            `Expected: ${formatDate(shipment.expectedDelivery)}\n` +
            `Notes: ${shipment.notes || '—'}`;

        alert(details);
    }

    function openReportForDelivery(deliveryId) {
        if (reportDeliverySelect) {
            reportDeliverySelect.value = deliveryId;
        }
        openModal(reportModal);
    }

    window.addEventListener('beforeunload', detachRealtimeListeners);
})();
