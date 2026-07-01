"use client";
import { useEffect, useState } from "react";
import { authFetch } from "@/app/components/profileStorage";
import { API_URL } from "@/app/config";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error("Error checking subscription status:", err);
    }
  }

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      if (!VAPID_PUBLIC_KEY) {
        throw new Error("VAPID public key is missing or empty.");
      }

      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      const response = await authFetch(`${API_URL}/api/admin/push-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });

      if (!response.ok) {
        throw new Error("Failed to save push subscription to backend.");
      }

      setIsSubscribed(true);
      alert("✅ Push notifications enabled!");
    } catch (err) {
      console.error("Push subscribe error:", err);
      alert("❌ Failed to enable notifications. Please allow notifications in browser.");
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }

      await authFetch(`${API_URL}/api/admin/push-unsubscribe`, {
        method: "POST",
      });

      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
  }

  return { isSubscribed, isSupported, subscribe, unsubscribe };
}
