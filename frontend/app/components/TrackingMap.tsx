"use client";

import { useEffect, useRef, useState } from "react";

type TrackingMapProps = {
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  tailorName?: string | null;
};

export default function TrackingMap({
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

  useEffect(() => {
    let isMounted = true;
    let mapInstance: any = null;
    let L: any = null;
    let animationInterval: any = null;

    // Load Leaflet dynamically
    async function initLeaflet() {
      if (typeof window === "undefined") return;

      // Append CSS link
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Wait for window.L or load script
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

      // Clean up existing map instance if any
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.error(e);
        }
      }

      // Initialize Map
      const mapCenter = [
        (customerCoords.lat + tailorCoords.lat) / 2,
        (customerCoords.lng + tailorCoords.lng) / 2,
      ];

      mapInstance = L.map(mapContainerId, {
        center: mapCenter,
        zoom: 13,
        zoomControl: false,
      });
      mapRef.current = mapInstance;

      // OpenStreetMap Map Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapInstance);

      // Create Custom Icons using SVG
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

      // Markers
      customerMarkerRef.current = L.marker([customerCoords.lat, customerCoords.lng], {
        icon: customerIcon,
      })
        .addTo(mapInstance)
        .bindPopup("Your Location");

      tailorMarkerRef.current = L.marker([tailorCoords.lat, tailorCoords.lng], {
        icon: tailorIcon,
      }).addTo(mapInstance);

      // Connect tailor and customer via simulated road route (polylines)
      // Create a wavy simulated route
      const latDiff = customerCoords.lat - tailorCoords.lat;
      const lngDiff = customerCoords.lng - tailorCoords.lng;
      const routePoints = [];
      const segments = 25;

      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        // Linear path
        let lat = tailorCoords.lat + latDiff * t;
        let lng = tailorCoords.lng + lngDiff * t;
        
        // Add waving offset for actual street curve feeling
        if (i > 0 && i < segments) {
          const sineFactor = Math.sin(t * Math.PI * 2.5);
          lat += sineFactor * 0.0018;
          lng += Math.cos(t * Math.PI * 1.5) * 0.0018;
        }
        routePoints.push([lat, lng]);
      }

      // Draw route line
      routePolylineRef.current = L.polyline(routePoints, {
        color: "#c322f4",
        weight: 4,
        opacity: 0.6,
        dashArray: "8, 8",
        lineCap: "round",
      }).addTo(mapInstance);

      // Fit map bounds
      mapInstance.fitBounds(routePolylineRef.current.getBounds(), {
        padding: [40, 40],
      });

      // Route animation based on status
      const s = String(status || "").toLowerCase().trim();
      
      if (s === "booked") {
        // Tailor partner heading towards customer for pickup
        setCourierStatus("Tailor heading to your address for pickup");
        animateCourier(routePoints, false);
      } else if (s === "picked-up") {
        // Tailor returning to workshop with fabric
        setCourierStatus("Courier transporting fabric to Stitch Workshop");
        animateCourier(routePoints.slice().reverse(), false);
      } else if (s === "out-for-delivery") {
        // Tailor delivering finished garment to customer
        setCourierStatus("Courier out for delivery of your custom garment");
        animateCourier(routePoints, true);
      } else if (s === "in-stitching") {
        setCourierStatus("Garment in production at Stitch Workshop");
        // Courier stays at workshop
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
          if (currentStep >= points.length) {
            // Loop simulator or hold at destination
            if (isFinalDelivery) {
              setCourierStatus("Delivered successfully");
              setDistance(0);
              setEta(0);
              tailorMarkerRef.current.setLatLng(points[points.length - 1]);
            } else {
              // Reset to simulate continuous travel
              currentStep = 0;
            }
            return;
          }

          const currentPoint = points[currentStep];
          tailorMarkerRef.current.setLatLng(currentPoint);

          // Pan map to follow courier gently
          if (mapInstance && currentStep % 3 === 0) {
            mapInstance.panTo(currentPoint, { animate: true });
          }

          // Calculate remaining distance
          const remainingSteps = points.length - 1 - currentStep;
          const totalDistance = 3.2; // km base
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
