with open(r'C:\Users\gebel\.gemini\antigravity\scratch\zapitv_app\App.tsx', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Replace filteredContent block
start_str = 'const filteredContent = useMemo(() => {'
end_str = '}, [content, debouncedSearchQuery, currentView, selectedGenre]);'

start_idx = text.find(start_str)
end_idx = text.find(end_str, start_idx) + len(end_str)

new_filtered = '''const filteredContent = useMemo(() => {
    let baseFiltered = content;
    
    if (debouncedSearchQuery.trim()) {
      if (liveSearchResults.length > 0) {
        return liveSearchResults;
      }
      const normalizedQuery = debouncedSearchQuery.toLowerCase();
      return baseFiltered.filter(item => 
        item.title.toLowerCase().includes(normalizedQuery)
      );
    }

    if (currentView === 'movies') {
      baseFiltered = popularMovies.length > 0 ? popularMovies : baseFiltered.filter(i => i.type === ContentType.MOVIE);
    } else if (currentView === 'series') {
      baseFiltered = popularSeries.length > 0 ? popularSeries : baseFiltered.filter(i => i.type === ContentType.SERIES);
    } else if (currentView === 'animes') {
      baseFiltered = animeItems.length > 0 ? animeItems : baseFiltered.filter(i => 
        i.type === ContentType.ANIME || 
        (i.genres && i.genres.includes('Anime'))
      );
    } else if (currentView === 'featured') {
      baseFiltered = trendingItems.length > 0 ? trendingItems : baseFiltered.filter(i => i.isFeatured);
    } else if (currentView === 'mylist') {
      baseFiltered = baseFiltered.filter(i => favorites.includes(i.id) || myList.includes(i.id));
    }

    if (selectedGenre) baseFiltered = baseFiltered.filter(i => i.genres?.includes(selectedGenre));

    return baseFiltered;
  }, [content, debouncedSearchQuery, liveSearchResults, currentView, selectedGenre, popularMovies, popularSeries, animeItems, trendingItems, favorites, myList]);'''

if start_idx != -1 and end_idx != -1:
    text = text[:start_idx] + new_filtered + text[end_idx:]
    print('FilteredContent successfully updated!')

# Now update Hero featuredItems in Home view
hero_old = 'featuredItems={content.filter(i => i.isFeatured)}'
hero_new = 'featuredItems={trendingItems.length > 0 ? trendingItems.slice(0, 8) : content.filter(i => i.isFeatured)}'
if hero_old in text:
    text = text.replace(hero_old, hero_new)
    print('Hero featuredItems updated to trendingItems!')

# Now update rows
row_recent_old = 'items={recentItems}'
row_recent_new = 'items={popularMovies.length > 0 ? popularMovies : recentItems}'
text = text.replace(row_recent_old, row_recent_new)

row_premium_old = 'items={premiumItems}'
row_premium_new = 'items={trendingItems.length > 0 ? trendingItems : premiumItems}'
text = text.replace(row_premium_old, row_premium_new)

row_netflix_old = "items={content.filter(i => i.platform?.includes('Netflix'))}"
row_netflix_new = "items={popularSeries.length > 0 ? popularSeries : content.filter(i => i.platform?.includes('Netflix'))}"
text = text.replace(row_netflix_old, row_netflix_new)

row_prime_old = "items={content.filter(i => i.platform?.includes('Prime Video'))}"
row_prime_new = "items={topRatedItems.length > 0 ? topRatedItems : content.filter(i => i.platform?.includes('Prime Video'))}"
text = text.replace(row_prime_old, row_prime_new)

row_hbo_old = "items={content.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO'))}"
row_hbo_new = "items={animeItems.length > 0 ? animeItems : content.filter(i => i.platform?.includes('Max') || i.platform?.includes('HBO'))}"
text = text.replace(row_hbo_old, row_hbo_new)

print('Rows updated!')

# Now add Continue Watching row right above premium row if continueWatchingList has items
cw_target = '<ContentRow \n                  title={sectionTitles.premium}'
cw_block = '''{continueWatchingList.length > 0 && (
                  <ContentRow 
                    title="Continuar Assistindo" 
                    items={continueWatchingList.map(p => p.item)} 
                    isDarkMode={isDarkMode} 
                    onItemClick={setSelectedContent} 
                    myList={myList} 
                    favorites={favorites} 
                    onToggleFavorite={toggleFavorite} 
                    onToggleList={toggleMyList} 
                  />
                )}
                <ContentRow 
                  title={sectionTitles.premium}'''

if cw_target in text:
    text = text.replace(cw_target, cw_block)
    print('Continue watching row inserted!')

with open(r'C:\Users\gebel\.gemini\antigravity\scratch\zapitv_app\App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('App.tsx saved successfully!')
