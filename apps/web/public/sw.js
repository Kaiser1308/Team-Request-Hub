const NOTIFICATION_ICON = "/favicon.ico";
const APP_NAME = "Team Request Hub";

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ? `${APP_NAME} — ${data.title}` : APP_NAME;
  const options = {
    body: data.body || "You have a new notification.",
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: data.tag,
    data: { url: data.url || "/notifications" },
    vibrate: [100, 50, 100],
    actions: [
      { action: "open", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.navigate(url).then(() => client.focus());
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
