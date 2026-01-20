self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : { title: 'New Message', body: 'You have a new update from Suburban Brewing.' };

    const options = {
        body: data.body,
        icon: 'logo.png', // Path to your logo
        badge: 'logo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || 'index.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Open the app when the notification is clicked
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
