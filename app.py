import os
import requests
import anthropic
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path, override=True)

app = Flask(__name__)

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
OMDB_API_KEY = os.getenv("OMDB_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

TMDB_BASE = "https://api.themoviedb.org/3"

# TMDB streaming provider IDs for NL
PROVIDER_IDS = {
    "netflix": 8,
    "amazon": 119,
    "disney": 337,
    "hbo": 1899,
    "videoland": 72,
}

PROVIDER_NAMES = {
    8: "Netflix",
    119: "Amazon Prime",
    337: "Disney+",
    1899: "HBO Max",
    72: "Videoland",
}

TMDB_GENRES = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
}

TV_GENRES = {
    10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
    80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
    10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality",
    10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
    10768: "War & Politics", 37: "Western",
}


# Award-winning films (title, year) — used to search TMDB
# Cannes and Oscar are consolidated: all sub-awards merged, duplicates removed
AWARD_LISTS = {
    "cannes": [
        # Palme d'Or
        ("Anora", 2024), ("Anatomy of a Fall", 2023), ("Triangle of Sadness", 2022),
        ("Titane", 2021), ("Parasite", 2019), ("Shoplifters", 2018),
        ("The Square", 2017), ("I, Daniel Blake", 2016), ("Dheepan", 2015),
        ("Winter Sleep", 2014), ("Blue Is the Warmest Colour", 2013),
        ("Amour", 2012), ("The Tree of Life", 2011), ("Uncle Boonmee Who Can Recall His Past Lives", 2010),
        ("The White Ribbon", 2009), ("The Class", 2008), ("4 Months, 3 Weeks and 2 Days", 2007),
        ("The Wind That Shakes the Barley", 2006), ("L'Enfant", 2005),
        ("Fahrenheit 9/11", 2004), ("Elephant", 2003), ("The Pianist", 2002),
        ("The Son's Room", 2001), ("Dancer in the Dark", 2000),
        ("Rosetta", 1999), ("Eternity and a Day", 1998), ("The Eel", 1997),
        ("Secrets & Lies", 1996), ("Underground", 1995), ("Pulp Fiction", 1994),
        ("The Piano", 1993), ("The Best Intentions", 1992), ("Barton Fink", 1991),
        ("Wild at Heart", 1990),
        # Grand Prix
        ("All We Imagine as Light", 2024), ("The Zone of Interest", 2023),
        ("Close", 2022), ("A Hero", 2021), ("Atlantics", 2019),
        ("BlacKkKlansman", 2018), ("BPM (Beats per Minute)", 2017),
        ("It's Only the End of the World", 2016), ("Son of Saul", 2015),
        ("The Wonders", 2014), ("Inside Llewyn Davis", 2013),
        ("Reality", 2012), ("The Kid with a Bike", 2011), ("Of Gods and Men", 2010),
        ("A Prophet", 2009), ("Gomorrah", 2008), ("Silent Light", 2007),
        ("Flanders", 2006), ("Broken Flowers", 2005), ("Old Boy", 2004),
        ("Distant", 2003), ("The Man Without a Past", 2002), ("The Piano Teacher", 2001),
        ("Songs from the Second Floor", 2000),
        # Caméra d'Or
        ("Armand", 2024), ("War Pony", 2022), ("Murina", 2021),
        ("Our Mothers", 2019), ("Girl", 2018), ("Jeune Femme", 2017),
        ("Divines", 2016), ("La Tierra y la Sombra", 2015), ("Party Girl", 2014),
        ("Ilo Ilo", 2013), ("Beasts of the Southern Wild", 2012),
        ("Las Acacias", 2011), ("Año Bisiesto", 2010), ("Samson and Delilah", 2009),
        ("Hunger", 2008), ("Persepolis", 2007), ("12:08 East of Bucharest", 2006),
    ],
    "oscar": [
        # Best Picture
        ("Anora", 2024), ("Oppenheimer", 2023), ("Everything Everywhere All at Once", 2022),
        ("CODA", 2021), ("Nomadland", 2020), ("Parasite", 2019),
        ("Green Book", 2018), ("The Shape of Water", 2017), ("Moonlight", 2016),
        ("Spotlight", 2015), ("Birdman", 2014), ("12 Years a Slave", 2013),
        ("Argo", 2012), ("The Artist", 2011), ("The King's Speech", 2010),
        ("The Hurt Locker", 2009), ("Slumdog Millionaire", 2008),
        ("No Country for Old Men", 2007), ("The Departed", 2006),
        ("Crash", 2005), ("Million Dollar Baby", 2004),
        ("The Lord of the Rings: The Return of the King", 2003),
        ("Chicago", 2002), ("A Beautiful Mind", 2001), ("Gladiator", 2000),
        ("American Beauty", 1999), ("Shakespeare in Love", 1998),
        ("Titanic", 1997), ("The English Patient", 1996),
        ("Braveheart", 1995), ("Forrest Gump", 1994), ("Schindler's List", 1993),
        ("Unforgiven", 1992), ("The Silence of the Lambs", 1991),
        ("Dances with Wolves", 1990),
        # Best Director (film titles, not director names)
        ("The Brutalist", 2024), ("Roma", 2018), ("La La Land", 2016),
        ("The Revenant", 2015), ("Gravity", 2013), ("Life of Pi", 2012),
        ("The Artist", 2011), ("The King's Speech", 2010), ("The Hurt Locker", 2009),
        ("Slumdog Millionaire", 2008), ("No Country for Old Men", 2007),
        ("The Departed", 2006), ("Brokeback Mountain", 2005),
        ("Million Dollar Baby", 2004), ("The Lord of the Rings: The Return of the King", 2003),
        ("The Pianist", 2002), ("A Beautiful Mind", 2001), ("Traffic", 2000),
        ("American Beauty", 1999), ("Saving Private Ryan", 1998),
        ("Titanic", 1997), ("The English Patient", 1996), ("Braveheart", 1995),
        ("Forrest Gump", 1994), ("Schindler's List", 1993),
        ("Unforgiven", 1992), ("The Silence of the Lambs", 1991),
        ("Dances with Wolves", 1990),
        # Best Original Screenplay
        ("Anatomy of a Fall", 2023), ("Belfast", 2021),
        ("Promising Young Woman", 2020), ("Get Out", 2017),
        ("Manchester by the Sea", 2016), ("Her", 2013),
        ("Django Unchained", 2012), ("Midnight in Paris", 2011),
        ("Milk", 2008), ("Juno", 2007), ("Little Miss Sunshine", 2006),
        ("Eternal Sunshine of the Spotless Mind", 2004), ("Lost in Translation", 2003),
        ("Talk to Her", 2002), ("Gosford Park", 2001), ("Almost Famous", 2000),
        ("American Beauty", 1999), ("Shakespeare in Love", 1998),
        ("Good Will Hunting", 1997), ("Fargo", 1996), ("The Usual Suspects", 1995),
        # Best Adapted Screenplay
        ("Conclave", 2024), ("American Fiction", 2023),
        ("Women Talking", 2022), ("The Father", 2020),
        ("Jojo Rabbit", 2019), ("BlacKkKlansman", 2018),
        ("Call Me by Your Name", 2017), ("Moonlight", 2016), ("The Big Short", 2015),
        ("The Imitation Game", 2014), ("12 Years a Slave", 2013),
        # Best Animated Feature
        ("Flow", 2024), ("The Boy and the Heron", 2023),
        ("Guillermo del Toro's Pinocchio", 2022), ("Encanto", 2021),
        ("Soul", 2020), ("Toy Story 4", 2019), ("Spider-Man: Into the Spider-Verse", 2018),
        ("Coco", 2017), ("Zootopia", 2016), ("Inside Out", 2015),
        ("Big Hero 6", 2014), ("Frozen", 2013), ("Brave", 2012),
        ("Rango", 2011), ("Toy Story 3", 2010), ("Up", 2009),
        ("WALL-E", 2008), ("Ratatouille", 2007), ("Happy Feet", 2006),
        ("Wallace & Gromit: The Curse of the Were-Rabbit", 2005),
        ("The Incredibles", 2004), ("Finding Nemo", 2003),
        ("Spirited Away", 2002), ("Shrek", 2001),
        # Best Documentary Feature
        ("No Other Land", 2024), ("20 Days in Mariupol", 2023),
        ("Navalny", 2022), ("Summer of Soul", 2021),
        ("My Octopus Teacher", 2020), ("American Factory", 2019),
        ("Free Solo", 2018), ("Icarus", 2017), ("O.J.: Made in America", 2016),
        ("Amy", 2015), ("Citizenfour", 2014), ("20 Feet from Stardom", 2013),
        ("Searching for Sugar Man", 2012), ("Undefeated", 2011),
        ("Inside Job", 2010), ("The Cove", 2009), ("Man on Wire", 2008),
        ("Taxi to the Dark Side", 2007), ("An Inconvenient Truth", 2006),
        ("March of the Penguins", 2005), ("Born into Brothels", 2004),
        ("Fog of War", 2003), ("Bowling for Columbine", 2002),
    ],
    "venice_golden_lion": [
        ("The Room Next Door", 2024), ("Poor Things", 2023), ("All the Beauty and the Bloodshed", 2022),
        ("Happening", 2021), ("Nomadland", 2020), ("Joker", 2019),
        ("Roma", 2018), ("The Shape of Water", 2017), ("The Woman Who Left", 2016),
        ("From Afar", 2015), ("A Pigeon Sat on a Branch Reflecting on Existence", 2014),
        ("Sacro GRA", 2013), ("Pietà", 2012), ("Faust", 2011),
        ("Somewhere", 2010), ("Lebanon", 2009), ("The Wrestler", 2008),
        ("Lust, Caution", 2007), ("Still Life", 2006), ("Brokeback Mountain", 2005),
        ("Vera Drake", 2004), ("The Return", 2003), ("The Magdalene Sisters", 2002),
        ("Monsoon Wedding", 2001), ("The Circle", 2000),
    ],
    "berlin_golden_bear": [
        ("Dreams", 2025), ("Dahomey", 2024), ("On the Adamant", 2023),
        ("Alcarràs", 2022), ("Bad Luck Banging or Loony Porn", 2021),
        ("There Is No Evil", 2020), ("Synonyms", 2019),
        ("Touch Me Not", 2018), ("On Body and Soul", 2017),
        ("Fire at Sea", 2016), ("Taxi", 2015), ("Black Coal, Thin Ice", 2014),
        ("Child's Pose", 2013), ("Caesar Must Die", 2012),
        ("A Separation", 2011), ("Honey", 2010), ("The Milk of Sorrow", 2009),
        ("Troop", 2008), ("Tuya's Marriage", 2007), ("Grbavica", 2006),
        ("U-Carmen e-Khayelitsha", 2005), ("Head-On", 2004),
        ("In This World", 2003), ("Spirited Away", 2002),
        ("Intimacy", 2001), ("Magnolia", 2000),
    ],
}

# Flat mapping for the UI
AWARD_OPTIONS = {
    "cannes": "Cannes Film Festival",
    "oscar": "Academy Awards",
    "venice_golden_lion": "Venice — Golden Lion",
    "berlin_golden_bear": "Berlin — Golden Bear",
}


def get_genre_id(genre_name, media_type="movie"):
    genres = TMDB_GENRES if media_type == "movie" else TV_GENRES
    genre_name_lower = genre_name.lower()
    for gid, name in genres.items():
        if genre_name_lower in name.lower():
            return gid
    return None


def discover_titles(genre_id, provider_id, media_type="movie"):
    """Discover movies/shows on a streaming service in NL by genre."""
    endpoint = f"{TMDB_BASE}/discover/{media_type}"
    ANIMATION_GENRE_ID = 16
    params = {
        "api_key": TMDB_API_KEY,
        "watch_region": "NL",
        "with_watch_providers": provider_id,
        "with_genres": genre_id,
        "sort_by": "vote_average.desc",
        "vote_count.gte": 50,
        "language": "en-US",
        "page": 1,
    }
    if genre_id != ANIMATION_GENRE_ID:
        params["without_genres"] = ANIMATION_GENRE_ID
    resp = requests.get(endpoint, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get("results", [])[:30]


def discover_similar(movie_title, provider_ids, media_type="movie"):
    """Use Claude to find 30 similar titles, then check streaming availability."""
    import json as _json
    if not ANTHROPIC_API_KEY:
        return []

    kind = "movies" if media_type == "movie" else "TV series"
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            messages=[{
                "role": "user",
                "content": (
                    f"List 30 critically acclaimed {kind} that someone who loved '{movie_title}' would enjoy. "
                    f"Only include titles with strong critical reception (e.g. 70%+ on Rotten Tomatoes, "
                    f"major festival selections, or widely praised by critics). "
                    f"Focus on similar tone, themes, and quality — not just the same genre. "
                    f"Mix well-known and hidden gems. Include recent and classic titles. "
                    f"Return ONLY a JSON array of objects with \"title\" and \"year\" fields. "
                    f"Example: [{{\"title\": \"Example Movie\", \"year\": 2020}}]\n"
                    f"No explanation, no markdown, just the JSON array."
                ),
            }],
        )
        text = message.content[0].text.strip()
        # Handle markdown code blocks
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        suggestions = _json.loads(text)
    except Exception:
        return []

    # Search each suggestion on TMDB and check streaming availability in NL
    results = []
    seen_ids = set()

    for suggestion in suggestions:
        try:
            params = {
                "api_key": TMDB_API_KEY,
                "query": suggestion["title"],
                "year": suggestion.get("year"),
                "language": "en-US",
            }
            endpoint = f"{TMDB_BASE}/search/{media_type}"
            resp = requests.get(endpoint, params=params, timeout=10)
            resp.raise_for_status()
            search_results = resp.json().get("results", [])
            if not search_results:
                continue

            title = search_results[0]
            if title["id"] in seen_ids:
                continue

            # Check streaming availability in NL
            providers = get_watch_providers(title["id"], media_type)
            provider_id_list = [p["provider_id"] for p in providers]
            if not any(pid in provider_id_list for pid in provider_ids):
                continue

            seen_ids.add(title["id"])
            results.append(title)

            if len(results) >= 30:
                break
        except Exception:
            continue

    return results


def discover_award_winners(award_key, provider_ids):
    """Find award-winning movies available on streaming services in NL."""
    winners = AWARD_LISTS.get(award_key, [])
    results = []
    seen_ids = set()

    for title_name, year in winners:
        try:
            # Search TMDB for this title
            params = {
                "api_key": TMDB_API_KEY,
                "query": title_name,
                "year": year,
                "language": "en-US",
            }
            resp = requests.get(f"{TMDB_BASE}/search/movie", params=params, timeout=10)
            resp.raise_for_status()
            search_results = resp.json().get("results", [])
            if not search_results:
                continue

            movie = search_results[0]
            if movie["id"] in seen_ids:
                continue

            # Check if available on any selected streaming service in NL
            providers = get_watch_providers(movie["id"], "movie")
            provider_id_list = [p["provider_id"] for p in providers]
            if not any(pid in provider_id_list for pid in provider_ids):
                continue

            seen_ids.add(movie["id"])
            results.append(movie)

            if len(results) >= 30:
                break
        except Exception:
            continue

    return results


def get_watch_providers(title_id, media_type="movie"):
    """Get streaming providers for a title in NL."""
    endpoint = f"{TMDB_BASE}/{media_type}/{title_id}/watch/providers"
    params = {"api_key": TMDB_API_KEY}
    resp = requests.get(endpoint, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("results", {}).get("NL", {})
    return data.get("flatrate", [])


def get_omdb_data(imdb_id):
    """Get OMDb data including Rotten Tomatoes score."""
    resp = requests.get(
        "http://www.omdbapi.com/",
        params={"i": imdb_id, "apikey": OMDB_API_KEY},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def get_imdb_id(tmdb_id, media_type="movie"):
    """Get IMDb ID from TMDB ID."""
    endpoint = f"{TMDB_BASE}/{media_type}/{tmdb_id}/external_ids"
    params = {"api_key": TMDB_API_KEY}
    resp = requests.get(endpoint, params=params, timeout=10)
    resp.raise_for_status()
    return resp.json().get("imdb_id")


def get_rt_score(omdb_data):
    """Extract Rotten Tomatoes score from OMDb data."""
    for rating in omdb_data.get("Ratings", []):
        if rating["Source"] == "Rotten Tomatoes":
            return int(rating["Value"].replace("%", ""))
    return None


def get_claude_review(title, year, plot):
    """Get a two-line AI-generated review from Claude."""
    if not ANTHROPIC_API_KEY:
        return None
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{
                "role": "user",
                "content": (
                    f"Write a 2-line mini review of '{title}' ({year}). "
                    f"Line 1: What makes it worth watching (the hook). "
                    f"Line 2: Who it's best for or a minor caveat. "
                    f"Be specific and opinionated, not generic. No spoilers. "
                    f"Plot for context: {plot}"
                ),
            }],
        )
        return message.content[0].text
    except Exception:
        return None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/awards")
def awards():
    return jsonify([{"id": k, "name": v} for k, v in AWARD_OPTIONS.items()])


@app.route("/api/genres")
def genres():
    media_type = request.args.get("media_type", "movie")
    genres = TMDB_GENRES if media_type == "movie" else TV_GENRES
    return jsonify([{"id": k, "name": v} for k, v in sorted(genres.items(), key=lambda x: x[1])])


@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.json
    genre = data.get("genre", "")
    similar_to = data.get("similar_to", "")
    award = data.get("award", "")
    services = data.get("services", ["netflix", "amazon", "disney"])
    media_type = data.get("media_type", "movie")

    provider_ids = [PROVIDER_IDS[s] for s in services if s in PROVIDER_IDS]
    if not provider_ids:
        return jsonify({"error": "Select at least one streaming service"}), 400

    # Collect titles from all selected services
    all_titles = []
    seen_ids = set()

    if award:
        # Award search: find winners available on selected services
        titles = discover_award_winners(award, provider_ids)
        for t in titles:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                all_titles.append(t)
    elif similar_to:
        # Claude-powered similar search across all selected services
        titles = discover_similar(similar_to, provider_ids, media_type)
        for t in titles:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                all_titles.append(t)
    elif genre:
        for pid in provider_ids:
            genre_id = get_genre_id(genre, media_type)
            if not genre_id:
                return jsonify({"error": f"Genre '{genre}' not found"}), 400
            titles = discover_titles(genre_id, pid, media_type)
            for t in titles:
                if t["id"] not in seen_ids:
                    seen_ids.add(t["id"])
                    all_titles.append(t)
    else:
        return jsonify({"error": "Enter a genre, movie title, or select an award"}), 400

    # Enrich with OMDb data and sort by RT score
    enriched = []
    for title in all_titles:
        try:
            imdb_id = get_imdb_id(title["id"], media_type)
            if not imdb_id:
                continue
            omdb = get_omdb_data(imdb_id)
            if omdb.get("Response") == "False":
                continue

            rt_score = get_rt_score(omdb)
            name = title.get("title") or title.get("name", "Unknown")
            year = (title.get("release_date") or title.get("first_air_date") or "")[:4]

            # Get Claude mini review
            review_text = get_claude_review(name, year, omdb.get("Plot", ""))
            review_source = "AI-generated review"

            # Get streaming services where it's available in NL
            providers = get_watch_providers(title["id"], media_type)
            available_on = [
                PROVIDER_NAMES[p["provider_id"]]
                for p in providers
                if p["provider_id"] in PROVIDER_NAMES
            ]

            enriched.append({
                "title": name,
                "year": year,
                "poster": f"https://image.tmdb.org/t/p/w300{title.get('poster_path', '')}",
                "overview": title.get("overview", ""),
                "rt_score": rt_score,
                "imdb_rating": omdb.get("imdbRating", "N/A"),
                "imdb_id": imdb_id,
                "genres": omdb.get("Genre", ""),
                "awards": omdb.get("Awards", ""),
                "review_text": review_text,
                "review_source": review_source,
                "available_on": available_on,
            })
        except Exception:
            continue

        if len(enriched) >= 15:
            break

    # Sort: titles with RT scores first (desc), then by IMDB rating
    enriched.sort(
        key=lambda x: (x["rt_score"] is not None, x["rt_score"] or 0),
        reverse=True,
    )

    return jsonify({"results": enriched[:10]})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
