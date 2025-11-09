import { database, auth } from './firebase-config.js';

// DOM Elements
const userNameEl = document.getElementById('user-name');
const mobileUserNameEl = document.getElementById('mobile-user-name');
const logoutBtn = document.getElementById('logout-btn');
const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        // Redirect to login if not authenticated
        window.location.href = 'login.html';
        return;
    }

    // Update UI with user data
    updateUI(user);
    
    // Load dashboard data
    loadDashboardData();
});

// Update UI with user data
function updateUI(user) {
    if (user.displayName) {
        if (userNameEl) userNameEl.textContent = user.displayName;
        if (mobileUserNameEl) mobileUserNameEl.textContent = user.displayName;
    } else if (user.email) {
        if (userNameEl) userNameEl.textContent = user.email;
        if (mobileUserNameEl) mobileUserNameEl.textContent = user.email;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load statistics
        await loadDashboardStats();
        
        // Check if user is admin and load users if true
        const user = auth.currentUser;
        if (user) {
            const userRef = database.ref('admins/' + user.uid);
            const snapshot = await userRef.once('value');
            
            if (snapshot.exists()) {
                const userManagementSection = document.getElementById('user-management-section');
                if (userManagementSection) {
                    userManagementSection.classList.remove('hidden');
                    loadUsers();
                }
            }
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data');
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Get active shipments count
        const shipmentsSnapshot = await database.ref('shipments')
            .orderByChild('status')
            .equalTo('in_transit')
            .once('value');
        
        // Get total news count
        const newsSnapshot = await database.ref('news').once('value');
        
        // Get unread messages count
        const messagesSnapshot = await database.ref('messages')
            .orderByChild('read')
            .equalTo(false)
            .once('value');
        
        // Update UI
        const activeShipmentsEl = document.getElementById('active-shipments');
        const totalNewsEl = document.getElementById('total-news');
        const newMessagesEl = document.getElementById('new-messages');
        
        if (activeShipmentsEl) activeShipmentsEl.textContent = shipmentsSnapshot.numChildren() || '0';
        if (totalNewsEl) totalNewsEl.textContent = newsSnapshot.numChildren() || '0';
        if (newMessagesEl) newMessagesEl.textContent = messagesSnapshot.numChildren() || '0';
        
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        throw error;
    }
}

// Load users (admin only)
async function loadUsers() {
    const usersTable = document.getElementById('users-table-body');
    if (!usersTable) return;

    try {
        const usersSnapshot = await database.ref('users').once('value');
        
        if (!usersSnapshot.exists()) {
            usersTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>';
            return;
        }

        usersTable.innerHTML = '';
        usersSnapshot.forEach((childSnapshot) => {
            const user = childSnapshot.val();
            const userId = childSnapshot.key;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <i class="fas fa-user text-gray-500"></i>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.name || 'N/A'}</div>
                            <div class="text-sm text-gray-500">${user.email || 'N/A'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.email || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                          user.role === 'driver' ? 'bg-green-100 text-green-800' : 
                          'bg-blue-100 text-blue-800'}">
                        ${user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editUser('${userId}')" class="text-blue-600 hover:text-blue-900 mr-4">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteUser('${userId}')" class="text-red-600 hover:text-red-900">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            usersTable.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        usersTable.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Error loading users</td></tr>';
    }
}

// Show error message
function showError(message) {
    console.error(message);
    // You can implement a toast notification system here
    alert(message);
}

// Event Listeners
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            showError('Failed to logout');
        }
    });
}

if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            showError('Failed to logout');
        }
    });
}

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// Global functions that need to be accessible from HTML
window.openAddUserModal = function() {
    const modal = document.getElementById('user-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const title = modal.querySelector('#user-modal-title');
        if (title) title.textContent = 'Add New User';
        const form = modal.querySelector('form');
        if (form) form.reset();
        const userIdInput = modal.querySelector('#user-id');
        if (userIdInput) userIdInput.value = '';
    }
};

window.closeModal = function() {
    const modal = document.getElementById('user-modal');
    if (modal) modal.classList.add('hidden');
};

window.editUser = function(userId) {
    // Implement edit user functionality
    console.log('Edit user:', userId);
};

window.deleteUser = function(userId) {
    if (confirm('Are you sure you want to delete this user?')) {
        // Implement delete user functionality
        console.log('Delete user:', userId);
    }
};
