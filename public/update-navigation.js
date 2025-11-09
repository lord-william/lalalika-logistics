// List of HTML files to update
const filesToUpdate = [
    'about.html',
    'admin.html',
    'contact.html',
    'dashboard.html',
    'driver-dashboard.html',
    'driver-register.html',
    'login.html',
    'news.html',
    'privacy-policy.html',
    'shipments.html',
    'shipping-calculator.html',
    'terms-conditions.html',
    'track.html'
];

// The navigation component code
const navigationComponent = `    <!-- Navigation -->
    <div id="navigation">
        <!-- Navigation will be loaded here by loadNavigation() -->
    </div>

    <script>
    // Function to load navigation
    function loadNavigation() {
        fetch('components/navigation.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('navigation').innerHTML = html;
            })
            .catch(error => {
                console.error('Error loading navigation:', error);
            });
    }

    // Load navigation when the page loads
    document.addEventListener('DOMContentLoaded', loadNavigation);
    </script>`;

// For each file, replace the navigation section
filesToUpdate.forEach(file => {
    console.log(`Updating navigation in ${file}...`);
    // In a real implementation, you would:
    // 1. Read the file
    // 2. Replace the navigation section
    // 3. Write the file back
    // This is a placeholder for the actual file operations
    console.log(`Would update navigation in ${file}`);
});

console.log('Navigation update complete. Please manually update the following files:');
filesToUpdate.forEach(file => console.log(`- ${file}`));
console.log('\nCopy the navigation component to each file, replacing the existing navigation section.');
