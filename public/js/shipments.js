// Shipments Management JavaScript

// API Base URL
const API_BASE = window.location.origin;

// State management
let currentPage = 1;
let currentFilters = {
    status: '',
    priority: '',
    search: ''
};
let allShipments = [];

// Import constants from centralized config
const { STATUS_COLORS, PRIORITY_COLORS, SHIPMENT_STATUS, helpers } = window.APP_CONSTANTS || {};

// Fallback if constants not loaded
const statusColors = STATUS_COLORS || {
    'pending_pickup': 'bg-gray-100 text-gray-800',
    'order_received': 'bg-blue-100 text-blue-800',
    'in_transit': 'bg-yellow-100 text-yellow-800',
    'out_for_delivery': 'bg-purple-100 text-purple-800',
    'delivered': 'bg-green-100 text-green-800',
    'failed_delivery': 'bg-red-100 text-red-800',
    'returned': 'bg-orange-100 text-orange-800'
};

const priorityColors = PRIORITY_COLORS || {
    'standard': 'bg-gray-100 text-gray-800',
    'express': 'bg-orange-100 text-orange-800',
    'priority': 'bg-red-100 text-red-800'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    checkAuth();

    // Setup event listeners
    setupEventListeners();

    // Load shipments
    loadShipments();
});

// Check authentication
function checkAuth() {
    // For now, just check if we're on the right page
    // In production, this would check JWT token
    const user = sessionStorage.getItem('user');
    if (!user) {
        // Redirect to login
        // window.location.href = '/login.html';
    } else {
        const userData = JSON.parse(user);
        document.getElementById('user-name').textContent = `Hello, ${userData.firstName || 'User'}`;
        document.getElementById('mobile-user-name').textContent = `Hello, ${userData.firstName || 'User'}`;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Mobile menu toggle
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        const mobileMenu = document.getElementById('mobile-menu');
        mobileMenu.classList.toggle('hidden');
    });

    // Logout buttons
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('mobile-logout-btn')?.addEventListener('click', logout);

    // Filter buttons
    document.getElementById('apply-filters-btn')?.addEventListener('click', applyFilters);
    document.getElementById('create-shipment-btn')?.addEventListener('click', () => {
        window.location.href = '/shipment-create.html';
    });

    // Search input
    document.getElementById('search-input')?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });

    // Pagination
    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadShipments();
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        currentPage++;
        loadShipments();
    });
}

// Logout function
function logout() {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    window.location.href = '/login.html';
}

// Apply filters
function applyFilters() {
    currentFilters = {
        status: document.getElementById('status-filter').value,
        priority: document.getElementById('priority-filter').value,
        search: document.getElementById('search-input').value
    };
    currentPage = 1; // Reset to first page
    loadShipments();
}

// Load shipments from API
async function loadShipments() {
    try {
        // Build query parameters
        const params = new URLSearchParams();
        if (currentFilters.status) params.append('status', currentFilters.status);
        if (currentFilters.priority) params.append('priority', currentFilters.priority);
        params.append('page', currentPage);
        params.append('limit', 10);

        const response = await fetch(`${API_BASE}/api/shipments?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            allShipments = data.data;

            // Filter by search term locally (could also be done server-side)
            let filteredShipments = allShipments;
            if (currentFilters.search) {
                const searchLower = currentFilters.search.toLowerCase();
                filteredShipments = allShipments.filter(shipment =>
                    shipment.trackingNumber?.toLowerCase().includes(searchLower) ||
                    shipment.origin?.city?.toLowerCase().includes(searchLower) ||
                    shipment.destination?.city?.toLowerCase().includes(searchLower)
                );
            }

            // Render shipments
            renderShipments(filteredShipments);

            // Update stats
            updateStats(filteredShipments);

            // Update pagination
            updatePagination(data.pagination || { page: 1, totalPages: 1, total: filteredShipments.length });
        } else {
            showError('Failed to load shipments');
        }
    } catch (error) {
        console.error('Error loading shipments:', error);
        showError('Failed to load shipments');
    }
}

// Render shipments in table
function renderShipments(shipments) {
    const tbody = document.getElementById('shipments-table-body');

    if (!shipments || shipments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-12 text-center">
                    <i class="fas fa-inbox text-3xl text-gray-400 mb-4"></i>
                    <p class="text-gray-600">No shipments found</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = shipments.map(shipment => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${shipment.trackingNumber || 'N/A'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${shipment.origin?.city || 'N/A'}</div>
                <div class="text-sm text-gray-500">${shipment.origin?.province || ''}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${shipment.destination?.city || 'N/A'}</div>
                <div class="text-sm text-gray-500">${shipment.destination?.province || ''}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[shipment.status] || 'bg-gray-100 text-gray-800'}">
                    ${formatStatus(shipment.status)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${priorityColors[shipment.priority] || 'bg-gray-100 text-gray-800'}">
                    ${shipment.priority || 'standard'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${shipment.weight || 0} kg
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex gap-2">
                    <button onclick="viewShipment('${shipment.id || shipment.trackingNumber}')"
                        class="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="viewTracking('${shipment.trackingNumber}')"
                        class="text-green-600 hover:text-green-900 flex items-center gap-1"
                        title="View Tracking">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <button onclick="editShipment('${shipment.id || shipment.trackingNumber}')"
                        class="text-yellow-600 hover:text-yellow-900 flex items-center gap-1"
                        title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteShipment('${shipment.id || shipment.trackingNumber}')"
                        class="text-red-600 hover:text-red-900 flex items-center gap-1"
                        title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Update stats
function updateStats(shipments) {
    const total = shipments.length;
    const inTransit = shipments.filter(s => s.status === (SHIPMENT_STATUS?.IN_TRANSIT || 'in_transit')).length;
    const delivered = shipments.filter(s => s.status === (SHIPMENT_STATUS?.DELIVERED || 'delivered')).length;
    const pending = shipments.filter(s =>
        s.status === (SHIPMENT_STATUS?.PENDING_PICKUP || 'pending_pickup') ||
        s.status === (SHIPMENT_STATUS?.ORDER_RECEIVED || 'order_received')
    ).length;

    document.getElementById('total-shipments').textContent = total;
    document.getElementById('in-transit-count').textContent = inTransit;
    document.getElementById('delivered-count').textContent = delivered;
    document.getElementById('pending-count').textContent = pending;
}

// Update pagination
function updatePagination(pagination) {
    const { page, totalPages, total, limit } = pagination;

    document.getElementById('page-info').textContent = `Page ${page} of ${totalPages}`;
    document.getElementById('total-count').textContent = total;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    document.getElementById('showing-from').textContent = from;
    document.getElementById('showing-to').textContent = to;

    // Disable/enable pagination buttons
    document.getElementById('prev-page-btn').disabled = page <= 1;
    document.getElementById('next-page-btn').disabled = page >= totalPages;
}

// Format status for display
function formatStatus(status) {
    // Use helper from constants if available
    if (helpers && helpers.formatStatus) {
        return helpers.formatStatus(status);
    }
    // Fallback implementation
    if (!status) return 'Unknown';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Action functions
function viewShipment(id) {
    window.location.href = `/shipment-detail.html?id=${id}`;
}

function viewTracking(trackingNumber) {
    window.location.href = `/track.html?tracking=${trackingNumber}`;
}

function editShipment(id) {
    window.location.href = `/shipment-edit.html?id=${id}`;
}

async function deleteShipment(id) {
    if (!confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/shipments/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showSuccess('Shipment deleted successfully');
            loadShipments(); // Reload the list
        } else {
            showError(data.message || 'Failed to delete shipment');
        }
    } catch (error) {
        console.error('Error deleting shipment:', error);
        showError('Failed to delete shipment');
    }
}

// Utility functions
function showError(message) {
    alert(message); // In production, use a toast notification library
}

function showSuccess(message) {
    alert(message); // In production, use a toast notification library
}
