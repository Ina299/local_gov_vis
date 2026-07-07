'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

export interface SearchEntry {
  code: string;
  name: string;
  prefCode?: string;
  prefName?: string;
}

interface SearchBoxProps {
  entries: SearchEntry[];
  onSelect: (entry: SearchEntry) => void;
}

const MAX_RESULTS = 8;

export function SearchBox({ entries, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    // 前方一致を優先し、部分一致で補完する
    const starts: SearchEntry[] = [];
    const includes: SearchEntry[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(q)) {
        starts.push(entry);
      } else if (entry.name.includes(q) || (entry.prefName ?? '').includes(q)) {
        includes.push(entry);
      }
      if (starts.length >= MAX_RESULTS) break;
    }
    return [...starts, ...includes].slice(0, MAX_RESULTS);
  }, [entries, query]);

  // 外側クリックで閉じる
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const select = (entry: SearchEntry) => {
    setQuery('');
    setOpen(false);
    onSelect(entry);
  };

  return (
    <div className="search-box" ref={rootRef}>
      <input
        type="text"
        className="search-input"
        placeholder="都道府県・市区町村を検索"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && results[activeIndex]) {
            select(results[activeIndex]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        aria-label="自治体検索"
      />
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((entry, index) => (
            <li
              key={entry.code}
              className={`search-result ${index === activeIndex ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                select(entry);
              }}
            >
              {entry.name}
              {entry.prefName && <span className="search-result-pref">{entry.prefName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
