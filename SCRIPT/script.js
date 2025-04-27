$(document).ready(function() {
    // Variables
    let currentOffset = 0;
    const limit = 20;
    let currentGen = 'all';
    let isLoading = false;
    let allPokemonIds = [];
    
    // Generation ranges
    const genRanges = {
        '1': { start: 1, end: 151 },
        '2': { start: 152, end: 251 },
        '3': { start: 252, end: 386 },
        '4': { start: 387, end: 493 },
        '5': { start: 494, end: 649 },
        '6': { start: 650, end: 721 },
        '7': { start: 722, end: 809 },
        '8': { start: 810, end: 905 },
        '9': { start: 906, end: 1025 }
    };

    // Helper Functions
    function formatPokemonId(id) {
        return '#' + id.toString().padStart(4, '0');
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Fetch Pokemon IDs
    async function fetchPokemonIds(gen = 'all') {
        if (gen === 'all') {
            const response = await $.get('https://pokeapi.co/api/v2/pokemon?limit=1025');
            allPokemonIds = response.results.map(p => parseInt(p.url.split('/').slice(-2, -1)[0]));
        } else {
            allPokemonIds = [];
            const range = genRanges[gen];
            for (let i = range.start; i <= range.end; i++) {
                allPokemonIds.push(i);
            }
        }
    }

    // Load Pokemon
    async function loadPokemon(offset = 0, loadMore = false) {
        if (isLoading) return;
        isLoading = true;

        const loadingSpinner = loadMore ? '#loadMoreSpinner' : '#initialLoadingSpinner';
        $(loadingSpinner).show();
        if (!loadMore) {
            $('#pokemonList').empty();
            $('#loadMoreBtn').hide();
        }

        try {
            const idsToLoad = allPokemonIds.slice(offset, offset + limit);
            
            if (idsToLoad.length === 0) {
                $('#loadMoreBtn').hide();
                return;
            }

            const promises = idsToLoad.map(id => 
                $.get(`https://pokeapi.co/api/v2/pokemon/${id}`)
                    .catch(err => null)
            );
            
            const pokemons = (await Promise.all(promises)).filter(p => p !== null);

            pokemons.forEach(createPokemonCard);
            
            currentOffset = offset + pokemons.length;
            
            $('#loadMoreBtn').toggle(currentOffset < allPokemonIds.length);

        } catch (error) {
            console.error('Error loading Pokemon:', error);
        } finally {
            isLoading = false;
            $(loadingSpinner).hide();
            $('#loadMoreBtn').prop('disabled', false);
        }
    }

    // Create Pokemon Card
    function createPokemonCard(pokemon) {
        const types = pokemon.types.map(type =>
            `<span class="type-badge type-${type.type.name}">${type.type.name}</span>`
        ).join('');

        const imageUrl = pokemon.sprites.other['official-artwork']?.front_default || 
                        pokemon.sprites.front_default;

        const card = `
            <div class="col-xl-3 col-lg-4 col-md-6 mb-4">
                <div class="pokemon-card" data-pokemon-id="${pokemon.id}">
                    <div class="pokemon-image-container">
                        <img src="${imageUrl}" class="pokemon-image" alt="${pokemon.name}">
                    </div>
                    <div class="pokemon-info">
                        <span class="pokemon-number">${formatPokemonId(pokemon.id)}</span>
                        <h5 class="pokemon-name">${pokemon.name}</h5>
                        <div class="pokemon-types">${types}</div>
                    </div>
                </div>
            </div>
        `;
        
        $('#pokemonList').append(card);
    }

    // Show Pokemon Details
    async function showPokemonDetails(pokemon) {
        const modal = $('#pokemonModal');
        const types = pokemon.types.map(type =>
            `<span class="type-badge type-${type.type.name}">${type.type.name}</span>`
        ).join('');

        const stats = pokemon.stats.map(stat => `
            <div class="stat-row">
                <div class="d-flex justify-content-between mb-1">
                    <span>${capitalizeFirstLetter(stat.stat.name.replace('-', ' '))}</span>
                    <span>${stat.base_stat}</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" 
                         style="width: ${(stat.base_stat / 255) * 100}%" 
                         aria-valuenow="${stat.base_stat}" aria-valuemin="0" 
                         aria-valuemax="255">
                    </div>
                </div>
            </div>
        `).join('');

        const modalContent = `
            <div class="row">
                <div class="col-md-5 text-center">
                    <img src="${pokemon.sprites.other['official-artwork']?.front_default || 
                              pokemon.sprites.front_default}" 
                         class="modal-pokemon-image mb-3" alt="${pokemon.name}">
                    <div class="d-flex justify-content-center gap-2 mb-3">
                        ${types}
                    </div>
                </div>
                <div class="col-md-7">
                    <div class="stats-container">
                        <h5 class="text-center mb-4">Base Stats</h5>
                        ${stats}
                    </div>
                </div>
            </div>
        `;

        modal.find('.modal-title').text(capitalizeFirstLetter(pokemon.name));
        modal.find('.modal-body').html(modalContent);
        
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    }

    // Event Listeners
    $('#loadMoreBtn').click(() => loadPokemon(currentOffset, true));

    $('.gen-btn').click(async function() {
        $('.gen-btn').removeClass('active');
        $(this).addClass('active');
        currentGen = $(this).data('gen');
        currentOffset = 0;
        await fetchPokemonIds(currentGen);
        loadPokemon();
    });

    $(document).on('click', '.pokemon-card', function() {
        const pokemonId = $(this).data('pokemon-id');
        if (pokemonId) {
            $.get(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`)
                .then(showPokemonDetails)
                .catch(console.error);
        }
    });

    // Search functionality
    let searchTimeout;
    $('#searchInput').on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const searchTerm = $(this).val().toLowerCase().trim();
            if (!searchTerm) {
                loadPokemon(0);
                return;
            }

            $('#pokemonList').empty();
            $('#loadMoreBtn').hide();
            $('#initialLoadingSpinner').show();

            try {
                const filteredIds = allPokemonIds.filter(id => 
                    id.toString().includes(searchTerm)
                );

                const searchPromises = filteredIds.slice(0, 20).map(id =>
                    $.get(`https://pokeapi.co/api/v2/pokemon/${id}`)
                );

                const pokemons = await Promise.all(searchPromises);
                pokemons.forEach(createPokemonCard);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                $('#initialLoadingSpinner').hide();
            }
        }, 300);
    });

    // Initialize
    fetchPokemonIds().then(() => loadPokemon());
});
