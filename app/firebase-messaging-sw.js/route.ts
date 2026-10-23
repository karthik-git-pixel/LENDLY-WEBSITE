import { NextResponse } from 'next/server';

export async function GET() {
  const swScript = `// Firebase Cloud Messaging Service Worker (Dynamic)
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ''}",
  authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ''}",
  projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''}",
  storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''}",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  
  self.registration.showNotification(title || 'Lendly', {
    body: body || 'You have a new notification',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data,
    actions: [
      { action: 'open', title: 'Open' },
    ],
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
`;

  return new NextResponse(swScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
