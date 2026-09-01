"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapLibreMap,
  NavigationControl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BosphorusGeo } from "@/lib/map/geo";
import type { VesselRecord } from "@/lib/supabase/database.types";
import { boxesGeoJson, vesselsGeoJson } from "@/components/map/geojson";

const CYAN = "#22d3ee";
const GOLD = "#eab308";
const PANEL = "#0e1620";

function cartoTileUrls(cartoApiKey?: string): string[] {
  const key = cartoApiKey?.trim();
  const query = key ? `?key=${encodeURIComponent(key)}` : "";
  // Authenticated raster endpoint — see https://docs.carto.com/faqs/carto-basemaps
  return [
    `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${query}`,
  ];
}

function buildStyle(cartoApiKey?: string): StyleSpecification {
  return {
    version: 8,
    // Free public glyph server so the box/point labels below have SDF fonts
    // to render against (no key required).
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      "carto-dark": {
        type: "raster",
        tiles: cartoTileUrls(cartoApiKey),
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "basemap", type: "raster", source: "carto-dark" }],
  };
}

function boundsFromBox(box: BosphorusGeo["approaches"]): LngLatBoundsLike {
  return [
    [box.swLon, box.swLat],
    [box.neLon, box.neLat],
  ];
}

export function BosphorusMapView({
  geo,
  vessels,
  cartoApiKey,
  className,
}: {
  geo: BosphorusGeo;
  vessels: VesselRecord[];
  cartoApiKey?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loadedRef = useRef(false);
  const [status, setStatus] = useState<string>("initializing map…");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Guards against the async `load`/`error` callbacks firing after this
    // effect instance has been torn down (React Strict Mode double-invokes
    // effects in dev; without this, a stale instance's late callback can
    // throw when touching an already-removed map and never even surface).
    let disposed = false;

    // Defensive: if a previous instance's `map.remove()` left any canvas
    // behind (Strict Mode double-invoke edge case), a stray canvas sitting
    // on top would visually hide the new, fully-working map underneath even
    // though the new instance reports success. Force a clean container.
    container.innerHTML = "";

    const map = new MapLibreMap({
      container,
      style: buildStyle(cartoApiKey),
      bounds: boundsFromBox(geo.approaches),
      fitBoundsOptions: { padding: 32 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const { strait, approaches, labels, point } = boxesGeoJson(geo);

    map.on("error", (e) => {
      const message = e.error?.message ?? String(e.error ?? "unknown map error");
      console.error("[BosphorusMapView] maplibre error", e.error ?? e);
      if (!disposed) setStatus(`map error: ${message}`);
    });

    map.on("load", () => {
      if (disposed) return;
      try {
        map.addSource("strait-box", { type: "geojson", data: strait });
        map.addSource("approaches-box", { type: "geojson", data: approaches });
        map.addSource("box-labels", { type: "geojson", data: labels });
        map.addSource("sample-point", { type: "geojson", data: point });
        map.addSource("vessels", { type: "geojson", data: vesselsGeoJson(vessels) });

        map.addLayer({
          id: "approaches-fill",
          type: "fill",
          source: "approaches-box",
          paint: { "fill-color": CYAN, "fill-opacity": 0.08 },
        });
        map.addLayer({
          id: "approaches-line",
          type: "line",
          source: "approaches-box",
          paint: {
            "line-color": CYAN,
            "line-width": 2.5,
            "line-dasharray": [2, 2],
            "line-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "strait-fill",
          type: "fill",
          source: "strait-box",
          paint: { "fill-color": CYAN, "fill-opacity": 0.18 },
        });
        map.addLayer({
          id: "strait-line",
          type: "line",
          source: "strait-box",
          paint: { "line-color": CYAN, "line-width": 3 },
        });
        map.addLayer({
          id: "box-labels",
          type: "symbol",
          source: "box-labels",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 11,
            "text-anchor": "bottom-left",
            "text-offset": [0.3, -0.3],
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": CYAN,
            "text-halo-color": PANEL,
            "text-halo-width": 1.4,
          },
        });
        map.addLayer({
          id: "vessels-dots",
          type: "circle",
          source: "vessels",
          paint: {
            "circle-radius": 5,
            "circle-color": "#e8f4f8",
            "circle-stroke-color": CYAN,
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "sample-point-halo",
          type: "circle",
          source: "sample-point",
          paint: {
            "circle-radius": 14,
            "circle-color": GOLD,
            "circle-opacity": 0.25,
          },
        });
        map.addLayer({
          id: "sample-point-dot",
          type: "circle",
          source: "sample-point",
          paint: {
            "circle-radius": 6,
            "circle-color": GOLD,
            "circle-stroke-color": PANEL,
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "sample-point-label",
          type: "symbol",
          source: "sample-point",
          layout: {
            "text-field": ["get", "label"],
            "text-size": 11,
            "text-anchor": "left",
            "text-offset": [0.9, 0],
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": GOLD,
            "text-halo-color": PANEL,
            "text-halo-width": 1.4,
          },
        });

        map.fitBounds(boundsFromBox(geo.approaches), { padding: 32, duration: 0 });
        map.resize();
        map.triggerRepaint();
        loadedRef.current = true;
        if (!disposed) {
          const canvasCount = container.querySelectorAll("canvas").length;
          const rect = container.getBoundingClientRect();
          const straitRing = strait.features[0]?.geometry.coordinates[0]?.[0];
          setStatus(
            `${map.getStyle().layers.length} layers · ${canvasCount} canvas(es) · ` +
              `${Math.round(rect.width)}x${Math.round(rect.height)}px · ` +
              `strait[0]=[${straitRing?.[0]},${straitRing?.[1]}] · ` +
              `zoom=${map.getZoom().toFixed(2)}`,
          );
        }
      } catch (error) {
        console.error("[BosphorusMapView] failed to add overlay layers", error);
        if (!disposed) {
          setStatus(
            `overlay failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });

    const resize = () => map.resize();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      loadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // geo is server-derived and static for the lifetime of the page; only
    // `vessels` updates live, handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource("vessels") as GeoJSONSource | undefined;
    source?.setData(vesselsGeoJson(vessels));
  }, [vessels]);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={containerRef}
        className={
          className ??
          "h-64 w-full overflow-hidden rounded-xl border border-border sm:h-80 md:h-[420px]"
        }
      />
      <p className="font-mono text-[10px] text-muted">{status}</p>
    </div>
  );
}
