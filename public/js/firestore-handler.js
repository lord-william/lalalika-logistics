/**
 * Firestore Database Handler
 * Handles all database operations for news, contacts, and tracking
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    orderBy,
    limit,
    where,
    serverTimestamp,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

// Firebase configuration - loaded from server
let firebaseConfig = null;
let app = null;
let db = null;
let initPromise = null;

// Fetch Firebase configuration from server
async function fetchFirebaseConfig() {
    try {
        const response = await fetch('/api/firebase-config');
        if (!response.ok) {
            throw new Error('Failed to fetch Firebase configuration');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching Firebase config:', error);
        throw error;
    }
}

// Initialize Firebase with config from server
async function initializeFirestore() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            firebaseConfig = await fetchFirebaseConfig();
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            console.log('Firestore initialized successfully');
            return db;
        } catch (error) {
            console.error('Failed to initialize Firestore:', error);
            throw error;
        }
    })();

    return initPromise;
}

// Ensure Firestore is initialized before use
async function ensureFirestoreInitialized() {
    if (!db) {
        await initializeFirestore();
    }
    return db;
}

/**
 * News Feed Operations
 */
export const newsOperations = {
    /**
     * Get all news posts with pagination
     */
    async getNewsPosts(limitCount = 20, filterCategory = null) {
        try {
            await ensureFirestoreInitialized();
            let q;
            
            if (filterCategory && filterCategory !== 'all') {
                q = query(
                    collection(db, 'news_posts'),
                    where('tags', 'array-contains', filterCategory),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                );
            } else {
                q = query(
                    collection(db, 'news_posts'),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                );
            }
            
            const snapshot = await getDocs(q);
            const posts = [];
            
            snapshot.forEach((doc) => {
                posts.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return {
                success: true,
                posts: posts,
                count: posts.length
            };
        } catch (error) {
            console.error('Error fetching news posts:', error);
            return {
                success: false,
                error: error.message,
                posts: []
            };
        }
    },

    /**
     * Listen to real-time news updates
     */
    async subscribeToNews(callback, limitCount = 20) {
        await ensureFirestoreInitialized();
        const q = query(
            collection(db, 'news_posts'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        
        return onSnapshot(q, (snapshot) => {
            const posts = [];
            snapshot.forEach((doc) => {
                posts.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(posts);
        }, (error) => {
            console.error('Error in real-time listener:', error);
            callback([]);
        });
    },

    /**
     * Create a new news post (Admin only)
     */
    async createNewsPost(postData) {
        try {
            await ensureFirestoreInitialized();
            const docRef = await addDoc(collection(db, 'news_posts'), {
                ...postData,
                timestamp: serverTimestamp(),
                likes: 0,
                comments: 0,
                shares: 0,
                createdAt: serverTimestamp()
            });
            
            return {
                success: true,
                postId: docRef.id
            };
        } catch (error) {
            console.error('Error creating news post:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Contact Form Operations
 */
export const contactOperations = {
    /**
     * Submit contact form
     */
    async submitContactForm(formData) {
        try {
            await ensureFirestoreInitialized();
            const docRef = await addDoc(collection(db, 'contact_messages'), {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone || '',
                subject: formData.subject,
                message: formData.message,
                newsletter: formData.newsletter || false,
                status: 'unread',
                createdAt: serverTimestamp(),
                timestamp: serverTimestamp()
            });
            
            return {
                success: true,
                messageId: docRef.id
            };
        } catch (error) {
            console.error('Error submitting contact form:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Get all contact messages (Admin only)
     */
    async getContactMessages(limitCount = 50) {
        try {
            await ensureFirestoreInitialized();
            const q = query(
                collection(db, 'contact_messages'),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
            
            const snapshot = await getDocs(q);
            const messages = [];
            
            snapshot.forEach((doc) => {
                messages.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return {
                success: true,
                messages: messages,
                count: messages.length
            };
        } catch (error) {
            console.error('Error fetching contact messages:', error);
            return {
                success: false,
                error: error.message,
                messages: []
            };
        }
    }
};

/**
 * Shipment Tracking Operations
 */
export const trackingOperations = {
    /**
     * Get shipment by tracking number
     */
    async getShipmentByTrackingNumber(trackingNumber) {
        try {
            await ensureFirestoreInitialized();
            const q = query(
                collection(db, 'shipments'),
                where('trackingNumber', '==', trackingNumber),
                limit(1)
            );
            
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                return {
                    success: false,
                    error: 'Tracking number not found'
                };
            }
            
            const doc = snapshot.docs[0];
            return {
                success: true,
                shipment: {
                    id: doc.id,
                    ...doc.data()
                }
            };
        } catch (error) {
            console.error('Error fetching shipment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * Create new shipment
     */
    async createShipment(shipmentData) {
        try {
            await ensureFirestoreInitialized();
            const docRef = await addDoc(collection(db, 'shipments'), {
                ...shipmentData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                status: 'pending'
            });
            
            return {
                success: true,
                shipmentId: docRef.id
            };
        } catch (error) {
            console.error('Error creating shipment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

/**
 * Admin Statistics Operations
 */
export const adminOperations = {
    /**
     * Get dashboard statistics
     */
    async getDashboardStats() {
        try {
            await ensureFirestoreInitialized();
            // Get active shipments count
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('status', '!=', 'delivered')
            );
            const shipmentsSnapshot = await getDocs(shipmentsQuery);
            
            // Get unread messages count
            const messagesQuery = query(
                collection(db, 'contact_messages'),
                where('status', '==', 'unread')
            );
            const messagesSnapshot = await getDocs(messagesQuery);
            
            // Get recent news count (last 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const newsQuery = query(
                collection(db, 'news_posts'),
                orderBy('timestamp', 'desc'),
                limit(10)
            );
            const newsSnapshot = await getDocs(newsQuery);
            
            return {
                success: true,
                stats: {
                    activeShipments: shipmentsSnapshot.size,
                    newMessages: messagesSnapshot.size,
                    recentNews: newsSnapshot.size
                }
            };
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            return {
                success: false,
                error: error.message,
                stats: {
                    activeShipments: 0,
                    newMessages: 0,
                    recentNews: 0
                }
            };
        }
    }
};

// Export database instance for advanced usage
export { db };

// Make available globally for non-module scripts
window.firestoreHandler = {
    news: newsOperations,
    contact: contactOperations,
    tracking: trackingOperations,
    admin: adminOperations,
    db: db
};

export default {
    news: newsOperations,
    contact: contactOperations,
    tracking: trackingOperations,
    admin: adminOperations,
    db: db
};
