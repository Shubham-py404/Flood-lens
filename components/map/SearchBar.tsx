'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Navigation } from 'lucide-react';

export interface SearchResultItem {
  place_id: number | string;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  distance_km?: number;
}

interface SearchBarProps {
  onLocationSelect: (lng: number, lat: number, displayName: string) => void;
  className?: string;
  placeholder?: string;
  userCoords?: { lat: number; lng: number } | null;
}

export default function SearchBar({
  onLocationSelect,
  className = '',
  placeholder = 'Search street, area, or landmark...',
  userCoords,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Live auto-suggestions as user types with debounce and user coordinate bias
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let url = `/api/geo/search?q=${encodeURIComponent(trimmed)}`;
        if (userCoords && userCoords.lat && userCoords.lng) {
          url += `&lat=${userCoords.lat}&lng=${userCoords.lng}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setIsOpen(true);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Location autocomplete search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, userCoords]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setLoading(false);
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const primaryName = item.name || item.display_name?.split(',')[0] || query;

    onLocationSelect(lon, lat, item.display_name || item.name || primaryName);
    setQuery(primaryName);
    setIsOpen(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <form
        onSubmit={handleFormSubmit}
        className="relative bg-white/95 backdrop-blur-xl rounded-full shadow-lg border border-[#e2e0d8] flex items-center px-4 py-2.5 sm:py-3 transition-all focus-within:ring-2 focus-within:ring-[#244837]/30 focus-within:border-[#244837] focus-within:bg-white"
      >
        <Search className="w-5 h-5 text-[#405448] mr-2.5 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-[#1c2621] text-sm font-medium placeholder:text-[#87968e]"
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-[#244837] animate-spin shrink-0 ml-2" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="p-1 hover:bg-[#edebe4] rounded-full text-[#77887e] ml-2 transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </form>

      {/* Live Suggestions Dropdown Sorted Top to Bottom from Closest to Farthest */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/98 backdrop-blur-2xl rounded-2xl shadow-2xl border border-[#e2e0d8] overflow-hidden z-50 animate-in fade-in duration-150 max-w-full">
          {results.length > 0 ? (
            <ul className="divide-y divide-[#edebe4]/70 max-h-64 sm:max-h-72 overflow-y-auto no-scrollbar">
              {results.map((item, idx) => {
                const parts = item.display_name?.split(',') || [];
                const mainTitle = item.name || parts[0]?.trim();
                const subTitle = parts.slice(1).join(',').trim();

                // Format distance display
                const distFormatted =
                  item.distance_km !== undefined && item.distance_km < 9999
                    ? item.distance_km < 1
                      ? `${Math.round(item.distance_km * 1000)}m`
                      : `${item.distance_km} km`
                    : null;

                return (
                  <li
                    key={item.place_id || idx}
                    onClick={() => handleSelect(item)}
                    className="px-4 py-3 hover:bg-[#f4f3ef] active:bg-[#edebe4] cursor-pointer flex items-center justify-between gap-3 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-1.5 rounded-xl bg-[#e8efe9] text-[#244837] shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-[#1c2621] truncate">
                          {mainTitle}
                        </div>
                        {subTitle && (
                          <div className="text-[11px] text-[#55695d] truncate mt-0.5 leading-normal">
                            {subTitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Proximity Pill Indicator (Closest to Farthest) */}
                    {distFormatted && (
                      <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full bg-[#f0f4f1] border border-[#d6e2d9] text-[11px] font-bold text-[#244837]">
                        <Navigation className="w-3 h-3 text-[#3a7d5c]" />
                        <span>{distFormatted}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : !loading && query.trim().length >= 2 ? (
            <div className="p-4 text-center text-xs text-[#77887e]">
              No matching locations found for &ldquo;{query}&rdquo;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}