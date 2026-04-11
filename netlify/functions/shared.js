const fetch = require("node-fetch");

const TMDB_BASE = "https://api.themoviedb.org/3";

const PROVIDER_IDS = {
  netflix: 8,
  amazon: 119,
  disney: 337,
  hbo: 1899,
  videoland: 72,
};

const PROVIDER_NAMES = {
  8: "Netflix",
  119: "Amazon Prime",
  337: "Disney+",
  1899: "HBO Max",
  72: "Videoland",
};

const TMDB_GENRES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Science Fiction",
  10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
};

const TV_GENRES = {
  10759: "Action & Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics", 37: "Western",
};

const AWARD_LISTS = {
  cannes: [
    // Palme d'Or / Grand Prix (top prize)
    ["Anora", 2024], ["Anatomy of a Fall", 2023], ["Triangle of Sadness", 2022],
    ["Titane", 2021], ["Parasite", 2019], ["Shoplifters", 2018],
    ["The Square", 2017], ["I, Daniel Blake", 2016], ["Dheepan", 2015],
    ["Winter Sleep", 2014], ["Blue Is the Warmest Colour", 2013],
    ["Amour", 2012], ["The Tree of Life", 2011], ["Uncle Boonmee Who Can Recall His Past Lives", 2010],
    ["The White Ribbon", 2009], ["The Class", 2008], ["4 Months, 3 Weeks and 2 Days", 2007],
    ["The Wind That Shakes the Barley", 2006], ["L'Enfant", 2005],
    ["Fahrenheit 9/11", 2004], ["Elephant", 2003], ["The Pianist", 2002],
    ["The Son's Room", 2001], ["Dancer in the Dark", 2000],
    ["Rosetta", 1999], ["Eternity and a Day", 1998], ["The Eel", 1997],
    ["Secrets & Lies", 1996], ["Underground", 1995], ["Pulp Fiction", 1994],
    ["The Piano", 1993], ["The Best Intentions", 1992], ["Barton Fink", 1991],
    ["Wild at Heart", 1990],
    ["Sex, Lies, and Videotape", 1989], ["Pelle the Conqueror", 1988],
    ["Under the Sun of Satan", 1987], ["The Mission", 1986],
    ["When Father Was Away on Business", 1985], ["Paris, Texas", 1984],
    ["The Ballad of Narayama", 1983], ["Missing", 1982], ["Yol", 1982],
    ["Man of Iron", 1981], ["All That Jazz", 1980], ["Kagemusha", 1980],
    ["Apocalypse Now", 1979], ["The Tin Drum", 1979],
    ["The Tree of Wooden Clogs", 1978], ["Padre Padrone", 1977],
    ["Taxi Driver", 1976], ["Chronicle of the Years of Fire", 1975],
    ["The Conversation", 1974], ["Scarecrow", 1973], ["The Hireling", 1973],
    ["The Working Class Goes to Heaven", 1972], ["The Mattei Affair", 1972],
    ["The Go-Between", 1971], ["M*A*S*H", 1970], ["If....", 1969],
    ["Blow-Up", 1967], ["A Man and a Woman", 1966],
    ["The Knack ...and How to Get It", 1965], ["The Umbrellas of Cherbourg", 1964],
    ["The Leopard", 1963], ["The Given Word", 1962], ["Viridiana", 1961],
    ["La Dolce Vita", 1960], ["Black Orpheus", 1959], ["The Cranes Are Flying", 1958],
    ["Friendly Persuasion", 1957], ["The Silent World", 1956], ["Marty", 1955],
    ["Gate of Hell", 1954], ["The Wages of Fear", 1953],
    ["Othello", 1952], ["Miss Julie", 1951], ["The Third Man", 1949],
    // Grand Prix (second prize) 1990+
    ["All We Imagine as Light", 2024], ["The Zone of Interest", 2023],
    ["Close", 2022], ["A Hero", 2021], ["Atlantics", 2019],
    ["BlacKkKlansman", 2018], ["BPM (Beats per Minute)", 2017],
    ["It's Only the End of the World", 2016], ["Son of Saul", 2015],
    ["The Wonders", 2014], ["Inside Llewyn Davis", 2013],
    ["Reality", 2012], ["The Kid with a Bike", 2011], ["Of Gods and Men", 2010],
    ["A Prophet", 2009], ["Gomorrah", 2008], ["Silent Light", 2007],
    ["Flanders", 2006], ["Broken Flowers", 2005], ["Old Boy", 2004],
    ["Distant", 2003], ["The Man Without a Past", 2002], ["The Piano Teacher", 2001],
    ["Songs from the Second Floor", 2000],
    // Grand Prix (second prize) pre-1990
    ["Too Beautiful for You", 1989], ["A World Apart", 1988],
    ["Repentance", 1987], ["The Sacrifice", 1986], ["Birdy", 1985],
    ["The Night of the Shooting Stars", 1982],
    ["Mon Oncle d'Amérique", 1980],
    ["Investigation of a Citizen Above Suspicion", 1970],
    // Caméra d'Or
    ["Armand", 2024], ["War Pony", 2022], ["Murina", 2021],
    ["Our Mothers", 2019], ["Girl", 2018], ["Jeune Femme", 2017],
    ["Divines", 2016], ["La Tierra y la Sombra", 2015], ["Party Girl", 2014],
    ["Ilo Ilo", 2013], ["Beasts of the Southern Wild", 2012],
    ["Las Acacias", 2011], ["Año Bisiesto", 2010], ["Samson and Delilah", 2009],
    ["Hunger", 2008], ["Persepolis", 2007], ["12:08 East of Bucharest", 2006],
    ["Salaam Bombay!", 1988], ["Stranger Than Paradise", 1984],
    ["Alambrista!", 1978],
  ],
  oscar: [
    // Best Picture 1990-2024
    ["Anora", 2024], ["Oppenheimer", 2023], ["Everything Everywhere All at Once", 2022],
    ["CODA", 2021], ["Nomadland", 2020], ["Parasite", 2019],
    ["Green Book", 2018], ["The Shape of Water", 2017], ["Moonlight", 2016],
    ["Spotlight", 2015], ["Birdman", 2014], ["12 Years a Slave", 2013],
    ["Argo", 2012], ["The Artist", 2011], ["The King's Speech", 2010],
    ["The Hurt Locker", 2009], ["Slumdog Millionaire", 2008],
    ["No Country for Old Men", 2007], ["The Departed", 2006],
    ["Crash", 2005], ["Million Dollar Baby", 2004],
    ["The Lord of the Rings: The Return of the King", 2003],
    ["Chicago", 2002], ["A Beautiful Mind", 2001], ["Gladiator", 2000],
    ["American Beauty", 1999], ["Shakespeare in Love", 1998],
    ["Titanic", 1997], ["The English Patient", 1996],
    ["Braveheart", 1995], ["Forrest Gump", 1994], ["Schindler's List", 1993],
    ["Unforgiven", 1992], ["The Silence of the Lambs", 1991],
    ["Dances with Wolves", 1990],
    // Best Picture 1940-1989
    ["Driving Miss Daisy", 1989], ["Rain Man", 1988], ["The Last Emperor", 1987],
    ["Platoon", 1986], ["Out of Africa", 1985], ["Amadeus", 1984],
    ["Terms of Endearment", 1983], ["Gandhi", 1982], ["Chariots of Fire", 1981],
    ["Ordinary People", 1980], ["Kramer vs. Kramer", 1979], ["The Deer Hunter", 1978],
    ["Annie Hall", 1977], ["Rocky", 1976], ["One Flew Over the Cuckoo's Nest", 1975],
    ["The Godfather Part II", 1974], ["The Sting", 1973], ["The Godfather", 1972],
    ["The French Connection", 1971], ["Patton", 1970], ["Midnight Cowboy", 1969],
    ["Oliver!", 1968], ["In the Heat of the Night", 1967], ["A Man for All Seasons", 1966],
    ["The Sound of Music", 1965], ["My Fair Lady", 1964], ["Tom Jones", 1963],
    ["Lawrence of Arabia", 1962], ["West Side Story", 1961], ["The Apartment", 1960],
    ["Ben-Hur", 1959], ["Gigi", 1958], ["The Bridge on the River Kwai", 1957],
    ["Around the World in 80 Days", 1956], ["Marty", 1955], ["On the Waterfront", 1954],
    ["From Here to Eternity", 1953], ["The Greatest Show on Earth", 1952],
    ["An American in Paris", 1951], ["All About Eve", 1950],
    ["All the King's Men", 1949], ["Hamlet", 1948], ["Gentleman's Agreement", 1947],
    ["The Best Years of Our Lives", 1946], ["The Lost Weekend", 1945],
    ["Going My Way", 1944], ["Casablanca", 1943], ["Mrs. Miniver", 1942],
    ["How Green Was My Valley", 1941], ["Rebecca", 1940],
    // Best Director (when different from Best Picture) 1990+
    ["The Brutalist", 2024], ["Roma", 2018], ["La La Land", 2016],
    ["The Revenant", 2015], ["Gravity", 2013], ["Life of Pi", 2012],
    ["Traffic", 2000], ["Saving Private Ryan", 1998],
    // Best Director 1940-1989
    ["Born on the Fourth of July", 1989], ["Reds", 1981],
    ["Cabaret", 1972], ["The Graduate", 1967],
    ["The Treasure of the Sierra Madre", 1948], ["A Place in the Sun", 1951],
    ["The Quiet Man", 1952], ["Giant", 1956],
    // Best Original Screenplay 1990+
    ["Anatomy of a Fall", 2023], ["Belfast", 2021],
    ["Promising Young Woman", 2020], ["Get Out", 2017],
    ["Manchester by the Sea", 2016], ["Her", 2013],
    ["Django Unchained", 2012], ["Midnight in Paris", 2011],
    ["Milk", 2008], ["Juno", 2007], ["Little Miss Sunshine", 2006],
    ["Eternal Sunshine of the Spotless Mind", 2004], ["Lost in Translation", 2003],
    ["Talk to Her", 2002], ["Gosford Park", 2001], ["Almost Famous", 2000],
    ["Good Will Hunting", 1997], ["Fargo", 1996], ["The Usual Suspects", 1995],
    // Best Original Screenplay 1940-1989
    ["Dead Poets Society", 1989], ["Hannah and Her Sisters", 1986],
    ["Witness", 1985], ["Places in the Heart", 1984], ["Tender Mercies", 1983],
    ["Chinatown", 1974], ["Network", 1976], ["Dog Day Afternoon", 1975],
    ["The Sting", 1973], ["The Candidate", 1972], ["The Hospital", 1971],
    ["Butch Cassidy and the Sundance Kid", 1969], ["The Producers", 1968],
    ["Guess Who's Coming to Dinner", 1967], ["Divorce Italian Style", 1962],
    ["Splendor in the Grass", 1961], ["The Apartment", 1960],
    ["Citizen Kane", 1941], ["The Great McGinty", 1940],
    // Best Adapted Screenplay 1990+
    ["Conclave", 2024], ["American Fiction", 2023],
    ["Women Talking", 2022], ["The Father", 2020],
    ["Jojo Rabbit", 2019], ["BlacKkKlansman", 2018],
    ["Call Me by Your Name", 2017], ["The Big Short", 2015],
    ["The Imitation Game", 2014],
    // Best Adapted Screenplay 1940-1989
    ["Dangerous Liaisons", 1988], ["The Last Emperor", 1987], ["A Room with a View", 1986],
    ["Out of Africa", 1985], ["Amadeus", 1984], ["Terms of Endearment", 1983],
    ["Missing", 1982], ["On Golden Pond", 1981], ["Ordinary People", 1980],
    ["Kramer vs. Kramer", 1979], ["Midnight Express", 1978], ["Julia", 1977],
    ["All the President's Men", 1976], ["One Flew Over the Cuckoo's Nest", 1975],
    ["The Godfather Part II", 1974], ["The Exorcist", 1973],
    ["The Godfather", 1972], ["The French Connection", 1971],
    ["M*A*S*H", 1970], ["Midnight Cowboy", 1969],
    ["The Lion in Winter", 1968], ["In the Heat of the Night", 1967],
    ["A Man for All Seasons", 1966], ["Doctor Zhivago", 1965],
    ["Becket", 1964], ["Tom Jones", 1963], ["To Kill a Mockingbird", 1962],
    ["Judgment at Nuremberg", 1961], ["Elmer Gantry", 1960],
    ["Room at the Top", 1959], ["Gigi", 1958],
    ["The Bridge on the River Kwai", 1957], ["Around the World in 80 Days", 1956],
    ["Marty", 1955], ["The Country Girl", 1954], ["From Here to Eternity", 1953],
    ["All About Eve", 1950], ["A Letter to Three Wives", 1949],
    ["The Treasure of the Sierra Madre", 1948], ["Miracle on 34th Street", 1947],
    ["The Best Years of Our Lives", 1946], ["The Lost Weekend", 1945],
    ["Going My Way", 1944], ["Casablanca", 1943], ["Mrs. Miniver", 1942],
    ["How Green Was My Valley", 1941], ["The Philadelphia Story", 1940],
    // Best Animated Feature (2001+)
    ["Flow", 2024], ["The Boy and the Heron", 2023],
    ["Guillermo del Toro's Pinocchio", 2022], ["Encanto", 2021],
    ["Soul", 2020], ["Toy Story 4", 2019], ["Spider-Man: Into the Spider-Verse", 2018],
    ["Coco", 2017], ["Zootopia", 2016], ["Inside Out", 2015],
    ["Big Hero 6", 2014], ["Frozen", 2013], ["Brave", 2012],
    ["Rango", 2011], ["Toy Story 3", 2010], ["Up", 2009],
    ["WALL-E", 2008], ["Ratatouille", 2007], ["Happy Feet", 2006],
    ["Wallace & Gromit: The Curse of the Were-Rabbit", 2005],
    ["The Incredibles", 2004], ["Finding Nemo", 2003],
    ["Spirited Away", 2002], ["Shrek", 2001],
    // Best Documentary Feature 2000+
    ["No Other Land", 2024], ["20 Days in Mariupol", 2023],
    ["Navalny", 2022], ["Summer of Soul", 2021],
    ["My Octopus Teacher", 2020], ["American Factory", 2019],
    ["Free Solo", 2018], ["Icarus", 2017], ["O.J.: Made in America", 2016],
    ["Amy", 2015], ["Citizenfour", 2014], ["20 Feet from Stardom", 2013],
    ["Searching for Sugar Man", 2012], ["Undefeated", 2011],
    ["Inside Job", 2010], ["The Cove", 2009], ["Man on Wire", 2008],
    ["Taxi to the Dark Side", 2007], ["An Inconvenient Truth", 2006],
    ["March of the Penguins", 2005], ["Born into Brothels", 2004],
    ["Fog of War", 2003], ["Bowling for Columbine", 2002],
    // Best Documentary Feature 1940-1999
    ["Common Threads: Stories from the Quilt", 1989],
    ["Hotel Terminus: The Life and Times of Klaus Barbie", 1988],
    ["The Times of Harvey Milk", 1984], ["Hearts and Minds", 1974],
    ["Harlan County U.S.A.", 1976], ["Woodstock", 1970],
    ["The War Game", 1966], ["The Silent World", 1956],
    ["Kon-Tiki", 1951], ["The Living Desert", 1953],
  ],
  venice_golden_lion: [
    // 2000-2024
    ["The Room Next Door", 2024], ["Poor Things", 2023], ["All the Beauty and the Bloodshed", 2022],
    ["Happening", 2021], ["Nomadland", 2020], ["Joker", 2019],
    ["Roma", 2018], ["The Shape of Water", 2017], ["The Woman Who Left", 2016],
    ["From Afar", 2015], ["A Pigeon Sat on a Branch Reflecting on Existence", 2014],
    ["Sacro GRA", 2013], ["Pietà", 2012], ["Faust", 2011],
    ["Somewhere", 2010], ["Lebanon", 2009], ["The Wrestler", 2008],
    ["Lust, Caution", 2007], ["Still Life", 2006], ["Brokeback Mountain", 2005],
    ["Vera Drake", 2004], ["The Return", 2003], ["The Magdalene Sisters", 2002],
    ["Monsoon Wedding", 2001], ["The Circle", 2000],
    // 1990-1999
    ["Not One Less", 1999], ["The Way We Laughed", 1998], ["Hana-bi", 1997],
    ["Michael Collins", 1996], ["Cyclo", 1995],
    ["Vive L'Amour", 1994], ["Before the Rain", 1994],
    ["Short Cuts", 1993], ["Three Colours: Blue", 1993],
    ["The Story of Qiu Ju", 1992], ["Urga", 1991],
    ["Rosencrantz and Guildenstern Are Dead", 1990],
    // 1980-1989
    ["A City of Sadness", 1989], ["The Legend of the Holy Drinker", 1988],
    ["Au Revoir les Enfants", 1987], ["The Green Ray", 1986],
    ["Vagabond", 1985], ["Year of the Quiet Sun", 1984],
    ["First Name: Carmen", 1983], ["The State of Things", 1982],
    ["The German Sisters", 1981], ["Atlantic City", 1980], ["Gloria", 1980],
    // 1949-1968 (no Golden Lion 1969-1979)
    ["The Battle of Algiers", 1966], ["Belle de Jour", 1967],
    ["Red Desert", 1964], ["Hands over the City", 1963],
    ["Last Year at Marienbad", 1961], ["Le Passage du Rhin", 1960],
    ["General della Rovere", 1959], ["The Great War", 1959],
    ["Aparajito", 1957], ["Ordet", 1955], ["Romeo and Juliet", 1954],
    ["Rashomon", 1951], ["Forbidden Games", 1952],
    ["Justice Is Done", 1950], ["Manon", 1949],
  ],
  berlin_golden_bear: [
    // 2000-2025
    ["Dreams", 2025], ["Dahomey", 2024], ["On the Adamant", 2023],
    ["Alcarràs", 2022], ["Bad Luck Banging or Loony Porn", 2021],
    ["There Is No Evil", 2020], ["Synonyms", 2019],
    ["Touch Me Not", 2018], ["On Body and Soul", 2017],
    ["Fire at Sea", 2016], ["Taxi", 2015], ["Black Coal, Thin Ice", 2014],
    ["Child's Pose", 2013], ["Caesar Must Die", 2012],
    ["A Separation", 2011], ["Honey", 2010], ["The Milk of Sorrow", 2009],
    ["Troop", 2008], ["Tuya's Marriage", 2007], ["Grbavica", 2006],
    ["U-Carmen e-Khayelitsha", 2005], ["Head-On", 2004],
    ["In This World", 2003], ["Spirited Away", 2002],
    ["Intimacy", 2001], ["Magnolia", 2000],
    // 1990-1999
    ["The Thin Red Line", 1999], ["Central Station", 1998],
    ["The People vs. Larry Flynt", 1997], ["Sense and Sensibility", 1996],
    ["The Bait", 1995], ["In the Name of the Father", 1994],
    ["The Woman from the Lake of Scented Souls", 1993], ["The Wedding Banquet", 1993],
    ["Grand Canyon", 1992], ["House of Smiles", 1991],
    ["Music Box", 1990], ["Larks on a String", 1990],
    // 1980-1989
    ["Rain Man", 1989], ["Red Sorghum", 1988], ["The Theme", 1987],
    ["Stammheim", 1986], ["Wetherby", 1985], ["Love Streams", 1984],
    ["Ascendancy", 1983], ["The Beehive", 1983], ["Veronika Voss", 1982],
    ["Deprisa, Deprisa", 1981], ["Heartland", 1980], ["Palermo or Wolfsburg", 1980],
    // 1951-1979
    ["David", 1979], ["The Ascent", 1977],
    ["Buffalo Bill and the Indians", 1976], ["Adoption", 1975],
    ["The Apprenticeship of Duddy Kravitz", 1974], ["Distant Thunder", 1973],
    ["The Canterbury Tales", 1972], ["The Garden of the Finzi-Continis", 1971],
    ["Early Works", 1969], ["Cul-de-sac", 1966], ["Alphaville", 1965],
    ["Dry Summer", 1964], ["A Kind of Loving", 1962], ["La Notte", 1961],
    ["Wild Strawberries", 1958], ["Twelve Angry Men", 1957],
    ["Invitation to the Dance", 1956], ["The Rats", 1955],
    ["Hobson's Choice", 1954], ["The Wages of Fear", 1953],
    ["One Summer of Happiness", 1952], ["Four in a Jeep", 1951],
  ],
};

const AWARD_OPTIONS = {
  cannes: "Cannes Film Festival",
  oscar: "Academy Awards",
  venice_golden_lion: "Venice — Golden Lion",
  berlin_golden_bear: "Berlin — Golden Bear",
};

async function tmdbFetch(path, params = {}) {
  params.api_key = process.env.TMDB_API_KEY;
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`${TMDB_BASE}${path}?${qs}`);
  return resp.json();
}

async function omdbFetch(imdbId) {
  const resp = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.OMDB_API_KEY}`);
  return resp.json();
}

function getGenreId(genreName, mediaType) {
  const genres = mediaType === "movie" ? TMDB_GENRES : TV_GENRES;
  const lower = genreName.toLowerCase();
  for (const [id, name] of Object.entries(genres)) {
    if (name.toLowerCase().includes(lower)) return id;
  }
  return null;
}

async function getWatchProviders(titleId, mediaType) {
  const data = await tmdbFetch(`/${mediaType}/${titleId}/watch/providers`);
  return (data.results?.NL?.flatrate) || [];
}

async function getImdbId(tmdbId, mediaType) {
  const data = await tmdbFetch(`/${mediaType}/${tmdbId}/external_ids`);
  return data.imdb_id || null;
}

function getRtScore(omdbData) {
  for (const r of (omdbData.Ratings || [])) {
    if (r.Source === "Rotten Tomatoes") return parseInt(r.Value);
  }
  return null;
}

async function discoverTitles(genreId, providerIds, mediaType) {
  const ANIMATION_GENRE_ID = 16;
  const baseParams = {
    watch_region: "NL",
    with_watch_providers: providerIds.join("|"),
    with_genres: genreId,
    sort_by: "vote_average.desc",
    "vote_count.gte": 50,
    language: "en-US",
  };
  if (String(genreId) !== String(ANIMATION_GENRE_ID)) {
    baseParams.without_genres = ANIMATION_GENRE_ID;
  }

  const allResults = [];
  for (let page = 1; page <= 5; page++) {
    const data = await tmdbFetch(`/discover/${mediaType}`, { ...baseParams, page });
    const results = data.results || [];
    allResults.push(...results);
    if (results.length < 20) break;
  }
  return allResults;
}

// Check a single Claude suggestion against TMDB + NL streaming (used in parallel)
async function checkTitleOnTmdb(suggestion, providerIds, mediaType) {
  try {
    const data = await tmdbFetch(`/search/${mediaType}`, {
      query: suggestion.title,
      year: suggestion.year,
      language: "en-US",
    });
    const results = data.results || [];
    if (!results.length) return null;

    const title = results[0];
    const providers = await getWatchProviders(title.id, mediaType);
    const providerIdList = providers.map((p) => p.provider_id);
    if (!providerIds.some((pid) => providerIdList.includes(pid))) return null;
    return title;
  } catch {
    return null;
  }
}

async function discoverSimilar(movieTitle, providerIds, mediaType) {
  const Anthropic = require("@anthropic-ai/sdk");
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const kind = mediaType === "movie" ? "movies" : "TV series";
  let suggestions;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content:
          `List 30 critically acclaimed ${kind} that someone who loved '${movieTitle}' would enjoy. ` +
          `Only include titles with strong critical reception (e.g. 70%+ on Rotten Tomatoes, ` +
          `major festival selections, or widely praised by critics). ` +
          `Focus on similar tone, themes, and quality — not just the same genre. ` +
          `Mix well-known and hidden gems. Include recent and classic titles. ` +
          `Return ONLY a JSON array of objects with "title" and "year" fields. ` +
          `Example: [{"title": "Example Movie", "year": 2020}]\n` +
          `No explanation, no markdown, just the JSON array.`,
      }],
    });
    let text = message.content[0].text.trim();
    if (text.startsWith("```")) {
      text = text.split("\n").slice(1).join("\n").replace(/```\s*$/, "").trim();
    }
    suggestions = JSON.parse(text);
  } catch {
    return [];
  }

  // Check all suggestions in parallel
  const checks = suggestions.map((s) => checkTitleOnTmdb(s, providerIds, mediaType));
  const settled = await Promise.allSettled(checks);

  const results = [];
  const seenIds = new Set();
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) {
      const title = r.value;
      if (!seenIds.has(title.id)) {
        seenIds.add(title.id);
        results.push(title);
      }
    }
  }
  return results;
}

// Check a single award winner against TMDB + NL streaming (used in parallel)
async function checkAwardTitle(titleName, year, providerIds) {
  try {
    const data = await tmdbFetch("/search/movie", {
      query: titleName,
      year,
      language: "en-US",
    });
    const results = data.results || [];
    if (!results.length) return null;

    const movie = results[0];
    const providers = await getWatchProviders(movie.id, "movie");
    const providerIdList = providers.map((p) => p.provider_id);
    if (!providerIds.some((pid) => providerIdList.includes(pid))) return null;
    return movie;
  } catch {
    return null;
  }
}

async function discoverAwardWinners(awardKey, providerIds) {
  const winners = AWARD_LISTS[awardKey] || [];

  // Check all winners in parallel
  const checks = winners.map(([name, year]) => checkAwardTitle(name, year, providerIds));
  const settled = await Promise.allSettled(checks);

  const results = [];
  const seenIds = new Set();
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) {
      const movie = r.value;
      if (!seenIds.has(movie.id)) {
        seenIds.add(movie.id);
        results.push(movie);
      }
    }
  }
  return results;
}

// Enrich a single title with IMDb/OMDb data (used in parallel)
async function enrichSingle(title, mediaType) {
  try {
    const imdbId = await getImdbId(title.id, mediaType);
    if (!imdbId) return null;

    const omdb = await omdbFetch(imdbId);
    if (omdb.Response === "False") return null;

    const name = title.title || title.name || "Unknown";
    const year = (title.release_date || title.first_air_date || "").slice(0, 4);

    const providers = await getWatchProviders(title.id, mediaType);
    const availableOn = providers
      .filter((p) => p.provider_id in PROVIDER_NAMES)
      .map((p) => PROVIDER_NAMES[p.provider_id]);

    return {
      title: name,
      year,
      poster: `https://image.tmdb.org/t/p/w300${title.poster_path || ""}`,
      overview: title.overview || "",
      rt_score: getRtScore(omdb),
      imdb_rating: omdb.imdbRating || "N/A",
      imdb_id: imdbId,
      genres: omdb.Genre || "",
      awards: omdb.Awards || "",
      language: omdb.Language || "",
      plot: omdb.Plot || "",
      available_on: availableOn,
    };
  } catch {
    return null;
  }
}

// Batch Claude reviews: single API call for all titles
async function getBatchClaudeReviews(titles) {
  const Anthropic = require("@anthropic-ai/sdk");
  if (!process.env.ANTHROPIC_API_KEY || !titles.length) return {};

  const titlesText = titles
    .map((t, i) => `${i + 1}. ${t.title} (${t.year}): ${(t.plot || "").slice(0, 100)}`)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

    // Map back to title names
    const result = {};
    titles.forEach((t, i) => {
      const key = String(i + 1);
      if (key in reviews) {
        result[t.title] = reviews[key];
      }
    });
    return result;
  } catch {
    return {};
  }
}

module.exports = {
  PROVIDER_IDS, PROVIDER_NAMES, TMDB_GENRES, TV_GENRES,
  AWARD_OPTIONS,
  tmdbFetch, omdbFetch, getGenreId, getWatchProviders, getImdbId, getRtScore,
  discoverTitles, discoverSimilar, discoverAwardWinners,
  enrichSingle, getBatchClaudeReviews,
};
