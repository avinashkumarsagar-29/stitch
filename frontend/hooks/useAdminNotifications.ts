"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSocket } from "@/lib/socket";

interface NewUserEvent {
  fullName: string;
  email: string;
  createdAt: string;
}

export function useAdminNotifications() {
  const pathname = usePathname();

  useEffect(() => {
    // Only subscribe to the new-user socket events on admin pages
    if (!pathname.startsWith("/admin")) {
      return;
    }

    const socket = getSocket();

    const handleNewUser = (data: NewUserEvent) => {
      // Create popup notification
      const popup = document.createElement("div");
      popup.innerHTML = `
        <div style="
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 9999;
          background: #1a1a2e;
          border: 1px solid #c322f4;
          border-radius: 12px;
          padding: 16px 20px;
          min-width: 300px;
          box-shadow: 0 8px 32px rgba(195,34,244,0.3);
          animation: slideIn 0.3s ease;
          color: white;
          font-family: sans-serif;
        ">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:20px;">👤</span>
            <span style="font-weight:700; color:#c322f4;">New User Registered!</span>
          </div>
          <div style="font-size:14px; color:#e0e0e0;">
            <strong>${data.fullName}</strong>
          </div>
          <div style="font-size:12px; color:#aaaaaa; margin-top:2px;">
            ${data.email}
          </div>
          <div style="font-size:11px; color:#666; margin-top:6px;">
            ${new Date(data.createdAt).toLocaleTimeString()}
          </div>
        </div>
      `;

      // Add slide-in animation
      const style = document.createElement("style");
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(popup);

      // Auto remove after 5 seconds
      setTimeout(() => {
        popup.style.transition = "opacity 0.3s ease";
        popup.style.opacity = "0";
        setTimeout(() => popup.remove(), 300);
      }, 5000);
    };

    socket.on("admin:new-user", handleNewUser);

    return () => {
      socket.off("admin:new-user", handleNewUser);
    };
  }, [pathname]);
}
