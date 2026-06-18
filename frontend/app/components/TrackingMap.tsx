"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

type TrackingMapProps = {
  bookingId: number;
  role: string;
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  tailorName?: string | null;
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function TrackingMap({
  bookingId,
  role,
  status,
  pickupLocation,
  dropoffLocation,
  tailorName,
}: TrackingMapProps) {
  const mapContainerId = "tracking-map-container";
  const mapRef = useRef<any>(null);
  const tailorMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  const [eta, setEta] = useState<number>(15); // in minutes
  const [distance, setDistance] = useState<number>(3.2); // in km
  const [courierSpeed, setCourierSpeed] = useState<number>(24); // km/h
  const [courierStatus, setCourierStatus] = useState<string>("Initializing...");

  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const liveCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);

  // Generate stable coordinates based on location strings
  const hashString = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  // Base coordinates near a major city center based on address hash
  const getCoordinates = (address: string, isTailor = false) => {
    const hash = hashString(address);
    // Delhi center base
    const baseLat = 28.6139;
    const baseLng = 77.2090;

    // Add reproducible pseudo-random offsets
    const latOffset = ((hash % 100) / 1000) - 0.05;
    const lngOffset = (((hash >> 4) % 100) / 1000) - 0.05;

    if (isTailor) {
      // Offset tailor location slightly from customer location
      return {
        lat: baseLat + latOffset + 0.012,
        lng: baseLng + lngOffset - 0.008,
      };
    }

    return {
      lat: baseLat + latOffset,
      lng: baseLng + lngOffset,
    };
  };

  const customerCoords = getCoordinates(pickupLocation || dropoffLocation || "Stitch Hub");
  const tailorCoords = getCoordinates(pickupLocation || "Stitch Tailor Shop", true);

  // Helper to generate simulated route points for mock GPS driving
  const getSimulatedRoute = () => {
    const latDiff = customerCoords.lat - tailorCoords.lat;
    const lngDiff = customerCoords.lng - tailorCoords.lng;
    const points = [];
    const segments = 30;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let lat = tailorCoords.lat + latDiff * t;
      let lng = tailorCoords.lng + lngDiff * t;

      if (i > 0 && i < segments) {
        const sineFactor = Math.sin(t * Math.PI * 2.5);
        lat += sineFactor * 0.0018;
        lng += Math.cos(t * Math.PI * 1.5) * 0.0018;
      }
      points.push({ lat, lng });
    }
    return points;
  };

  // Socket.IO tracking setup
  useEffect(() => {
    if (!bookingId) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      console.log(`Socket connected. Joining room: booking-${bookingId}`);
      socket.emit("join-booking", bookingId);
    });

    if (role === "tailor") {
      if (isSimulatingGps) {
        const route = getSimulatedRoute();
        let step = 0;

        const intervalId = setInterval(() => {
          if (step >= route.length) {
            step = 0; // Loop simulation
          }
          const pt = route[step];
          setLiveCoords(pt);
          liveCoordsRef.current = pt;

          // Emit location via Socket
          socket.emit("update-location", {
            bookingId,
            lat: pt.lat,
            lng: pt.lng,
          });

          // Move own map marker
          if (tailorMarkerRef.current) {
            tailorMarkerRef.current.setLatLng([pt.lat, pt.lng]);
          }
          if (mapRef.current) {
            mapRef.current.panTo([pt.lat, pt.lng], { animate: true });
          }

          // Update HUD distance/ETA
          const dist = calculateDistance(pt.lat, pt.lng, customerCoords.lat, customerCoords.lng);
          setDistance(Number(dist.toFixed(2)));
          const speed = 24;
          const etaMins = Math.max(1, Math.round((dist / speed) * 60));
          setEta(etaMins);
          setCourierSpeed(speed);
          setCourierStatus("Simulating delivery run (broadcasting live coordinates)");

          step++;
        }, 3000);

        return () => {
          clearInterval(intervalId);
          socket.disconnect();
        };
      } else {
        // Geolocation watchPosition
        let watchId: number | null = null;
        let emitInterval: NodeJS.Timeout | null = null;
        let currentPos = { lat: tailorCoords.lat, lng: tailorCoords.lng };

        if (typeof navigator !== "undefined" && navigator.geolocation) {
          watchId = navigator.geolocation.watchPosition(
            (position) => {
              const newPos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              currentPos = newPos;
              setLiveCoords(newPos);
              liveCoordsRef.current = newPos;

              if (tailorMarkerRef.current) {
                tailorMarkerRef.current.setLatLng([newPos.lat, newPos.lng]);
              }
              if (mapRef.current) {
                mapRef.current.panTo([newPos.lat, newPos.lng], { animate: true });
              }

              // Update HUD distance/ETA
              const dist = calculateDistance(newPos.lat, newPos.lng, customerCoords.lat, customerCoords.lng);
              setDistance(Number(dist.toFixed(2)));
              const speed = 24;
              const etaMins = Math.max(1, Math.round((dist / speed) * 60));
              setEta(etaMins);
              setCourierSpeed(speed);
              setCourierStatus("GPS tracking active (broadcasting live coordinates)");

              // Emit update immediately
              socket.emit("update-location", {
                bookingId,
                lat: newPos.lat,
                lng: newPos.lng,
              });
            },
            (error) => {
              // Handle permission or timeout warnings gracefully without raising a console error
              console.warn("GPS watchPosition warning:", error.message || error);
              
              if (error.code === 1) { // PERMISSION_DENIED
                setCourierStatus("GPS permission denied. Please allow location access or start Mock Simulation.");
              } else if (error.code === 3) { // TIMEOUT
                // Timeouts are common indoors on desktop browsers, simply log and retry
                console.log("GPS search timed out. Retrying...");
              } else {
                setCourierStatus("GPS unavailable. Use Mock Simulation.");
              }
            },
            {
              enableHighAccuracy: false, // Set to false to support Wi-Fi/IP location indoors and on desktops
              timeout: 30000,            // 30 seconds timeout
              maximumAge: 5000,          // Allow cached positions up to 5 seconds old
            }
          );
        }

        // Emit coordinates periodically to ensure live heartbeat
        emitInterval = setInterval(() => {
          socket.emit("update-location", {
            bookingId,
            lat: currentPos.lat,
            lng: currentPos.lng,
          });
        }, 4000);

        return () => {
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          if (emitInterval !== null) clearInterval(emitInterval);
          socket.disconnect();
        };
      }
    } else {
      // Customer receives coordinates
      socket.on("location-updated", (data: { lat: number; lng: number }) => {
        console.log("Customer received live coordinates update:", data);
        setLiveCoords(data);
        liveCoordsRef.current = data;

        // Dynamically update marker on map
        if (tailorMarkerRef.current) {
          tailorMarkerRef.current.setLatLng([data.lat, data.lng]);
        }
        if (mapRef.current) {
          mapRef.current.panTo([data.lat, data.lng], { animate: true });
        }

        // Calculate actual distance and ETA
        const dist = calculateDistance(data.lat, data.lng, customerCoords.lat, customerCoords.lng);
        setDistance(Number(dist.toFixed(2)));
        const speed = 24; // km/h average
        const etaMins = Math.max(1, Math.round((dist / speed) * 60));
        setEta(etaMins);
        setCourierSpeed(speed);
        setCourierStatus("Live coordinates updated in real-time");
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [bookingId, role, isSimulatingGps]);

  // Leaflet initialization
  useEffect(() => {
    let isMounted = true;
    let mapInstance: any = null;
    let L: any = null;
    let animationInterval: any = null;

    async function initLeaflet() {
      if (typeof window === "undefined") return;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!(window as any).L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      L = (window as any).L;

      if (!isMounted || !L) return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error(e);
        }
      }

      const initialTailorCoords = liveCoordsRef.current || tailorCoords;

      const mapCenter = [
        (customerCoords.lat + initialTailorCoords.lat) / 2,
        (customerCoords.lng + initialTailorCoords.lng) / 2,
      ];

      mapInstance = L.map(mapContainerId, {
        center: mapCenter,
        zoom: 13,
        zoomControl: false,
      });
      mapRef.current = mapInstance;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapInstance);

      const tailorIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div class="relative flex items-center justify-center h-10 w-10">
                <span class="absolute h-10 w-10 rounded-full bg-purple-500/30 animate-ping"></span>
                <div class="h-7 w-7 rounded-full bg-gradient-to-tr from-[#d779f4] to-[#c322f4] text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">🛵</div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const customerIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div class="relative flex items-center justify-center h-10 w-10">
                <span class="absolute h-8 w-8 rounded-full bg-amber-500/20 animate-pulse"></span>
                <div class="h-6 w-6 rounded-full bg-gradient-to-tr from-[#d2a22e] to-amber-500 text-white flex items-center justify-center shadow-lg border-2 border-white text-[10px] font-bold">🏠</div>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      customerMarkerRef.current = L.marker([customerCoords.lat, customerCoords.lng], {
        icon: customerIcon,
      })
        .addTo(mapInstance)
        .bindPopup("Your Location");

      tailorMarkerRef.current = L.marker([initialTailorCoords.lat, initialTailorCoords.lng], {
        icon: tailorIcon,
      }).addTo(mapInstance);

      // Generate visual routing line
      const latDiff = customerCoords.lat - tailorCoords.lat;
      const lngDiff = customerCoords.lng - tailorCoords.lng;
      const routePoints = [];
      const segments = 25;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let lat = tailorCoords.lat + latDiff * t;
        let lng = tailorCoords.lng + lngDiff * t;

        if (i > 0 && i < segments) {
          const sineFactor = Math.sin(t * Math.PI * 2.5);
          lat += sineFactor * 0.0018;
          lng += Math.cos(t * Math.PI * 1.5) * 0.0018;
        }
        routePoints.push([lat, lng]);
      }

      routePolylineRef.current = L.polyline(routePoints, {
        color: "#c322f4",
        weight: 4,
        opacity: 0.6,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(mapInstance);

      mapInstance.fitBounds(routePolylineRef.current.getBounds(), {
        padding: [40, 40],
      });

      const s = String(status || "").toLowerCase().trim();

      if (s === "booked") {
        setCourierStatus("Tailor heading to your address for pickup");
        animateCourier(routePoints, false);
      } else if (s === "picked-up") {
        setCourierStatus("Courier transporting fabric to Stitch Workshop");
        animateCourier(routePoints.slice().reverse(), false);
      } else if (s === "out-for-delivery") {
        setCourierStatus("Courier out for delivery of your custom garment");
        animateCourier(routePoints, true);
      } else if (s === "in-stitching") {
        setCourierStatus("Garment in production at Stitch Workshop");
        tailorMarkerRef.current.setLatLng([tailorCoords.lat, tailorCoords.lng]);
        setEta(0);
        setDistance(0);
      } else if (s === "ready") {
        setCourierStatus("Finished garment ready for delivery scheduling");
        tailorMarkerRef.current.setLatLng([tailorCoords.lat, tailorCoords.lng]);
        setEta(0);
        setDistance(0);
      } else if (s === "delivered") {
        setCourierStatus("Garment delivered successfully");
        tailorMarkerRef.current.setLatLng([customerCoords.lat, customerCoords.lng]);
        setEta(0);
        setDistance(0);
      } else {
        setCourierStatus("Awaiting tailor partner confirmation");
        tailorMarkerRef.current.setLatLng([tailorCoords.lat, tailorCoords.lng]);
        setEta(0);
        setDistance(0);
      }

      function animateCourier(points: any[], isFinalDelivery: boolean) {
        let currentStep = 0;
        const speed = Math.floor(20 + Math.random() * 15);
        setCourierSpeed(speed);

        animationInterval = setInterval(() => {
          if (!isMounted) return;
          // If real-time live GPS coords are being received, stop the client-side mock loop
          if (liveCoordsRef.current !== null) {
            clearInterval(animationInterval);
            return;
          }

          if (currentStep >= points.length) {
            if (isFinalDelivery) {
              setCourierStatus("Delivered successfully");
              setDistance(0);
              setEta(0);
              tailorMarkerRef.current.setLatLng(points[points.length - 1]);
            } else {
              currentStep = 0;
            }
            return;
          }

          const currentPoint = points[currentStep];
          tailorMarkerRef.current.setLatLng(currentPoint);

          if (mapInstance && currentStep % 3 === 0) {
            mapInstance.panTo(currentPoint, { animate: true });
          }

          const remainingSteps = points.length - 1 - currentStep;
          const totalDistance = 3.2;
          const remDistance = Math.max(0.1, Number(((remainingSteps / points.length) * totalDistance).toFixed(1)));
          const remEta = Math.max(1, Math.round((remDistance / speed) * 60 + 2));

          setDistance(remDistance);
          setEta(remEta);
          currentStep++;
        }, 3000);
      }
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (animationInterval) clearInterval(animationInterval);
    };
  }, [status, pickupLocation, dropoffLocation]);

  const showTransitStats = ["booked", "picked-up", "out-for-delivery"].includes(
    String(status || "").toLowerCase().trim()
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col h-full space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Live Delivery Route</h4>
          <p className="text-[10px] text-purple-600 font-semibold uppercase mt-0.5">{courierStatus}</p>
        </div>

        {showTransitStats && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-purple-50 text-[#c322f4] border border-purple-100 animate-pulse">
            ⚡ LIVE TRACKING ACTIVE
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative flex-1 min-h-[300px] rounded-xl border border-gray-100 shadow-inner overflow-hidden">
        <div id={mapContainerId} className="absolute inset-0 z-10 w-full h-full" />

        {/* Live GPS test simulation controller for tailors */}
        {role === "tailor" && (
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-purple-100 shadow-lg max-w-[220px] text-xs space-y-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${isSimulatingGps ? "bg-emerald-500 animate-ping" : "bg-gray-400"}`} />
              <span className="font-extrabold text-gray-800 uppercase tracking-wide">GPS Broadcaster</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-snug">
              {isSimulatingGps 
                ? "Simulating driving and broadcasting coordinates to client." 
                : "Awaiting live tracking broadcast or start mock simulation."}
            </p>
            <button
              onClick={() => setIsSimulatingGps(!isSimulatingGps)}
              className={`w-full py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                isSimulatingGps 
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-sm" 
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02] text-white shadow-md shadow-purple-200"
              }`}
            >
              {isSimulatingGps ? "Stop Mock Simulation" : "Start GPS Simulation"}
            </button>
          </div>
        )}
      </div>

      {/* HUD metrics dashboard */}
      <div className="grid grid-cols-3 gap-2.5 bg-slate-50 border border-slate-100 p-3 rounded-xl text-center text-xs">
        <div className="space-y-0.5">
          <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Remaining ETA</span>
          <span className="text-sm font-black text-gray-900 leading-none">
            {showTransitStats ? `${eta} mins` : "--"}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Distance</span>
          <span className="text-sm font-black text-gray-900 leading-none">
            {showTransitStats ? `${distance} km` : "--"}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Courier Speed</span>
          <span className="text-sm font-black text-gray-900 leading-none">
            {showTransitStats ? `${courierSpeed} km/h` : "--"}
          </span>
        </div>
      </div>
    </div>
  );
}
