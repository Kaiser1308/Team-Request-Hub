self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Team Request Hub";
  const options = {
    body: data.body || "You have a new notification.",
    tag: data.tag,
    data: { url: data.url || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/notifications";
  event.waitUntil(self.clients.openWindow(url));
});
