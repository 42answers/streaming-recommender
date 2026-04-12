#!/usr/bin/env node
/**
 * Stream Finder NL — Database Population Script
 *
 * Crawls TMDB for all titles available on Dutch streaming platforms,
 * enriches with OMDb data, generates Claude reviews, and inserts into Supabase.
 *
 * Usage:
 *   node scripts/populate-db.js                  # Run all phases
 *   node scripts/populate-db.js --phase discover  # Only TMDB discovery
 *   node scripts/populate-db.js --phase omdb      # Only OMDb enrichment
 *   node scripts/populate-db.js --phase reviews   # Only Claude reviews
 *   node scripts/populate-db.js --phase upload    # Only upload to Supabase
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), override: true });
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");
const { RateLimiter } = require("./rate-limiter");

// ─── Config ──────────────────────────────────────────────────
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const TMDB_BASE = "https://api.themoviedb.org/3";

const PROVIDER_IDS = [8, 119, 337, 1899, 72]; // Netflix, Amazon, Disney+, HBO Max, Videoland
const PROVIDER_NAMES = {
  8: "Netflix", 119: "Amazon Prime", 337: "Disney+",
  1899: "HBO Max", 72: "Videoland",
};

const TMDB_GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
  53: "Thriller", 10752: "War", 37: "Western",
};

const TV_GENRES = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  10762: "Kids", 9648: "Mystery", 10765: "Sci-Fi & Fantasy",
  10768: "War & Politics", 37: "Western",
};

// Rate limiters
const tmdbLimiter = new RateLimiter(35, 10000); // 35 req per 10s (safe margin)
const omdbLimiter = new RateLimiter(8, 1000);    // 8 req/sec for paid tier

// Checkpoint file paths
const CHECKPOINT_DIR = path.join(__dirname, "..", "data");
const DISCOVER_FILE = path.join(CHECKPOINT_DIR, "discover.json");
const ENRICHED_FILE = path.join(CHECKPOINT_DIR, "enriched.json");
const REVIEWS_FILE = path.join(CHECKPOINT_DIR, "reviews.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCheckpoint(filepath) {
  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  }
  return null;
}

function saveCheckpoint(filepath, data) {
  ensureDir(CHECKPOINT_DIR);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ─── TMDB helpers ────────────────────────────────────────────
async function tmdbFetch(endpoint, params = {}) {
  await tmdbLimiter.wait();
  params.api_key = TMDB_API_KEY;
  const qs = new URLSearchParams(params).toString();
  const url = `${TMDB_BASE}${endpoint}?${qs}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 429) {
      // Rate limited — wait and retry
      console.log("    TMDB rate limited, waiting 10s...");
      await new Promise((r) => setTimeout(r, 10000));
      return tmdbFetch(endpoint, params);
    }
    throw new Error(`TMDB ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}

async function omdbFetch(imdbId) {
  await omdbLimiter.wait();
  const url = `http://www.omdbapi.com/?i=${imdbId}&apikey=${OMDB_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 401) {
      const body = await resp.json();
      if (body.Error && body.Error.includes("limit")) {
        console.log("\n  OMDb daily limit reached! Save checkpoint and resume tomorrow.");
        return null;
      }
    }
    throw new Error(`OMDb ${resp.status}`);
  }
  return resp.json();
}

// ─── Phase 1: TMDB Discovery ────────────────────────────────
async function phaseDiscover() {
  console.log("\n=== PHASE 1: TMDB Discovery ===\n");

  const titles = new Map(); // tmdb_id -> title data

  for (const providerId of PROVIDER_IDS) {
    for (const mediaType of ["movie", "tv"]) {
      const providerName = PROVIDER_NAMES[providerId];
      console.log(`  Discovering ${mediaType} on ${providerName}...`);

      let page = 1;
      let totalPages = 1;
      let count = 0;

      while (page <= totalPages && page <= 500) {
        const data = await tmdbFetch(`/discover/${mediaType}`, {
          watch_region: "NL",
          with_watch_providers: String(providerId),
          sort_by: "vote_average.desc",
          "vote_count.gte": mediaType === "movie" ? 30 : 20,
          language: "en-US",
          page,
        });

        totalPages = Math.min(data.total_pages || 1, 500);
        const results = data.results || [];

        for (const t of results) {
          const existing = titles.get(t.id);
          if (existing) {
            // Add this provider to existing title
            if (!existing.provider_ids.includes(providerId)) {
              existing.provider_ids.push(providerId);
            }
          } else {
            titles.set(t.id, {
              tmdb_id: t.id,
              media_type: mediaType,
              title: t.title || t.name || "Unknown",
              year: (t.release_date || t.first_air_date || "").slice(0, 4),
              overview: t.overview || "",
              poster_path: t.poster_path || "",
              tmdb_vote_avg: t.vote_average || 0,
              genre_ids: t.genre_ids || [],
              provider_ids: [providerId],
            });
          }
          count++;
        }

        if (results.length < 20) break;
        page++;
      }

      console.log(`    ${providerName} ${mediaType}: ${count} results, ${page} pages`);
    }
  }

  const allTitles = Array.from(titles.values());
  console.log(`\n  Total unique titles: ${allTitles.length}`);
  console.log(`    Movies: ${allTitles.filter((t) => t.media_type === "movie").length}`);
  console.log(`    TV: ${allTitles.filter((t) => t.media_type === "tv").length}`);

  saveCheckpoint(DISCOVER_FILE, allTitles);
  console.log(`  Saved to ${DISCOVER_FILE}`);
  return allTitles;
}

// ─── Phase 2: TMDB External IDs + OMDb Enrichment ───────────
async function phaseEnrich() {
  console.log("\n=== PHASE 2: TMDB External IDs + OMDb Enrichment ===\n");

  const discovered = loadCheckpoint(DISCOVER_FILE);
  if (!discovered) {
    console.log("  No discover checkpoint found. Run --phase discover first.");
    return [];
  }

  // Load existing enriched data to resume
  let enriched = loadCheckpoint(ENRICHED_FILE) || [];
  const enrichedIds = new Set(enriched.map((t) => t.tmdb_id));
  const remaining = discovered.filter((t) => !enrichedIds.has(t.tmdb_id));

  console.log(`  Already enriched: ${enriched.length}`);
  console.log(`  Remaining: ${remaining.length}`);

  let success = 0;
  let fail = 0;
  let omdbLimitHit = false;

  for (let i = 0; i < remaining.length; i++) {
    const t = remaining[i];

    if (i > 0 && i % 100 === 0) {
      saveCheckpoint(ENRICHED_FILE, enriched);
      console.log(`  [Checkpoint saved: ${enriched.length} enriched]`);
    }

    if (i % 50 === 0) {
      console.log(`  Processing ${i + 1}/${remaining.length}: ${t.title}`);
    }

    try {
      // Get IMDb ID from TMDB
      const extData = await tmdbFetch(`/${t.media_type}/${t.tmdb_id}/external_ids`);
      const imdbId = extData.imdb_id;
      if (!imdbId) {
        fail++;
        continue;
      }

      // Get OMDb data
      const omdb = await omdbFetch(imdbId);
      if (!omdb) {
        // OMDb limit reached
        omdbLimitHit = true;
        break;
      }
      if (omdb.Response === "False") {
        fail++;
        continue;
      }

      // Parse RT score
      let rtScore = null;
      for (const r of omdb.Ratings || []) {
        if (r.Source === "Rotten Tomatoes") {
          rtScore = parseInt(r.Value);
          break;
        }
      }

      const imdbRating = parseFloat(omdb.imdbRating) || null;

      // Quality filter: RT >= 60% OR IMDb >= 6.5 OR (no RT and IMDb >= 6.0)
      if (rtScore !== null && rtScore < 60 && (imdbRating === null || imdbRating < 6.5)) {
        fail++;
        continue;
      }
      if (rtScore === null && imdbRating !== null && imdbRating < 6.0) {
        fail++;
        continue;
      }

      // Build genre names from IDs
      const genreMap = t.media_type === "movie" ? TMDB_GENRES : TV_GENRES;
      const genreNames = t.genre_ids
        .map((gid) => genreMap[gid])
        .filter(Boolean)
        .join(", ");

      // Build provider names
      const providerNames = t.provider_ids
        .map((pid) => PROVIDER_NAMES[pid])
        .filter(Boolean);

      enriched.push({
        tmdb_id: t.tmdb_id,
        imdb_id: imdbId,
        media_type: t.media_type,
        title: t.title,
        year: t.year,
        overview: t.overview,
        plot: omdb.Plot || "",
        poster_url: t.poster_path
          ? `https://image.tmdb.org/t/p/w300${t.poster_path}`
          : "",
        rt_score: rtScore,
        imdb_rating: imdbRating,
        tmdb_vote_avg: t.tmdb_vote_avg,
        genre_ids: t.genre_ids,
        genre_names: genreNames || omdb.Genre || "",
        language: omdb.Language || "",
        awards: omdb.Awards || "",
        provider_ids: t.provider_ids,
        provider_names: providerNames,
        claude_review: null, // filled in Phase 3
      });

      success++;
    } catch (err) {
      console.log(`    Error enriching ${t.title}: ${err.message}`);
      fail++;
    }
  }

  saveCheckpoint(ENRICHED_FILE, enriched);
  console.log(`\n  Enrichment complete:`);
  console.log(`    Success: ${success}, Failed/filtered: ${fail}`);
  console.log(`    Total enriched: ${enriched.length}`);
  if (omdbLimitHit) {
    console.log(`    OMDb limit hit! Run again tomorrow to continue.`);
  }
  console.log(`  Saved to ${ENRICHED_FILE}`);
  return enriched;
}

// ─── Phase 3: Claude Reviews ─────────────────────────────────
async function phaseReviews() {
  console.log("\n=== PHASE 3: Claude Reviews ===\n");

  const enriched = loadCheckpoint(ENRICHED_FILE);
  if (!enriched) {
    console.log("  No enriched checkpoint found. Run --phase omdb first.");
    return [];
  }

  // Find titles without reviews
  const needReview = enriched.filter((t) => !t.claude_review);
  console.log(`  Total titles: ${enriched.length}`);
  console.log(`  Need reviews: ${needReview.length}`);

  if (!needReview.length) {
    console.log("  All titles already have reviews!");
    return enriched;
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const BATCH_SIZE = 20;
  let reviewed = 0;

  for (let i = 0; i < needReview.length; i += BATCH_SIZE) {
    const batch = needReview.slice(i, i + BATCH_SIZE);
    const titlesText = batch
      .map((t, j) => `${j + 1}. ${t.title} (${t.year}): ${(t.plot || "").slice(0, 100)}`)
      .join("\n");

    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content:
            `Write a 1-sentence review (max 12 words) for each film/series. ` +
            `Punchy and specific. No spoilers.\n\n` +
            `${titlesText}\n\n` +
            `Return ONLY a JSON object mapping the number to the review. ` +
            `Example: {"1": "A sharp heist that never lets up.", "2": "Devastating portrait of grief."}\n` +
            `No explanation, no markdown, just JSON.`,
        }],
      });

      let text = message.content[0].text.trim();
      if (text.startsWith("```")) {
        text = text.split("\n").slice(1).join("\n").replace(/```\s*$/, "").trim();
      }
      const reviews = JSON.parse(text);

      // Apply reviews back to the enriched array
      batch.forEach((t, j) => {
        const key = String(j + 1);
        if (reviews[key]) {
          t.claude_review = reviews[key];
          reviewed++;
        }
      });
    } catch (err) {
      console.log(`    Error in batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`);
    }

    if ((i / BATCH_SIZE + 1) % 10 === 0) {
      saveCheckpoint(ENRICHED_FILE, enriched);
      console.log(`  [Checkpoint] ${reviewed} reviews generated (batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(needReview.length / BATCH_SIZE)})`);
    }
  }

  saveCheckpoint(ENRICHED_FILE, enriched);
  console.log(`\n  Reviews complete: ${reviewed} generated`);
  console.log(`  Saved to ${ENRICHED_FILE}`);
  return enriched;
}

// ─── Phase 4: Upload to Supabase ─────────────────────────────
async function phaseUpload() {
  console.log("\n=== PHASE 4: Upload to Supabase ===\n");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log("  Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
    return;
  }

  const enriched = loadCheckpoint(ENRICHED_FILE);
  if (!enriched) {
    console.log("  No enriched checkpoint found. Run earlier phases first.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`  Uploading ${enriched.length} titles to Supabase...`);

  // Upload in batches of 100
  const BATCH_SIZE = 100;
  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE).map((t) => ({
      tmdb_id: t.tmdb_id,
      imdb_id: t.imdb_id,
      media_type: t.media_type,
      title: t.title,
      year: t.year,
      overview: t.overview,
      plot: t.plot,
      poster_url: t.poster_url,
      rt_score: t.rt_score,
      imdb_rating: t.imdb_rating,
      tmdb_vote_avg: t.tmdb_vote_avg,
      genre_ids: t.genre_ids,
      genre_names: t.genre_names,
      language: t.language,
      awards: t.awards,
      provider_ids: t.provider_ids,
      provider_names: t.provider_names,
      claude_review: t.claude_review,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("titles")
      .upsert(batch, { onConflict: "tmdb_id" });

    if (error) {
      console.log(`    Error in batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      errors++;
    } else {
      uploaded += batch.length;
    }
  }

  console.log(`\n  Upload complete:`);
  console.log(`    Uploaded: ${uploaded}`);
  console.log(`    Errors: ${errors}`);

  // Verify count
  const { count } = await supabase
    .from("titles")
    .select("*", { count: "exact", head: true });
  console.log(`    Total in database: ${count}`);
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const phaseArg = args.indexOf("--phase");
  const phase = phaseArg >= 0 ? args[phaseArg + 1] : "all";

  console.log("╔═══════════════════════════════════════════╗");
  console.log("║   Stream Finder NL — Database Populator   ║");
  console.log("╚═══════════════════════════════════════════╝");

  // Validate API keys per phase
  if (!TMDB_API_KEY) { console.error("Missing TMDB_API_KEY"); process.exit(1); }
  if ((phase === "all" || phase === "omdb" || phase === "enrich") && !OMDB_API_KEY) {
    console.error("Missing OMDB_API_KEY"); process.exit(1);
  }
  if ((phase === "all" || phase === "reviews") && !ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY"); process.exit(1);
  }

  const start = Date.now();

  if (phase === "all" || phase === "discover") {
    await phaseDiscover();
  }
  if (phase === "all" || phase === "omdb" || phase === "enrich") {
    await phaseEnrich();
  }
  if (phase === "all" || phase === "reviews") {
    await phaseReviews();
  }
  if (phase === "all" || phase === "upload") {
    await phaseUpload();
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(`\nDone in ${elapsed} minutes.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
