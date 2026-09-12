import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api, { unwrap } from '@/lib/api';
import type { Resident, ResidentStatus } from '@/lib/types';

const statusBadge: Record<ResidentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  vacated: 'bg-red-100 text-red-700',
  transferred: 'bg-yellow-100 text-yellow-700',
};

export default function ResidentSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useQuery({
    queryKey: ['residents', 'search', debouncedQuery],
    queryFn: async () =>
      unwrap<Resident[]>(
        await api.get('/residents/search', {
          params: { q: debouncedQuery },
        }),
      ),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Search Residents</h1>

      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a name or phone number to search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-300 py-3 pl-12 pr-4 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Results */}
      {debouncedQuery.length < 2 && (
        <p className="text-sm text-gray-400 text-center py-8">
          Enter at least 2 characters to search
        </p>
      )}

      {isLoading && debouncedQuery.length >= 2 && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!isLoading && results && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          No residents found for &ldquo;{debouncedQuery}&rdquo;
        </p>
      )}

      {!isLoading && results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/residents/${r.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {r.fullName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.phone ?? 'No phone'}
                    {r.email && ` · ${r.email}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {r.bed && (
                    <span className="text-xs text-gray-500">
                      {r.bed.room?.roomNumber ?? ''} / {r.bed.bedLabel}
                    </span>
                  )}
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusBadge[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
