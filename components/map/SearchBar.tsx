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
        )}&limit=5&countrycodes=in`
      );
      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: any) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);

    onLocationSelect(lon, lat, item.display_name);
    setQuery(item.name || item.display_name.split(',')[0]);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input Box */}
      <form
        onSubmit={handleSearch}
        className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/90 flex items-center px-3.5 py-2.5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500"
      >
        <Search className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length === 0) setIsOpen(false);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none text-slate-800 text-xs font-medium placeholder:text-slate-400"
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0 ml-1.5" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 ml-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </form>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in duration-150">
          <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto no-scrollbar">
            {results.map((item, idx) => (
              <li
                key={idx}
                onClick={() => handleSelect(item)}
                className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer flex items-start gap-2.5 transition-colors text-left"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {item.name || item.display_name.split(',')[0]}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {item.display_name}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && results.length === 0 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 text-center text-xs text-slate-500 z-50">
          No locations found.
        </div>
      )}
    </div>
  );
}