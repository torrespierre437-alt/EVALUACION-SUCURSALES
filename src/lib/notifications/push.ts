import webpush from "web-push";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("VAPID keys no configuradas; se omite el envío de push.");
    return;
  }
  webpush.setVapidDetails("mailto:admin@example.com", publicKey, privateKey);
  configured = true;
}

export type PushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function sendPush(subscription: PushSubscriptionRecord | null, title: string, body: string, url: string) {
  ensureConfigured();
  if (!configured || !subscription) return;
  try {
    await webpush.sendNotification(
      subscription as unknown as webpush.PushSubscription,
      JSON.stringify({ title, body, url })
    );
  } catch (err) {
    console.error("Error enviando push:", err);
  }
}
