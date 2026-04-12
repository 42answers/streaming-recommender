-- Stream Finder NL: Supabase schema
-- Run this in the Supabase SQL Editor

CREATE TABLE titles (
  id              SERIAL PRIMARY KEY,
  tmdb_id         INTEGER NOT NULL UNIQUE,
  imdb_id         TEXT,
  media_type      TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title           TEXT NOT NULL,
  year            TEXT,
  overview        TEXT,
  plot            TEXT,
  poster_url      TEXT,
  rt_score        INTEGER,
  imdb_rating     NUMERIC(3,1),
  tmdb_vote_avg   NUMERIC(3,1),
  genre_ids       INTEGER[],
  genre_names     TEXT,
  language        TEXT,
  awards          TEXT,
  provider_ids    INTEGER[],
  provider_names  TEXT[],
  claude_review   TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_titles_media_type ON titles(media_type);
CREATE INDEX idx_titles_providers ON titles USING GIN(provider_ids);
CREATE INDEX idx_titles_genre_ids ON titles USING GIN(genre_ids);
CREATE INDEX idx_titles_tmdb_vote ON titles(tmdb_vote_avg DESC NULLS LAST);
CREATE INDEX idx_titles_imdb_rating ON titles(imdb_rating DESC NULLS LAST);
CREATE INDEX idx_titles_rt_score ON titles(rt_score DESC NULLS LAST);
CREATE INDEX idx_titles_title ON titles(title);
CREATE INDEX idx_titles_year ON titles(year);

-- Full-text search for title matching (used by "similar to")
ALTER TABLE titles ADD COLUMN title_search tsvector
  GENERATED ALWAYS AS (to_tsvector('english', title)) STORED;
CREATE INDEX idx_titles_fts ON titles USING GIN(title_search);
