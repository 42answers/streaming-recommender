import os
import json
import time
import requests
import anthropic
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_env_path, override=True)

app = Flask(__name__)

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
OMDB_API_KEY = os.getenv("OMDB_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

TMDB_BASE = "https://api.themoviedb.org/3"

# ─── Cache (24h TTL) ───────────────────────────────────────────
_cache = {}
CACHE_TTL = 86400  # 24 hours


def cached_get(url, params, timeout=10):
    """HTTP GET with in-memory cache."""
    key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    now = time.time()
    if key in _cache and now - _cache[key]["t"] < CACHE_TTL:
        return _cache[key]["data"]
    resp = requests.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    _cache[key] = {"data": data, "t": now}
    return data


# ─── Provider / Genre config ──────────────────────────────────
PROVIDER_IDS = {
    "netflix": 8, "amazon": 119, "disney": 337,
    "hbo": 1899, "videoland": 72,
}

PROVIDER_NAMES = {
    8: "Netflix", 119: "Amazon Prime", 337: "Disney+",
    1899: "HBO Max", 72: "Videoland",
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

# ─── Award lists ───────────────────────────────────────────────
AWARD_LISTS = {
    "cannes": [
        # Palme d'Or / Grand Prix (top prize)
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
        ("Sex, Lies, and Videotape", 1989), ("Pelle the Conqueror", 1988),
        ("Under the Sun of Satan", 1987), ("The Mission", 1986),
        ("When Father Was Away on Business", 1985), ("Paris, Texas", 1984),
        ("The Ballad of Narayama", 1983), ("Missing", 1982), ("Yol", 1982),
        ("Man of Iron", 1981), ("All That Jazz", 1980), ("Kagemusha", 1980),
        ("Apocalypse Now", 1979), ("The Tin Drum", 1979),
        ("The Tree of Wooden Clogs", 1978), ("Padre Padrone", 1977),
        ("Taxi Driver", 1976), ("Chronicle of the Years of Fire", 1975),
        ("The Conversation", 1974), ("Scarecrow", 1973), ("The Hireling", 1973),
        ("The Working Class Goes to Heaven", 1972), ("The Mattei Affair", 1972),
        ("The Go-Between", 1971), ("M*A*S*H", 1970), ("If....", 1969),
        ("Blow-Up", 1967), ("A Man and a Woman", 1966),
        ("The Knack ...and How to Get It", 1965), ("The Umbrellas of Cherbourg", 1964),
        ("The Leopard", 1963), ("The Given Word", 1962), ("Viridiana", 1961),
        ("La Dolce Vita", 1960), ("Black Orpheus", 1959), ("The Cranes Are Flying", 1958),
        ("Friendly Persuasion", 1957), ("The Silent World", 1956), ("Marty", 1955),
        ("Gate of Hell", 1954), ("The Wages of Fear", 1953),
        ("Othello", 1952), ("Miss Julie", 1951), ("The Third Man", 1949),
        # Grand Prix (second prize) 1990+
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
        # Grand Prix (second prize) pre-1990
        ("Too Beautiful for You", 1989), ("A World Apart", 1988),
        ("Repentance", 1987), ("The Sacrifice", 1986), ("Birdy", 1985),
        ("The Night of the Shooting Stars", 1982),
        ("Mon Oncle d'Amérique", 1980),
        ("Investigation of a Citizen Above Suspicion", 1970),
        # Caméra d'Or
        ("Armand", 2024), ("War Pony", 2022), ("Murina", 2021),
        ("Our Mothers", 2019), ("Girl", 2018), ("Jeune Femme", 2017),
        ("Divines", 2016), ("La Tierra y la Sombra", 2015), ("Party Girl", 2014),
        ("Ilo Ilo", 2013), ("Beasts of the Southern Wild", 2012),
        ("Las Acacias", 2011), ("Año Bisiesto", 2010), ("Samson and Delilah", 2009),
        ("Hunger", 2008), ("Persepolis", 2007), ("12:08 East of Bucharest", 2006),
        ("Salaam Bombay!", 1988), ("Stranger Than Paradise", 1984),
        ("Alambrista!", 1978),
    ],
    "oscar": [
        # Best Picture 1990-2024
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
        # Best Picture 1940-1989
        ("Driving Miss Daisy", 1989), ("Rain Man", 1988), ("The Last Emperor", 1987),
        ("Platoon", 1986), ("Out of Africa", 1985), ("Amadeus", 1984),
        ("Terms of Endearment", 1983), ("Gandhi", 1982), ("Chariots of Fire", 1981),
        ("Ordinary People", 1980), ("Kramer vs. Kramer", 1979), ("The Deer Hunter", 1978),
        ("Annie Hall", 1977), ("Rocky", 1976), ("One Flew Over the Cuckoo's Nest", 1975),
        ("The Godfather Part II", 1974), ("The Sting", 1973), ("The Godfather", 1972),
        ("The French Connection", 1971), ("Patton", 1970), ("Midnight Cowboy", 1969),
        ("Oliver!", 1968), ("In the Heat of the Night", 1967), ("A Man for All Seasons", 1966),
        ("The Sound of Music", 1965), ("My Fair Lady", 1964), ("Tom Jones", 1963),
        ("Lawrence of Arabia", 1962), ("West Side Story", 1961), ("The Apartment", 1960),
        ("Ben-Hur", 1959), ("Gigi", 1958), ("The Bridge on the River Kwai", 1957),
        ("Around the World in 80 Days", 1956), ("Marty", 1955), ("On the Waterfront", 1954),
        ("From Here to Eternity", 1953), ("The Greatest Show on Earth", 1952),
        ("An American in Paris", 1951), ("All About Eve", 1950),
        ("All the King's Men", 1949), ("Hamlet", 1948), ("Gentleman's Agreement", 1947),
        ("The Best Years of Our Lives", 1946), ("The Lost Weekend", 1945),
        ("Going My Way", 1944), ("Casablanca", 1943), ("Mrs. Miniver", 1942),
        ("How Green Was My Valley", 1941), ("Rebecca", 1940),
        # Best Director (film, when different from Best Picture) 1990+
        ("The Brutalist", 2024), ("Roma", 2018), ("La La Land", 2016),
        ("The Revenant", 2015), ("Gravity", 2013), ("Life of Pi", 2012),
        ("Traffic", 2000), ("Saving Private Ryan", 1998),
        # Best Director 1940-1989 (films not already in Best Picture)
        ("Born on the Fourth of July", 1989), ("Reds", 1981),
        ("Cabaret", 1972), ("The Graduate", 1967),
        ("The Treasure of the Sierra Madre", 1948), ("A Place in the Sun", 1951),
        ("The Quiet Man", 1952), ("Giant", 1956),
        # Best Original Screenplay 1990+
        ("Anatomy of a Fall", 2023), ("Belfast", 2021),
        ("Promising Young Woman", 2020), ("Get Out", 2017),
        ("Manchester by the Sea", 2016), ("Her", 2013),
        ("Django Unchained", 2012), ("Midnight in Paris", 2011),
        ("Milk", 2008), ("Juno", 2007), ("Little Miss Sunshine", 2006),
        ("Eternal Sunshine of the Spotless Mind", 2004), ("Lost in Translation", 2003),
        ("Talk to Her", 2002), ("Gosford Park", 2001), ("Almost Famous", 2000),
        ("Good Will Hunting", 1997), ("Fargo", 1996), ("The Usual Suspects", 1995),
        # Best Original Screenplay 1940-1989
        ("Dead Poets Society", 1989), ("Hannah and Her Sisters", 1986),
        ("Witness", 1985), ("Places in the Heart", 1984), ("Tender Mercies", 1983),
        ("Chinatown", 1974), ("Network", 1976), ("Dog Day Afternoon", 1975),
        ("The Sting", 1973), ("The Candidate", 1972), ("The Hospital", 1971),
        ("Butch Cassidy and the Sundance Kid", 1969), ("The Producers", 1968),
        ("Guess Who's Coming to Dinner", 1967), ("Divorce Italian Style", 1962),
        ("Splendor in the Grass", 1961), ("The Apartment", 1960),
        ("Citizen Kane", 1941), ("The Great McGinty", 1940),
        # Best Adapted Screenplay 1990+
        ("Conclave", 2024), ("American Fiction", 2023),
        ("Women Talking", 2022), ("The Father", 2020),
        ("Jojo Rabbit", 2019), ("BlacKkKlansman", 2018),
        ("Call Me by Your Name", 2017), ("The Big Short", 2015),
        ("The Imitation Game", 2014),
        # Best Adapted Screenplay 1940-1989
        ("Dangerous Liaisons", 1988), ("The Last Emperor", 1987), ("A Room with a View", 1986),
        ("Out of Africa", 1985), ("Amadeus", 1984), ("Terms of Endearment", 1983),
        ("Missing", 1982), ("On Golden Pond", 1981), ("Ordinary People", 1980),
        ("Kramer vs. Kramer", 1979), ("Midnight Express", 1978), ("Julia", 1977),
        ("All the President's Men", 1976), ("One Flew Over the Cuckoo's Nest", 1975),
        ("The Godfather Part II", 1974), ("The Exorcist", 1973),
        ("The Godfather", 1972), ("The French Connection", 1971),
        ("M*A*S*H", 1970), ("Midnight Cowboy", 1969),
        ("The Lion in Winter", 1968), ("In the Heat of the Night", 1967),
        ("A Man for All Seasons", 1966), ("Doctor Zhivago", 1965),
        ("Becket", 1964), ("Tom Jones", 1963), ("To Kill a Mockingbird", 1962),
        ("Judgment at Nuremberg", 1961), ("Elmer Gantry", 1960),
        ("Room at the Top", 1959), ("Gigi", 1958),
        ("The Bridge on the River Kwai", 1957), ("Around the World in 80 Days", 1956),
        ("Marty", 1955), ("The Country Girl", 1954), ("From Here to Eternity", 1953),
        ("All About Eve", 1950), ("A Letter to Three Wives", 1949),
        ("The Treasure of the Sierra Madre", 1948), ("Miracle on 34th Street", 1947),
        ("The Best Years of Our Lives", 1946), ("The Lost Weekend", 1945),
        ("Going My Way", 1944), ("Casablanca", 1943), ("Mrs. Miniver", 1942),
        ("How Green Was My Valley", 1941), ("The Philadelphia Story", 1940),
        # Best Animated Feature (2001+)
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
        # Best Documentary Feature 2000+
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
        # Best Documentary Feature 1940-1999
        ("Common Threads: Stories from the Quilt", 1989),
        ("Hotel Terminus: The Life and Times of Klaus Barbie", 1988),
        ("The Times of Harvey Milk", 1984), ("Hearts and Minds", 1974),
        ("Harlan County U.S.A.", 1976), ("Woodstock", 1970),
        ("The War Game", 1966), ("The Silent World", 1956),
        ("Kon-Tiki", 1951), ("The Living Desert", 1953),
    ],
    "venice_golden_lion": [
        # 2000-2024
        ("The Room Next Door", 2024), ("Poor Things", 2023), ("All the Beauty and the Bloodshed", 2022),
        ("Happening", 2021), ("Nomadland", 2020), ("Joker", 2019),
        ("Roma", 2018), ("The Shape of Water", 2017), ("The Woman Who Left", 2016),
        ("From Afar", 2015), ("A Pigeon Sat on a Branch Reflecting on Existence", 2014),
        ("Sacro GRA", 2013), ("Pietà", 2012), ("Faust", 2011),
        ("Somewhere", 2010), ("Lebanon", 2009), ("The Wrestler", 2008),
        ("Lust, Caution", 2007), ("Still Life", 2006), ("Brokeback Mountain", 2005),
        ("Vera Drake", 2004), ("The Return", 2003), ("The Magdalene Sisters", 2002),
        ("Monsoon Wedding", 2001), ("The Circle", 2000),
        # 1990-1999
        ("Not One Less", 1999), ("The Way We Laughed", 1998), ("Hana-bi", 1997),
        ("Michael Collins", 1996), ("Cyclo", 1995),
        ("Vive L'Amour", 1994), ("Before the Rain", 1994),
        ("Short Cuts", 1993), ("Three Colours: Blue", 1993),
        ("The Story of Qiu Ju", 1992), ("Urga", 1991),
        ("Rosencrantz and Guildenstern Are Dead", 1990),
        # 1980-1989
        ("A City of Sadness", 1989), ("The Legend of the Holy Drinker", 1988),
        ("Au Revoir les Enfants", 1987), ("The Green Ray", 1986),
        ("Vagabond", 1985), ("Year of the Quiet Sun", 1984),
        ("First Name: Carmen", 1983), ("The State of Things", 1982),
        ("The German Sisters", 1981), ("Atlantic City", 1980), ("Gloria", 1980),
        # 1949-1968 (no Golden Lion 1969-1979)
        ("The Battle of Algiers", 1966), ("Belle de Jour", 1967),
        ("Red Desert", 1964), ("Hands over the City", 1963),
        ("Last Year at Marienbad", 1961), ("Le Passage du Rhin", 1960),
        ("General della Rovere", 1959), ("The Great War", 1959),
        ("Aparajito", 1957), ("Ordet", 1955), ("Romeo and Juliet", 1954),
        ("Rashomon", 1951), ("Forbidden Games", 1952),
        ("Justice Is Done", 1950), ("Manon", 1949),
    ],
    "berlin_golden_bear": [
        # 2000-2025
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
        # 1990-1999
        ("The Thin Red Line", 1999), ("Central Station", 1998),
        ("The People vs. Larry Flynt", 1997), ("Sense and Sensibility", 1996),
        ("The Bait", 1995), ("In the Name of the Father", 1994),
        ("The Woman from the Lake of Scented Souls", 1993), ("The Wedding Banquet", 1993),
        ("Grand Canyon", 1992), ("House of Smiles", 1991),
        ("Music Box", 1990), ("Larks on a String", 1990),
        # 1980-1989
        ("Rain Man", 1989), ("Red Sorghum", 1988), ("The Theme", 1987),
        ("Stammheim", 1986), ("Wetherby", 1985), ("Love Streams", 1984),
        ("Ascendancy", 1983), ("The Beehive", 1983), ("Veronika Voss", 1982),
        ("Deprisa, Deprisa", 1981), ("Heartland", 1980), ("Palermo or Wolfsburg", 1980),
        # 1951-1979
        ("David", 1979), ("The Ascent", 1977),
        ("Buffalo Bill and the Indians", 1976), ("Adoption", 1975),
        ("The Apprenticeship of Duddy Kravitz", 1974), ("Distant Thunder", 1973),
        ("The Canterbury Tales", 1972), ("The Garden of the Finzi-Continis", 1971),
        ("Early Works", 1969), ("Cul-de-sac", 1966), ("Alphaville", 1965),
        ("Dry Summer", 1964), ("A Kind of Loving", 1962), ("La Notte", 1961),
        ("Wild Strawberries", 1958), ("Twelve Angry Men", 1957),
        ("Invitation to the Dance", 1956), ("The Rats", 1955),
        ("Hobson's Choice", 1954), ("The Wages of Fear", 1953),
        ("One Summer of Happiness", 1952), ("Four in a Jeep", 1951),
    ],
}

AWARD_OPTIONS = {
    "cannes": "Cannes Film Festival",
    "oscar": "Academy Awards",
    "venice_golden_lion": "Venice — Golden Lion",
    "berlin_golden_bear": "Berlin — Golden Bear",
}


# ─── Helper functions ──────────────────────────────────────────

def get_genre_id(genre_name, media_type="movie"):
    genres = TMDB_GENRES if media_type == "movie" else TV_GENRES
    genre_name_lower = genre_name.lower()
    for gid, name in genres.items():
        if genre_name_lower in name.lower():
            return gid
    return None


def get_watch_providers(title_id, media_type="movie"):
    data = cached_get(
        f"{TMDB_BASE}/{media_type}/{title_id}/watch/providers",
        {"api_key": TMDB_API_KEY},
    )
    return data.get("results", {}).get("NL", {}).get("flatrate", [])


def get_imdb_id(tmdb_id, media_type="movie"):
    data = cached_get(
        f"{TMDB_BASE}/{media_type}/{tmdb_id}/external_ids",
        {"api_key": TMDB_API_KEY},
    )
    return data.get("imdb_id")


def get_omdb_data(imdb_id):
    return cached_get(
        "http://www.omdbapi.com/",
        {"i": imdb_id, "apikey": OMDB_API_KEY},
    )


def get_rt_score(omdb_data):
    for rating in omdb_data.get("Ratings", []):
        if rating["Source"] == "Rotten Tomatoes":
            return int(rating["Value"].replace("%", ""))
    return None


# ─── Discovery functions ──────────────────────────────────────

def discover_titles(genre_id, provider_ids, media_type="movie"):
    """Discover titles across all selected providers, fetching multiple pages."""
    ANIMATION_GENRE_ID = 16
    base_params = {
        "api_key": TMDB_API_KEY,
        "watch_region": "NL",
        "with_watch_providers": "|".join(str(p) for p in provider_ids),
        "with_genres": genre_id,
        "sort_by": "vote_average.desc",
        "vote_count.gte": 50,
        "language": "en-US",
    }
    if genre_id != ANIMATION_GENRE_ID:
        base_params["without_genres"] = ANIMATION_GENRE_ID

    all_results = []
    for page in range(1, 4):  # fetch 3 pages = up to 60 results
        params = {**base_params, "page": page}
        data = cached_get(f"{TMDB_BASE}/discover/{media_type}", params)
        results = data.get("results", [])
        all_results.extend(results)
        if len(results) < 20:  # no more pages
            break
    return all_results


def _check_title_on_tmdb(suggestion, provider_ids, media_type):
    """Check a single Claude suggestion against TMDB + NL streaming. Used in parallel."""
    try:
        params = {
            "api_key": TMDB_API_KEY,
            "query": suggestion["title"],
            "year": suggestion.get("year"),
            "language": "en-US",
        }
        data = cached_get(f"{TMDB_BASE}/search/{media_type}", params)
        results = data.get("results", [])
        if not results:
            return None
        title = results[0]
        providers = get_watch_providers(title["id"], media_type)
        provider_id_list = [p["provider_id"] for p in providers]
        if not any(pid in provider_id_list for pid in provider_ids):
            return None
        return title
    except Exception:
        return None


def discover_similar(movie_title, provider_ids, media_type="movie"):
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
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        suggestions = json.loads(text)
    except Exception:
        return []

    # Check all suggestions in parallel
    results = []
    seen_ids = set()
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_check_title_on_tmdb, s, provider_ids, media_type): s
            for s in suggestions
        }
        for future in as_completed(futures):
            title = future.result()
            if title and title["id"] not in seen_ids:
                seen_ids.add(title["id"])
                results.append(title)

    return results


def _check_award_title(title_name, year, provider_ids):
    """Check a single award winner against TMDB + NL streaming. Used in parallel."""
    try:
        data = cached_get(
            f"{TMDB_BASE}/search/movie",
            {"api_key": TMDB_API_KEY, "query": title_name, "year": year, "language": "en-US"},
        )
        results = data.get("results", [])
        if not results:
            return None
        movie = results[0]
        providers = get_watch_providers(movie["id"], "movie")
        provider_id_list = [p["provider_id"] for p in providers]
        if not any(pid in provider_id_list for pid in provider_ids):
            return None
        return movie
    except Exception:
        return None


def discover_award_winners(award_key, provider_ids):
    winners = AWARD_LISTS.get(award_key, [])

    # Check all winners in parallel
    results = []
    seen_ids = set()
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_check_award_title, name, year, provider_ids): (name, year)
            for name, year in winners
        }
        for future in as_completed(futures):
            movie = future.result()
            if movie and movie["id"] not in seen_ids:
                seen_ids.add(movie["id"])
                results.append(movie)

    return results


# ─── Enrichment (parallel) ────────────────────────────────────

def _enrich_single(title, media_type):
    """Enrich a single title with IMDb/OMDb data. Used in parallel."""
    try:
        imdb_id = get_imdb_id(title["id"], media_type)
        if not imdb_id:
            return None
        omdb = get_omdb_data(imdb_id)
        if omdb.get("Response") == "False":
            return None

        name = title.get("title") or title.get("name", "Unknown")
        year = (title.get("release_date") or title.get("first_air_date") or "")[:4]
        providers = get_watch_providers(title["id"], media_type)
        available_on = [
            PROVIDER_NAMES[p["provider_id"]]
            for p in providers
            if p["provider_id"] in PROVIDER_NAMES
        ]

        return {
            "title": name,
            "year": year,
            "poster": f"https://image.tmdb.org/t/p/w300{title.get('poster_path', '')}",
            "overview": title.get("overview", ""),
            "rt_score": get_rt_score(omdb),
            "imdb_rating": omdb.get("imdbRating", "N/A"),
            "imdb_id": imdb_id,
            "genres": omdb.get("Genre", ""),
            "awards": omdb.get("Awards", ""),
            "language": omdb.get("Language", ""),
            "plot": omdb.get("Plot", ""),
            "available_on": available_on,
        }
    except Exception:
        return None


def get_batch_claude_reviews(titles):
    """Get reviews for all titles in a single Claude call."""
    if not ANTHROPIC_API_KEY or not titles:
        return {}

    titles_text = "\n".join(
        f"{i+1}. {t['title']} ({t['year']})"
        for i, t in enumerate(titles)
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1200,
            messages=[{
                "role": "user",
                "content": (
                    f"Write a 1-sentence review (max 12 words) for each film/series. "
                    f"Punchy and specific. No spoilers.\n\n"
                    f"{titles_text}\n\n"
                    f"Return ONLY a JSON object mapping the number to the review. "
                    f"Example: {{\"1\": \"A sharp heist that never lets up.\", \"2\": \"Devastating portrait of grief.\"}}\n"
                    f"No explanation, no markdown, just JSON."
                ),
            }],
        )
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        reviews = json.loads(text)
        # Map back to title names
        result = {}
        for i, t in enumerate(titles):
            key = str(i + 1)
            if key in reviews:
                result[t["title"]] = reviews[key]
        return result
    except Exception:
        return {}


# ─── Routes ────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/awards")
def awards():
    return jsonify([{"id": k, "name": v} for k, v in AWARD_OPTIONS.items()])


@app.route("/api/genres")
def genres():
    media_type = request.args.get("media_type", "movie")
    g = TMDB_GENRES if media_type == "movie" else TV_GENRES
    return jsonify([{"id": k, "name": v} for k, v in sorted(g.items(), key=lambda x: x[1])])


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

    # Step 1: Collect candidate titles
    all_titles = []
    seen_ids = set()

    if award:
        titles = discover_award_winners(award, provider_ids)
        for t in titles:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                all_titles.append(t)
    elif similar_to:
        # Check if the original title itself is available
        original_title = None
        try:
            search_data = cached_get(
                f"{TMDB_BASE}/search/{media_type}",
                {"api_key": TMDB_API_KEY, "query": similar_to, "language": "en-US"},
            )
            search_results = search_data.get("results", [])
            if search_results:
                candidate = search_results[0]
                providers = get_watch_providers(candidate["id"], media_type)
                provider_id_list = [p["provider_id"] for p in providers]
                if any(pid in provider_id_list for pid in provider_ids):
                    original_title = candidate
                    seen_ids.add(candidate["id"])
        except Exception:
            pass

        titles = discover_similar(similar_to, provider_ids, media_type)
        for t in titles:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                all_titles.append(t)
    elif genre:
        genre_id = get_genre_id(genre, media_type)
        if not genre_id:
            return jsonify({"error": f"Genre '{genre}' not found"}), 400
        titles = discover_titles(genre_id, provider_ids, media_type)
        for t in titles:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                all_titles.append(t)
    else:
        return jsonify({"error": "Enter a genre, movie title, or select an award"}), 400

    # Step 2: Enrich in parallel (TMDB external_ids + OMDb + providers)
    enriched = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_enrich_single, t, media_type): t
            for t in all_titles[:60]  # enrich up to 60, show top 20
        }
        for future in as_completed(futures):
            result = future.result()
            if result:
                enriched.append(result)

    # Step 3: Sort by RT score, take top 10
    enriched.sort(
        key=lambda x: (x["rt_score"] is not None, x["rt_score"] or 0),
        reverse=True,
    )

    # If "similar to" and original title is available, pin it at #1
    if similar_to and original_title:
        original_enriched = _enrich_single(original_title, media_type)
        if original_enriched:
            original_enriched["is_original"] = True
            enriched = [original_enriched] + [e for e in enriched if e["imdb_id"] != original_enriched["imdb_id"]]

    top20 = enriched[:20]

    # Step 4: Batch Claude reviews (single API call for all 20)
    reviews = get_batch_claude_reviews(top20)
    for item in top20:
        item["review_text"] = reviews.get(item["title"])
        item["review_source"] = "AI-generated review" if item["review_text"] else None
        item.pop("plot", None)  # remove plot from response

    return jsonify({"results": top20, "total_found": len(all_titles)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
