$(document).ready(function() {
    let currentOffset = 0;
    const limit = 24;
    let currentGen = 'all';
    let currentTypeFilter = 'all';
    let currentRegionFilter = 'all';

    const pokemonModal = new bootstrap.Modal(document.getElementById('pokemonModal'));
    let isLoading = false;
    let allPokemonData = [];
    let currentFilteredIds = [];

    const pokemonDetailsCache = new Map();

    const genRanges = {
        '1': { start: 1, end: 151 }, '2': { start: 152, end: 251 },
        '3': { start: 252, end: 386 }, '4': { start: 387, end: 493 },
        '5': { start: 494, end: 649 }, '6': { start: 650, end: 721 },
        '7': { start: 722, end: 809 }, '8': { start: 810, end: 905 },
        '9': { start: 906, end: 1025 }
    };

    function formatPokemonId(id) {
        return '#' + id.toString().padStart(4, '0');
    }

    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1).replace('-', ' ');
    }

    async function fetchAllPokemonList() {
        $('#initialLoadingSpinner').show();
        $('#pokemonList').empty();

        try {
            const cachedList = localStorage.getItem('allPokemonList');
            if (cachedList) {
                allPokemonData = JSON.parse(cachedList);
                console.log("Loaded Pokemon list from cache.");
            } else {
                const response = await $.get(`https://pokeapi.co/api/v2/pokemon?limit=1025`);
                allPokemonData = response.results.map(p => {
                    const id = parseInt(p.url.split('/').slice(-2, -1)[0]);
                    return { name: p.name, url: p.url, id: id };
                });
                localStorage.setItem('allPokemonList', JSON.stringify(allPokemonData));
                console.log("Fetched and cached Pokemon list.");
            }
        } catch (error) {
            console.error("Failed to fetch initial Pokemon list:", error);
            $('#initialLoadingSpinner').hide();
            $('#pokemonList').html('<p class="text-center text-danger col-12 mt-4 no-pokemon-message">Could not load Pokémon data. Please check your connection and refresh.</p>');
        }
    }

    function filterPokemonIds() {
        const searchTerm = $('#searchInput').val().toLowerCase().trim();
        let filtered = allPokemonData;

        if (currentGen !== 'all') {
            const range = genRanges[currentGen];
            if (range) {
                filtered = filtered.filter(p => p.id >= range.start && p.id <= range.end);
            }
        }

        if (searchTerm) {
            const isNumericSearch = /^\d+$/.test(searchTerm);
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchTerm) ||
                (isNumericSearch && p.id.toString().includes(searchTerm)) ||
                ('#' + p.id.toString().padStart(4, '0')).includes(searchTerm)
            );
        }

        currentFilteredIds = filtered.map(p => p.id);
        console.log(`Filtered IDs count: ${currentFilteredIds.length}`);
    }

    async function getPokemonDetails(id) {
         if (pokemonDetailsCache.has(id)) {
             return pokemonDetailsCache.get(id);
         }
         try {
             const pokemon = await $.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
             pokemonDetailsCache.set(id, pokemon);
             return pokemon;
         } catch (error) {
             console.error(`Failed to fetch details for Pokémon ${id}:`, error);
             return null;
         }
    }

    async function loadPokemon(offset = 0, loadMore = false) {
        if (isLoading) return;
        isLoading = true;

        if (!loadMore) {
            $('#pokemonList').empty();
            if ($('#pokemonList').children().length === 0) {
                $('#initialLoadingSpinner').show();
            }
            $('#loadMoreBtn').hide();
        } else {
            $('#loadMoreSpinner').show();
            $('#loadMoreBtn').prop('disabled', true);
        }

        if (allPokemonData.length === 0) {
             console.warn("Master list not loaded yet.");
             isLoading = false;
             $('#initialLoadingSpinner').hide();
             if ($('#pokemonList').children().length === 0) {
                 $('#pokemonList').html('<p class="text-center text-muted col-12 mt-4 no-pokemon-message">Waiting for Pokémon data...</p>');
             }
             return;
        }

         let pokemonAddedCount = 0;
         let idsProcessed = 0;

         try {
             const idsToProcess = currentFilteredIds.slice(offset, offset + limit);
             idsProcessed = idsToProcess.length;

             if (idsToProcess.length === 0) {
                 if (!loadMore) {
                     $('#pokemonList').html('<p class="text-center text-muted col-12 mt-4 no-pokemon-message">No Pokémon found matching your criteria.</p>');
                 }
                 $('#loadMoreBtn').hide();
                 return;
             }

             const detailPromises = idsToProcess.map(id => getPokemonDetails(id));
             const pokemonDetailsList = (await Promise.all(detailPromises)).filter(p => p !== null);


             pokemonDetailsList.forEach(pokemon => {
                 const matchesType = currentTypeFilter === 'all' || pokemon.types.some(t => t.type.name === currentTypeFilter);

                 if (matchesType) {
                     createPokemonCard(pokemon);
                     pokemonAddedCount++;
                 }
             });

             currentOffset = offset + idsProcessed;

             if (currentOffset < currentFilteredIds.length) {
                 $('#loadMoreBtn').show();
             } else {
                 $('#loadMoreBtn').hide();
             }

             if (!loadMore && pokemonAddedCount === 0 && currentFilteredIds.length > 0 && currentOffset >= currentFilteredIds.length) {
                 $('#pokemonList').html('<p class="text-center text-muted col-12 mt-4 no-pokemon-message">No Pokémon found matching the selected type in this region/search.</p>');
             } else if (!loadMore && pokemonAddedCount === 0 && currentFilteredIds.length === 0) {
                  $('#pokemonList').html('<p class="text-center text-muted col-12 mt-4 no-pokemon-message">No Pokémon found matching your criteria.</p>');
             }


         } catch (error) {
             console.error('Error loading Pokemon batch:', error);
             if (!loadMore) {
                 $('#pokemonList').html('<p class="text-center text-danger col-12 mt-4 no-pokemon-message">Error loading Pokémon. Please try again.</p>');
             }
             $('#loadMoreBtn').hide();
         } finally {
             isLoading = false;
             $('#initialLoadingSpinner').hide();
             if (loadMore) {
                 $('#loadMoreSpinner').hide();
                 $('#loadMoreBtn').prop('disabled', false);
             }
         }
    }

    function createPokemonCard(pokemon) {
        const types = pokemon.types.map(type =>
            `<span class="type-badge type-${type.type.name}" title="${capitalizeFirstLetter(type.type.name)} Type">${type.type.name}</span>`
        ).join('');

        const imageUrl = pokemon.sprites.other['official-artwork']?.front_default
                        || pokemon.sprites.other?.home?.front_default
                        || pokemon.sprites.front_default
                        || PLACEHOLDER_IMAGE_URL;

        const card = `
            <div class="col-xl-3 col-lg-4 col-md-6 col-sm-6 col-6 d-flex">
                <div class="pokemon-card w-100 animate__animated animate__fadeIn" data-pokemon-id="${pokemon.id}">
                    <div class="pokemon-image-container">
                        <span class="pokemon-number">${formatPokemonId(pokemon.id)}</span>
                        <img src="${imageUrl}"
                             class="pokemon-image" alt="${pokemon.name}"
                             loading="lazy"
                             onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE_URL}';">
                    </div>
                    <div class="pokemon-info">
                        <h5 class="pokemon-name">${capitalizeFirstLetter(pokemon.name)}</h5>
                        <div class="pokemon-types">${types}</div>
                    </div>
                </div>
            </div>
        `;
        $('#pokemonList').append(card);
    }

     async function showPokemonDetails(pokemonId) {
         $('.modal-title').html('Loading...');
         $('.modal-body').html('<div class="text-center p-5 loading-spinner"><div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-3 text-muted">Loading details...</p></div>');

         const pokemon = await getPokemonDetails(pokemonId);

         if (!pokemon) {
             $('.modal-title').html('Error');
             $('.modal-body').html('<p class="text-center text-danger p-4">Could not load Pokémon details. Please try again later.</p>');
             return;
         }

         const types = pokemon.types.map(type =>
             `<span class="type-badge type-${type.type.name}">${type.type.name}</span>`
         ).join('');
         const imageUrl = pokemon.sprites.other['official-artwork']?.front_default
                         || pokemon.sprites.other?.home?.front_default
                         || pokemon.sprites.front_default
                         || PLACEHOLDER_IMAGE_URL;

         let speciesData = null;
         let flavorText = 'No description available.';
         let growthRate = 'N/A';
         let genderRate = -1;
         try {
             const speciesCacheKey = `species-${pokemon.species.url}`;
             if (pokemonDetailsCache.has(speciesCacheKey)) {
                 speciesData = pokemonDetailsCache.get(speciesCacheKey);
             } else {
                 speciesData = await $.get(pokemon.species.url);
                 pokemonDetailsCache.set(speciesCacheKey, speciesData);
             }

             const englishFlavorText = speciesData.flavor_text_entries.find(entry => entry.language.name === 'en');
             if (englishFlavorText) {
                 flavorText = englishFlavorText.flavor_text.replace(/[\n\f\u000c]/g, ' ');
             }
             growthRate = speciesData.growth_rate ? capitalizeFirstLetter(speciesData.growth_rate.name) : 'N/A';
             genderRate = speciesData.gender_rate;
         } catch(e) { console.error("Could not fetch species data", e)}

         const abilitiesHtml = pokemon.abilities.map(abilityInfo => {
             return `<span class="ability-tag" title="${abilityInfo.is_hidden ? 'Hidden Ability' : 'Standard Ability'}">
                          ${capitalizeFirstLetter(abilityInfo.ability.name)}
                          ${abilityInfo.is_hidden ? '<span class="ability-hidden-indicator">(H)</span>' : ''}
                      </span>`;
         }).join('');

         const maxStatValue = 255;
         const stats = pokemon.stats.map(stat => `
             <div class="stat-row">
                 <span class="stat-label">${capitalizeFirstLetter(stat.stat.name)}</span>
                 <div class="progress">
                     <div class="progress-bar"
                          role="progressbar"
                          style="width: 0%"
                          data-stat-value="${stat.base_stat}"
                          aria-valuenow="${stat.base_stat}"
                          aria-valuemin="0"
                          aria-valuemax="${maxStatValue}">
                     </div>
                 </div>
                 <span class="stat-value">${stat.base_stat}</span>
             </div>
         `).join('');

         let genderDisplay;
         if (genderRate === -1) {
            genderDisplay = `<p class="detail-item-value">Genderless</p>`;
         } else {
            const femalePercent = ((genderRate / 8) * 100);
            const femalePercentStr = femalePercent === 100 ? "100" : femalePercent.toFixed(1);
            const malePercentStr = femalePercent === 0 ? "100" : (100 - femalePercent).toFixed(1);
            genderDisplay = `<p class="detail-item-value small"><i class="fas fa-venus text-danger"></i> ${femalePercentStr}% / <i class="fas fa-mars text-primary"></i> ${malePercentStr}%</p>`;
         }

         const modalContent = `
             <div class="row">
                 <div class="col-lg-5 mb-4 mb-lg-0">
                     <div class="modal-pokemon-image-container">
                        <img src="${imageUrl}" class="modal-pokemon-image" alt="${pokemon.name}" onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE_URL}';">
                     </div>
                     <div class="modal-types-abilities">
                         <h6 class="modal-section-title">Types</h6>
                         <div class="modal-types-container mb-4"> ${types} </div>
                         <h6 class="modal-section-title">Abilities</h6>
                         <div class="ability-container"> ${abilitiesHtml || '<span class="text-muted small">No abilities data</span>'} </div>
                     </div>
                 </div>
                 <div class="col-lg-7">
                     <div class="modal-flavor-text"> ${flavorText} </div>
                     <div class="modal-details-grid">
                         <div class="detail-item"><i class="fas fa-ruler-vertical"></i><h6 class="detail-item-label">Height</h6><p class="detail-item-value">${pokemon.height / 10} m</p></div>
                         <div class="detail-item"><i class="fas fa-weight-hanging"></i><h6 class="detail-item-label">Weight</h6><p class="detail-item-value">${pokemon.weight / 10} kg</p></div>
                         <div class="detail-item"><i class="fas fa-venus-mars"></i><h6 class="detail-item-label">Gender</h6>${genderDisplay}</div>
                         <div class="detail-item"><i class="fas fa-seedling"></i><h6 class="detail-item-label">Growth Rate</h6><p class="detail-item-value small">${growthRate}</p></div>
                     </div>
                     <div class="stats-container mt-4">
                         <h6 class="modal-section-title mb-4">Base Stats</h6>
                         ${stats}
                     </div>
                 </div>
             </div>
         `;

         $('.modal-title').html(`${capitalizeFirstLetter(pokemon.name)} <span class="pokemon-id-modal">${formatPokemonId(pokemon.id)}</span>`);
         $('.modal-body').html(modalContent);

         setTimeout(() => {
             $('.modal-body .progress-bar').each(function() {
                 const value = $(this).data('stat-value');
                 $(this).css('width', (value / maxStatValue) * 100 + '%');
             });
         }, 150);
     }

     $('#loadMoreBtn').click(function() {
         loadPokemon(currentOffset, true);
     });

     function debounce(func, wait) {
         let timeout;
         return function executedFunction(...args) {
             const later = () => {
                 clearTimeout(timeout);
                 func(...args);
             };
             clearTimeout(timeout);
             timeout = setTimeout(later, wait);
         };
     }

     const debouncedSearch = debounce(() => {
        currentOffset = 0;
        filterPokemonIds();
        loadPokemon(0, false);
     }, 400);

     $('#searchInput').on('input', debouncedSearch);

    function handleFilterChange(filterType) {
        currentOffset = 0;
        filterPokemonIds();
        loadPokemon(0, false);
    }

     $('#typeFilterList').on('click', '.type-filter-item', function(e) {
         e.preventDefault();
         if ($(this).hasClass('active')) return;

         const selectedType = $(this).data('value');
         currentTypeFilter = selectedType;

         $('#typeFilterList .type-filter-item').removeClass('active');
         $(this).addClass('active');
         const typeText = selectedType === 'all' ? 'Filter by Type' : `Type: ${capitalizeFirstLetter(selectedType)}`;
         $('#typeDropdownLabel').html(`<i class="fas fa-filter me-1"></i> ${typeText}`);

         handleFilterChange('type');
     });

    $('#regionFilterList').on('click', '.region-filter-item', function(e) {
         e.preventDefault();
         if ($(this).hasClass('active')) return;

         const selectedRegion = $(this).data('value');
         const selectedGen = $(this).data('gen').toString();

         currentRegionFilter = selectedRegion;
         currentGen = selectedGen;

         $('#regionFilterList .region-filter-item').removeClass('active');
         $(this).addClass('active');
         const regionText = selectedRegion === 'all' ? 'Filter by Region' : `Region: ${capitalizeFirstLetter(selectedRegion)}`;
         $('#regionDropdownLabel').html(`<i class="fas fa-map-location-dot me-1"></i> ${regionText}`);

         handleFilterChange('region');
    });

    $('#pokemonList').on('click', '.pokemon-card', function() {
         const pokemonId = $(this).data('pokemon-id');
         if (pokemonId && !isLoading) {
             pokemonModal.show();
             showPokemonDetails(pokemonId);
         }
    });

    async function initialize() {
        await fetchAllPokemonList();
        filterPokemonIds();
        loadPokemon();
    }

    initialize();
});