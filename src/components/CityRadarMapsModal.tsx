import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  Search,
  Sparkles,
  X,
  ExternalLink,
  Bookmark,
  Check,
  Building,
  Coffee,
  Camera,
  Music,
  Share2,
} from 'lucide-react';
import { UserAccount } from '../types/blin';
import { apiRequest } from '../lib/api';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface CityRadarMapsModalProps {
  user: UserAccount;
  onClose: () => void;
}

const POPULAR_CITIES = ['Tokyo, Japan', 'London, UK', 'New York, USA', 'Kampala, Uganda', 'Paris, France', 'Berlin, Germany', 'Nairobi, Kenya'];
const QUICK_QUERIES = [
  'Aesthetic matcha & creator cafes',
  'Late night underground vinyl lounges',
  'Urban street art & photography spots',
  'Co-working spaces with high speed wifi',
];

interface FoundSpot {
  name: string;
  address: string;
  category: string;
  vibe: string;
  mapsUrl: string;
}

export function CityRadarMapsModal({ user, onClose }: CityRadarMapsModalProps) {
  const [query, setQuery] = useState('Aesthetic matcha & creator cafes');
  const [city, setCity] = useState('Tokyo, Japan');
  const [searching, setSearching] = useState(false);
  const [resultText, setResultText] = useState<string>('');
  const [savedSpots, setSavedSpots] = useState<Set<string>>(new Set());

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      const res = await apiRequest<{
        reply: string;
        candidates?: any[];
      }>('/api/ai/maps-grounding', {
        method: 'POST',
        body: JSON.stringify({
          query: query.trim(),
          locationContext: city,
        }),
      });

      setResultText(res.reply);
    } catch (err: any) {
      console.error('Maps Grounding error:', err);
      setResultText('Unable to retrieve places at this time. Please try another search.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSavePlace(name: string, address: string, category: string) {
    try {
      await addDoc(collection(db, 'saved_places'), {
        userId: user.id,
        placeName: name,
        formattedAddress: address,
        category: category || 'Creator Spot',
        summary: `Saved from BLiN City Radar in ${city}`,
        createdAt: new Date().toISOString(),
      });
      setSavedSpots((prev) => new Set(prev).add(name));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'saved_places');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#08061a]/95 border border-cyan-500/30 rounded-3xl shadow-2xl p-5 sm:p-7 space-y-5 text-white max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="font-display font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
                BLiN City Radar
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                  Google Maps Grounding
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Discover real creator spots & underground hangouts powered by Gemini 3.8 Flash + Google Maps
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* City Filter Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Target City / Region:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_CITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCity(c)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  city === c
                    ? 'bg-cyan-500/30 border-cyan-400 text-white font-bold'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                📍 {c}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search spots, vibes, creator studios, cafes..."
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#060417] border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-display font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 disabled:opacity-50"
          >
            {searching ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
            <span>Scan Spots</span>
          </button>
        </form>

        {/* Quick query chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQuery(q);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Grounded Results Output */}
        {resultText ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs text-cyan-300 font-bold border-b border-white/10 pb-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                Google Maps Grounded Locations in {city}
              </span>
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(query + ' in ' + city)}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 underline"
              >
                Open in Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-4 rounded-2xl bg-[#060417] border border-white/10 text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
              {resultText}
            </div>

            {/* Quick action to save to Firestore */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-300">Save this scouted location list to your Firebase cloud account:</span>
              <button
                type="button"
                onClick={() => handleSavePlace(query, `${city} area`, 'Scouted Places')}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold flex items-center gap-1.5 border border-cyan-500/40"
              >
                {savedSpots.has(query) ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved in Firestore!</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Save to My Radar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#060417] border border-white/10 text-center space-y-2">
            <MapPin className="w-8 h-8 text-cyan-400/60 mx-auto" />
            <p className="text-sm font-bold text-slate-200">Ready to explore real-world creator hubs</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click &quot;Scan Spots&quot; to fetch real-world locations grounded with Google Maps data for {city}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
