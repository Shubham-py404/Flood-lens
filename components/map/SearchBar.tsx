'use client';

import React, { useState } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';

interface SearchBarProps {
  onLocationSelect: (lng: number, lat: number, displayName: string) => void;
  className?: string;
  placeholder?: string;
}

export default function SearchBar({
  onLocationSelect,
  className = '',
  placeholder = 'Search street, area, or landmark...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setIsOpen(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=6&countrycodes=in`
      );
      const data = await res.json();
      setResults(data);

      // If user pressed Enter directly and there is at least one result, auto-select first
      if (data && data.length > 0) {
        handleSelect(data[0]);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    onLocationSelect(lon, lat, item.display_name || item.name);
    setQuery(item.name || item.display_name.split(',')[0]);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input Box */}
      <form
        onSubmit={handleSearch}
        className="relative bg-white/90 backdrop-blur-xl rounded-full shadow-md border border-[#e2e0d8] flex items-center px-4.5 py-3 sm:py-3.5 transition-all focus-within:ring-2 focus-within:ring-[#3a7d5c]/25 focus-within:border-[#3a7d5c] focus-within:bg-white"
      >
        <Search className="w-5 h-5 text-[#617469] mr-3 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length === 0) setIsOpen(false);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-[#1c2621] text-sm font-medium placeholder:text-[#87968e]"
        />
        {loading ? (
          <Loader2 className="w-4.5 h-4.5 text-[#3a7d5c] animate-spin shrink-0 ml-2" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="p-1 hover:bg-[#edebe4] rounded-full text-[#77887e] ml-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-[#e2e0d8] overflow-hidden z-50 animate-in fade-in duration-150">
          <ul className="divide-y divide-[#edebe4]/70 max-h-56 overflow-y-auto no-scrollbar">
            {results.map((item, idx) => (
              <li
                key={idx}
                onClick={() => handleSelect(item)}
                className="px-3.5 py-2.5 hover:bg-[#f6f5f0] cursor-pointer flex items-start gap-2.5 transition-colors text-left"
              >
                <MapPin className="w-3.5 h-3.5 text-[#3a7d5c] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#1c2621] truncate">
                    {item.name || item.display_name.split(',')[0]}
                  </div>
                  <div className="text-[10px] text-[#77887e] truncate mt-0.5">
                    {item.display_name}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-[#e2e0d8] p-3 text-center text-xs text-[#77887e] z-50">
          No locations found.
        </div>
      )}
    </div>
  );
}