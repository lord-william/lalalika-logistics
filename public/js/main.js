// Mobile menu toggle
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Quick track form
    const quickTrackForm = document.getElementById('quick-track-form');
    if (quickTrackForm) {
        quickTrackForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const trackingNumber = document.getElementById('tracking-number').value.trim();
            
            if (trackingNumber) {
                // Redirect to track page with tracking number
                window.location.href = `/track?number=${encodeURIComponent(trackingNumber)}`;
            } else {
                alert('Please enter a tracking number');
            }
        });
    }

    // Contact form handling
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                message: formData.get('message')
            };

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                
                if (result.success) {
                    alert('Thank you for your message! We will get back to you soon.');
                    contactForm.reset();
                } else {
                    alert('There was an error sending your message. Please try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('There was an error sending your message. Please try again.');
            }
        });
    }

    // Track form handling
    const trackForm = document.getElementById('track-form');
    if (trackForm) {
        trackForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const trackingNumber = document.getElementById('track-input').value.trim();
            
            if (!trackingNumber) {
                alert('Please enter a tracking number');
                return;
            }

            // Show loading state
            const submitBtn = trackForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Tracking...';
            submitBtn.disabled = true;

            try {
                const response = await fetch('/api/track', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ trackingNumber })
                });

                const result = await response.json();
                
                if (result.success) {
                    displayTrackingResults(result);
                } else {
                    alert('Tracking number not found. Please check and try again.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('There was an error tracking your package. Please try again.');
            } finally {
                // Reset button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // Admin login form - now uses Firebase Authentication
    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;

            // Use Firebase Authentication
            if (window.firebaseAuth) {
                try {
                    const result = await window.firebaseAuth.signIn(email, password);
                    if (result.success) {
                        alert('Login successful! Redirecting to admin dashboard...');
                        window.location.href = '/admin-dashboard';
                    } else {
                        alert(result.error || 'Invalid credentials. Please try again.');
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    alert('Login failed. Please try again.');
                }
            } else {
                alert('Authentication system not initialized. Please refresh the page.');
            }
        });
    }

    // Admin dashboard functionality
    if (window.location.pathname.includes('admin.html')) {
        // Load dashboard stats when page loads
        async function loadDashboardStats() {
            try {
                // Show loading state
                const activeShipmentsEl = document.getElementById('activeShipments');
                const newMessagesEl = document.getElementById('newMessages');
                const recentNewsEl = document.getElementById('recentNews');
                
                if (activeShipmentsEl) activeShipmentsEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                if (newMessagesEl) newMessagesEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                if (recentNewsEl) recentNewsEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                const idToken = await window.firebaseAuth.getIdToken();
                if (!idToken) {
                    console.log('No auth token available');
                    return;
                }

                console.log('Fetching dashboard stats...');
                const response = await fetch('/api/admin/stats', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const stats = await response.json();
                    console.log('Dashboard stats received:', stats);
                    
                    // Update dashboard stats with real data
                    if (activeShipmentsEl) activeShipmentsEl.textContent = stats.activeShipments || 0;
                    if (newMessagesEl) newMessagesEl.textContent = stats.newMessages || 0;
                    if (recentNewsEl) recentNewsEl.textContent = stats.recentNews || 0;
                    
                } else {
                    console.error('Failed to load dashboard stats:', response.status);
                    // Show error state
                    if (activeShipmentsEl) activeShipmentsEl.textContent = '0';
                    if (newMessagesEl) newMessagesEl.textContent = '0';
                    if (recentNewsEl) recentNewsEl.textContent = '0';
                }
            } catch (error) {
                console.error('Error loading dashboard stats:', error);
                // Show error state
                const activeShipmentsEl = document.getElementById('activeShipments');
                const newMessagesEl = document.getElementById('newMessages');
                const recentNewsEl = document.getElementById('recentNews');
                
                if (activeShipmentsEl) activeShipmentsEl.textContent = '0';
                if (newMessagesEl) newMessagesEl.textContent = '0';
                if (recentNewsEl) recentNewsEl.textContent = '0';
            }
        }

        // Load stats when user is authenticated
        window.firebaseAuth.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User authenticated, loading dashboard stats');
                // Add small delay to ensure page is fully loaded
                setTimeout(loadDashboardStats, 1000);
            }
        });

        // Also try to load immediately if user is already authenticated
        if (window.firebaseAuth.getCurrentUser()) {
            console.log('User already authenticated, loading dashboard stats immediately');
            setTimeout(loadDashboardStats, 500);
        }
    }

    // Function to display tracking results
    function displayTrackingResults(data) {
        const resultsDiv = document.getElementById('tracking-results');
        if (resultsDiv) {
            // This would be populated with real Firebase data
            resultsDiv.innerHTML = `
                <div class="bg-white p-6 rounded-lg shadow-lg mt-6">
                    <h3 class="text-xl font-bold mb-4 text-green-600">
                        <i class="fas fa-check-circle mr-2"></i>Package Found!
                    </h3>
                    <div class="space-y-3">
                        <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
                        <p><strong>Status:</strong> <span class="text-blue-600">In Transit</span></p>
                        <p><strong>Current Location:</strong> Johannesburg, South Africa</p>
                        <p><strong>Expected Delivery:</strong> Tomorrow, 2:00 PM</p>
                    </div>
                    <div class="mt-4 p-4 bg-blue-50 rounded">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle mr-2"></i>
                            Your package is on its way! You'll receive SMS updates as it progresses.
                        </p>
                    </div>
                </div>
            `;
            resultsDiv.classList.remove('hidden');
        }
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

});
