import { database } from './firebase-config.js';

// Get shipment details by tracking number
export async function trackShipment(trackingNumber) {
    try {
        const shipmentsRef = database.ref('shipments');
        const snapshot = await shipmentsRef
            .orderByChild('trackingNumber')
            .equalTo(trackingNumber)
            .once('value');
            
        if (!snapshot.exists()) {
            throw new Error('No shipment found with this tracking number');
        }
        
        // Get the first matching shipment
        const shipment = Object.values(snapshot.val())[0];
        
        // Get tracking updates
        const trackingUpdates = [];
        const trackingRef = database.ref(`tracking/${shipment.id}`);
        const trackingSnapshot = await trackingRef.once('value');
        
        if (trackingSnapshot.exists()) {
            trackingSnapshot.forEach((childSnapshot) => {
                trackingUpdates.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            
            // Sort updates by timestamp (newest first)
            trackingUpdates.sort((a, b) => b.timestamp - a.timestamp);
        }
        
        return {
            ...shipment,
            updates: trackingUpdates
        };
    } catch (error) {
        console.error('Tracking error:', error);
        throw error;
    }
}

// Listen for real-time updates on a shipment
export function subscribeToShipmentUpdates(trackingNumber, callback) {
    const shipmentsRef = database.ref('shipments');
    const query = shipmentsRef.orderByChild('trackingNumber').equalTo(trackingNumber);
    
    return query.on('value', async (snapshot) => {
        if (snapshot.exists()) {
            const shipment = Object.values(snapshot.val())[0];
            
            // Get tracking updates
            const trackingRef = database.ref(`tracking/${shipment.id}`);
            const trackingSnapshot = await trackingRef.once('value');
            const trackingUpdates = [];
            
            if (trackingSnapshot.exists()) {
                trackingSnapshot.forEach((childSnapshot) => {
                    trackingUpdates.push({
                        id: childSnapshot.key,
                        ...childSnapshot.val()
                    });
                });
                
                // Sort updates by timestamp (newest first)
                trackingUpdates.sort((a, b) => b.timestamp - a.timestamp);
            }
            
            callback({
                ...shipment,
                updates: trackingUpdates
            });
        } else {
            callback(null);
        }
    });
}
