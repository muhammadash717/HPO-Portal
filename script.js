/**
 * HPO Portal - Human Phenotype Ontology Search Tool
 * 
 * This script provides functionality for searching HPO terms, viewing details,
 * managing selections, and exporting data. It interfaces with multiple APIs
 * including the NIH Clinical Tables API and JAX Ontology API.
 * 
 * @author Muhammad Ashraf
 * @version 1.0
 * @license MIT
 */

// =============================================================================
// DOM ELEMENTS MANAGEMENT
// =============================================================================

/**
 * Cached DOM elements for better performance and maintainability
 * Elements are grouped by functionality for better organization
 */
const DOM = {
    // Search and Results Section
    search: {
        input: document.getElementById('searchInput'),
        list: document.getElementById('resultsList'),
        count: document.getElementById('resultsCount')
    },
    
    // Selection Management Section
    selection: {
        list: document.getElementById('selectedList'),
        count: document.getElementById('selectedCount'),
        exportBtn: document.getElementById('exportBtn'),
        clearBtn: document.getElementById('clearBtn')
    },
    
    // Modal Dialog Elements
    modal: {
        container: document.getElementById('termModal'),
        closeBtn: document.querySelector('.close'),
        name: document.getElementById('modalTermName'),
        id: document.getElementById('modalTermId'),
        definition: document.getElementById('modalTermDefinition'),
        synonyms: document.getElementById('modalTermSynonyms'),
        addBtn: document.getElementById('addFromModal'),
        genes: document.getElementById('modalGenes'),
        diseases: document.getElementById('modalDiseases'),
        parents: document.getElementById('modalParents'),
        children: document.getElementById('modalChildren')
    },
    
    // Favorites Section
    favorites: {
        list: document.getElementById('favorites-list')
    }
};

// =============================================================================
// APPLICATION STATE MANAGEMENT
// =============================================================================

/**
 * Application state object to manage data and UI state
 * Centralized state makes the application more predictable and easier to debug
 */
const AppState = {
    // Currently selected HPO terms
    selectedTerms: [],
    
    // Current term being viewed in modal
    currentTerm: null,
    
    // Search debounce timer reference
    searchTimeout: null,
    
    // Flag to track if modal data is loading
    isLoadingModalData: false
};

// =============================================================================
// APPLICATION CONSTANTS AND CONFIGURATION
// =============================================================================

/**
 * API endpoints configuration
 * Centralized configuration makes API changes easier to manage
 */
const API_CONFIG = {
    HPO_SEARCH: (query) => 
        `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms=${encodeURIComponent(query)}&maxList=500&df=id,name,definition,synonym.term`,
    
    JAX_TERM: (hpId) => 
        `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}`,
    
    JAX_ANNOTATIONS: (hpId) => 
        `https://ontology.jax.org/api/network/annotation/${encodeURIComponent(hpId)}`,
    
    JAX_PARENTS: (hpId) => 
        `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}/parents`,
    
    JAX_CHILDREN: (hpId) => 
        `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}/children`
};

/**
 * UI state templates for consistent user experience
 */
const UI_STATES = {
    EMPTY_SEARCH: {
        html: `<li class="empty-state">
            <i class="fas fa-search"></i>
            <p>Start typing to search HPO terms.</p>
        </li>`,
        count: '0 terms found'
    },
    
    LOADING: {
        html: `<li class="loading">
            <i class="fas fa-spinner"></i>
            <p>Searching HPO database...</p>
        </li>`,
        count: 'Searching...'
    },
    
    NO_RESULTS: {
        html: `<li class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>No matching terms found</p>
            <p>Try a different search term</p>
        </li>`,
        count: '0 terms found'
    },
    
    ERROR: {
        html: `<li class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error fetching data</p>
            <p>Please try again later</p>
        </li>`,
        count: '0 terms found'
    },
    
    EMPTY_SELECTION: {
        html: `<li class="empty-state">
            <i class="fas fa-clipboard-list"></i>
            <p>No terms selected yet.</p>
            <p>Select terms from the search results.</p>
        </li>`
    }
};

/**
 * Frequently used HPO terms for quick access
 * These are common terms that users might search for regularly
 */
const FREQUENT_TERMS = [
    { id: "HP:0001263", name: "Global developmental delay" },
    { id: "HP:0001250", name: "Seizure" },
    { id: "HP:0000256", name: "Macrocephaly" },
    { id: "HP:0000252", name: "Microcephaly" },
    { id: "HP:0001252", name: "Hypotonia" },
    { id: "HP:0001508", name: "Failure to thrive" },
    { id: "HP:0000789", name: "Infertility" },
    { id: "HP:0000027", name: "Azoospermia" },
    { id: "HP:0034241", name: "Prenatal death" },
    { id: "HP:0200067", name: "Recurrent spontaneous abortion" },
    { id: "HP:0000083", name: "Renal insufficiency" },
    { id: "HP:0000107", name: "Renal cyst" }
];

// Configuration constants
const DEBOUNCE_DELAY = 500; // milliseconds

// =============================================================================
// EVENT HANDLERS AND USER INTERACTION
// =============================================================================

/**
 * Initialize all event listeners for the application
 * Centralized event setup makes the application easier to maintain
 */
function initializeEventListeners() {
    // Search functionality
    DOM.search.input.addEventListener('input', handleSearchInput);
    
    // Selection management
    DOM.selection.exportBtn.addEventListener('click', exportSelectedTerms);
    DOM.selection.clearBtn.addEventListener('click', clearAllSelections);
    
    // Modal functionality
    DOM.modal.closeBtn.addEventListener('click', closeModal);
    DOM.modal.addBtn.addEventListener('click', addCurrentTermFromModal);
    
    // Global event listeners
    window.addEventListener('click', handleWindowClick);
}

/**
 * Handle search input with debouncing to prevent excessive API calls
 * @param {Event} event - Input event from search field
 */
function handleSearchInput(event) {
    const query = event.target.value.trim();
    
    if (!query) {
        showEmptySearchState();
        return;
    }
    
    showLoadingState();
    clearTimeout(AppState.searchTimeout);
    
    AppState.searchTimeout = setTimeout(() => {
        performHPOSearch(query);
    }, DEBOUNCE_DELAY);
}

/**
 * Handle window click events for modal dismissal
 * @param {Event} event - Click event
 */
function handleWindowClick(event) {
    if (event.target === DOM.modal.container) {
        closeModal();
    }
}

// =============================================================================
// SEARCH FUNCTIONALITY
// =============================================================================

/**
 * Perform HPO search using NIH Clinical Tables API
 * @param {string} query - Search term from user input
 */
async function performHPOSearch(query) {
    try {
        const response = await fetch(API_CONFIG.HPO_SEARCH(query));
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const results = data[3] || []; // Results are in the 4th array element
        
        if (results.length > 0) {
            const terms = processSearchResults(results);
            displaySearchResults(terms);
        } else {
            showNoResultsState();
        }
    } catch (error) {
        console.error('Error fetching HPO data:', error);
        showErrorState();
    }
}

/**
 * Process raw search results into standardized term objects
 * @param {Array} rawResults - Raw results from HPO API
 * @returns {Array} Processed term objects
 */
function processSearchResults(rawResults) {
    return rawResults.map(termData => ({
        id: termData[0] || '',
        name: termData[1] || '',
        definition: termData[2] || '',
        synonyms: termData[3] || ''
    }));
}

/**
 * Display search results in the results list
 * @param {Array} terms - Array of term objects to display
 */
function displaySearchResults(terms) {
    DOM.search.list.innerHTML = '';
    DOM.search.count.textContent = `${terms.length} terms found`;
    
    terms.forEach(term => {
        const listItem = createSearchResultListItem(term);
        DOM.search.list.appendChild(listItem);
    });
}

/**
 * Create a list item element for search results
 * @param {Object} term - Term object with id, name, definition, synonyms
 * @returns {HTMLLIElement} Configured list item element
 */
function createSearchResultListItem(term) {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `
        <div class="result-content">
            <span class="term-name">${escapeHTML(term.name)} - </span>
            <span class="hpo-id">${escapeHTML(term.id)}</span>
        </div>
        <div class="term-actions">
            <i class="fas fa-info-circle info-icon" title="View details"></i>
        </div>
    `;
    
    // Add term to selection on click (excluding info icon)
    li.addEventListener('click', (event) => {
        if (!event.target.classList.contains('info-icon') && 
            !event.target.parentElement.classList.contains('term-actions')) {
            addTermToSelection(term);
        }
    });
    
    // Show term details when info icon is clicked
    const infoIcon = li.querySelector('.info-icon');
    infoIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        showTermDetailsModal(term);
    });
    
    return li;
}

// =============================================================================
// MODAL DIALOG FUNCTIONALITY
// =============================================================================

/**
 * Display term details in modal dialog
 * @param {Object} term - Term object to display details for
 */
async function showTermDetailsModal(term) {
    AppState.currentTerm = term;
    AppState.isLoadingModalData = true;
    
    updateModalBasicInfo(term);
    await loadModalDefinitionAndSynonyms(term);
    initializeModalLoadingStates();
    
    DOM.modal.container.style.display = 'block';
    
    if (term.id) {
        await loadModalAnnotations(term.id);
    } else {
        showModalNoDataState();
    }
    
    AppState.isLoadingModalData = false;
}

/**
 * Update basic term information in modal (name and ID)
 * @param {Object} term - Term object with name and id properties
 */
function updateModalBasicInfo(term) {
    DOM.modal.name.textContent = term.name || 'No name available';
    DOM.modal.id.textContent = term.id || 'No ID available';
}

/**
 * Load and display definition and synonyms in modal
 * @param {Object} term - Term object to load data for
 */
async function loadModalDefinitionAndSynonyms(term) {
    // Load definition if not already available
    if (!term.definition) {
        term.definition = await fetchTermDefinition(term.id);
    }
    DOM.modal.definition.textContent = term.definition || 'No definition available';
    
    // Load synonyms if not already available
    if (!term.synonyms) {
        term.synonyms = await fetchTermSynonyms(term.id);
    }
    displayModalSynonyms(term.synonyms);
}

/**
 * Display synonyms in the modal dialog
 * @param {string|Array} synonyms - Synonyms data (string or array)
 */
function displayModalSynonyms(synonyms) {
    DOM.modal.synonyms.innerHTML = '';
    
    const synonymsArray = parseSynonyms(synonyms);
    
    if (synonymsArray.length > 0) {
        synonymsArray.forEach(synonym => {
            const li = document.createElement('li');
            li.textContent = synonym;
            DOM.modal.synonyms.appendChild(li);
        });
    } else {
        DOM.modal.synonyms.innerHTML = '<li>No synonyms available</li>';
    }
}

/**
 * Parse synonyms from various formats into a standardized array
 * @param {string|Array} synonyms - Synonyms in string or array format
 * @returns {Array} Array of synonym strings
 */
function parseSynonyms(synonyms) {
    if (!synonyms) return [];
    
    if (typeof synonyms === 'string') {
        return synonyms.split(';').map(s => s.trim()).filter(s => s);
    }
    
    if (Array.isArray(synonyms)) {
        return synonyms.map(String).map(s => s.trim()).filter(s => s);
    }
    
    return [];
}

/**
 * Initialize loading states for modal sections
 */
function initializeModalLoadingStates() {
    const loadingConfig = [
        { element: DOM.modal.parents, text: 'Loading parent terms...' },
        { element: DOM.modal.children, text: 'Loading child terms...' },
        { element: DOM.modal.genes, text: 'Loading associated genes...' },
        { element: DOM.modal.diseases, text: '<li><em>Loading associated diseases...</em></li>' }
    ];
    
    loadingConfig.forEach(({ element, text }) => {
        if (element) element.innerHTML = text;
    });
}

/**
 * Load and display JAX annotations in modal
 * @param {string} hpId - HPO term ID to load annotations for
 */
async function loadModalAnnotations(hpId) {
    try {
        const annotations = await fetchJAXAnnotations(hpId);
        updateModalWithAnnotations(annotations);
        setupGeneCopyFunctionality();
    } catch (error) {
        console.warn('Error loading JAX annotations:', error);
        showModalErrorState();
    }
}

/**
 * Update modal with fetched annotation data
 * @param {Object} annotations - Annotation data object
 */
function updateModalWithAnnotations(annotations) {
    updateModalRelationshipList(DOM.modal.parents, annotations.parents, 'parent');
    updateModalRelationshipList(DOM.modal.children, annotations.children, 'child');
    updateModalGenesList(annotations.genes);
    updateModalDiseasesList(annotations.diseases);
}

/**
 * Update relationship lists (parents/children) in modal
 * @param {HTMLElement} container - DOM element to populate
 * @param {Array} items - Array of relationship items
 * @param {string} type - Type of relationship ('parent' or 'child')
 */
function updateModalRelationshipList(container, items, type) {
    if (!container) return;
    
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = `<li>No associated ${type} terms found</li>`;
        return;
    }
    
    items.forEach(item => {
        const listItem = createInteractiveRelationshipItem(item, type);
        container.appendChild(listItem);
    });
}

/**
 * Create an interactive list item for relationship terms
 * @param {Object} item - Relationship term object
 * @param {string} type - Type of relationship
 * @returns {HTMLLIElement} Configured list item
 */
function createInteractiveRelationshipItem(item, type) {
    const li = document.createElement('li');
    
    // Term text
    const textSpan = document.createElement('span');
    textSpan.textContent = `${item.name} (${item.id})`;
    
    // Info action button
    const infoButton = createActionButton('info-circle', () => showTermDetailsModal(item));
    
    // Add action button
    const addButton = createActionButton('plus-circle', () => addTermToSelection(item));
    
    li.append(textSpan, infoButton, addButton);
    return li;
}

/**
 * Create an action button with icon
 * @param {string} iconName - FontAwesome icon name
 * @param {Function} onClick - Click event handler
 * @returns {HTMLSpanElement} Configured action button
 */
function createActionButton(iconName, onClick) {
    const button = document.createElement('span');
    button.style.cssText = 'cursor: pointer; margin-left: 10px;';
    button.innerHTML = `<i class="fa fa-${iconName}" aria-hidden="true"></i>`;
    button.addEventListener('click', onClick);
    return button;
}

/**
 * Update genes list in modal
 * @param {Array} genes - Array of gene names
 */
function updateModalGenesList(genes) {
    if (!DOM.modal.genes) return;
    
    DOM.modal.genes.innerHTML = '';
    
    if (genes.length > 0) {
        genes.forEach(geneName => {
            const geneChip = document.createElement('span');
            geneChip.className = 'gene-chip';
            geneChip.textContent = geneName;
            DOM.modal.genes.appendChild(geneChip);
        });
    } else {
        DOM.modal.genes.innerHTML = '<em>No associated genes found</em>';
    }
}

/**
 * Update diseases list in modal
 * @param {Array} diseases - Array of disease strings
 */
function updateModalDiseasesList(diseases) {
    if (!DOM.modal.diseases) return;
    
    DOM.modal.diseases.innerHTML = '';
    
    if (diseases.length > 0) {
        diseases.forEach(disease => {
            const li = document.createElement('li');
            li.textContent = disease;
            DOM.modal.diseases.appendChild(li);
        });
    } else {
        DOM.modal.diseases.innerHTML = '<li>No associated diseases found</li>';
    }
}

/**
 * Set up gene copy to clipboard functionality
 */
function setupGeneCopyFunctionality() {
    const copyButton = document.getElementById('copyGenesBtn');
    if (!copyButton) return;
    
    // Replace button to remove existing event listeners
    const newButton = copyButton.cloneNode(true);
    copyButton.parentNode.replaceChild(newButton, copyButton);
    
    newButton.addEventListener('click', copyGenesToClipboard);
}

/**
 * Copy genes to clipboard from modal
 */
async function copyGenesToClipboard() {
    const geneChips = DOM.modal.genes?.querySelectorAll('.gene-chip');
    
    if (!geneChips || geneChips.length === 0) {
        alert('No genes to copy.');
        return;
    }
    
    const genes = Array.from(geneChips).map(chip => chip.textContent.trim());
    const geneList = genes.join('||');
    
    try {
        await navigator.clipboard.writeText(geneList);
        showCopySuccessFeedback();
    } catch (error) {
        console.error('Failed to copy genes:', error);
        alert('Failed to copy genes to clipboard.');
    }
}

/**
 * Show copy success feedback
 */
function showCopySuccessFeedback() {
    const button = document.getElementById('copyGenesBtn');
    const originalHTML = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-check"></i>';
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
    }, 1200);
}

/**
 * Close modal dialog
 */
function closeModal() {
    DOM.modal.container.style.display = 'none';
    AppState.currentTerm = null;
}

/**
 * Add current modal term to selection
 */
function addCurrentTermFromModal() {
    if (AppState.currentTerm) {
        addTermToSelection(AppState.currentTerm);
        closeModal();
    }
}

// =============================================================================
// SELECTION MANAGEMENT
// =============================================================================

/**
 * Add term to selection if not already present
 * @param {Object} term - Term object to add to selection
 */
function addTermToSelection(term) {
    if (AppState.selectedTerms.some(selected => selected.id === term.id)) {
        return; // Term already in selection
    }
    
    AppState.selectedTerms.push(term);
    renderSelectionList();
    updateExportButtonState();
}

/**
 * Remove term from selection by ID
 * @param {string} termId - ID of term to remove
 */
function removeTermFromSelection(termId) {
    AppState.selectedTerms = AppState.selectedTerms.filter(term => term.id !== termId);
    renderSelectionList();
    updateExportButtonState();
}

/**
 * Clear all selections
 */
function clearAllSelections() {
    AppState.selectedTerms = [];
    renderSelectionList();
    updateExportButtonState();
}

/**
 * Render the selection list in the UI
 */
function renderSelectionList() {
    DOM.selection.list.innerHTML = '';
    DOM.selection.count.textContent = `${AppState.selectedTerms.length} terms`;
    
    if (AppState.selectedTerms.length === 0) {
        DOM.selection.list.innerHTML = UI_STATES.EMPTY_SELECTION.html;
        return;
    }
    
    AppState.selectedTerms.forEach(term => {
        const listItem = createSelectionListItem(term);
        DOM.selection.list.appendChild(listItem);
    });
}

/**
 * Create a list item for the selection list
 * @param {Object} term - Term object to create item for
 * @returns {HTMLLIElement} Configured list item
 */
function createSelectionListItem(term) {
    const li = document.createElement('li');
    li.className = 'selected-item';
    li.innerHTML = `
        <div>
            <strong>${escapeHTML(term.name)}</strong>
            <div>${escapeHTML(term.id)}</div>
        </div>
        <button class="remove-btn" data-id="${term.id}">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    const removeButton = li.querySelector('.remove-btn');
    removeButton.addEventListener('click', () => removeTermFromSelection(term.id));
    
    return li;
}

/**
 * Update export button state based on selection
 */
function updateExportButtonState() {
    DOM.selection.exportBtn.disabled = AppState.selectedTerms.length === 0;
}

// =============================================================================
// API INTEGRATION FUNCTIONS
// =============================================================================

/**
 * Fetch term definition from JAX API
 * @param {string} hpId - HPO term ID
 * @returns {Promise<string>} Promise resolving to definition string
 */
async function fetchTermDefinition(hpId) {
    try {
        const response = await fetch(API_CONFIG.JAX_TERM(hpId));
        
        if (response.ok) {
            const data = await response.json();
            return data.definition || 'No definition available';
        }
    } catch (error) {
        console.warn('Failed to fetch definition for', hpId, error);
    }
    
    return 'Definition not available';
}

/**
 * Fetch term synonyms from JAX API
 * @param {string} hpId - HPO term ID
 * @returns {Promise<Array>} Promise resolving to synonyms array
 */
async function fetchTermSynonyms(hpId) {
    try {
        const response = await fetch(API_CONFIG.JAX_TERM(hpId));
        
        if (response.ok) {
            const data = await response.json();
            return data.synonyms || [];
        }
    } catch (error) {
        console.warn('Failed to fetch synonyms for', hpId, error);
    }
    
    return [];
}

/**
 * Fetch comprehensive annotations from JAX API
 * @param {string} hpId - HPO term ID
 * @returns {Promise<Object>} Promise resolving to annotation data object
 */
async function fetchJAXAnnotations(hpId) {
    try {
        const [annotationsResp, termResp, parentsResp, childrenResp] = await Promise.all([
            fetch(API_CONFIG.JAX_ANNOTATIONS(hpId)),
            fetch(API_CONFIG.JAX_TERM(hpId)),
            fetch(API_CONFIG.JAX_PARENTS(hpId)),
            fetch(API_CONFIG.JAX_CHILDREN(hpId))
        ]);
        
        if (annotationsResp.ok && parentsResp.ok && childrenResp.ok) {
            const [annotations, termData, parents, children] = await Promise.all([
                annotationsResp.json(),
                termResp.json(),
                parentsResp.json(),
                childrenResp.json()
            ]);
            
            return {
                definition: termData.definition || 'No definition available',
                synonyms: Array.isArray(termData.synonyms) ? termData.synonyms.filter(Boolean) : [],
                genes: Array.isArray(annotations.genes) ? 
                    annotations.genes.map(g => g.name).filter(Boolean) : [],
                diseases: Array.isArray(annotations.diseases) ? 
                    annotations.diseases.map(d => `${d.name} (${d.id})`).filter(Boolean) : [],
                parents: Array.isArray(parents) ? 
                    parents.map(p => ({ name: p.name, id: p.id })) : [],
                children: Array.isArray(children) ? 
                    children.map(c => ({ name: c.name, id: c.id })) : []
            };
        }
    } catch (error) {
        console.warn('JAX annotation fetch failed for', hpId, error);
    }
    
    // Return empty data structure on failure
    return {
        definition: [],
        synonyms: [],
        genes: [],
        diseases: [],
        parents: [],
        children: []
    };
}

// =============================================================================
// FAVORITES MANAGEMENT
// =============================================================================

/**
 * Render frequently used terms in the favorites section
 */
function renderFrequentTerms() {
    if (!DOM.favorites.list) return;
    
    DOM.favorites.list.innerHTML = '';
    
    FREQUENT_TERMS.forEach(term => {
        const listItem = createFavoriteListItem(term);
        DOM.favorites.list.appendChild(listItem);
    });
}

/**
 * Create a list item for favorites
 * @param {Object} term - Term object for favorite item
 * @returns {HTMLLIElement} Configured favorite list item
 */
function createFavoriteListItem(term) {
    const li = document.createElement('li');
    li.className = 'favorite-item';
    li.innerHTML = `<span>${escapeHTML(term.name)} (${escapeHTML(term.id)})</span>`;
    li.addEventListener('click', () => addTermToSelection(term));
    
    return li;
}

// =============================================================================
// EXPORT FUNCTIONALITY
// =============================================================================

/**
 * Export selected terms to a text file
 */
function exportSelectedTerms() {
    if (AppState.selectedTerms.length === 0) return;
    
    const content = AppState.selectedTerms
        .map(term => `${term.name}\t${term.id}`)
        .join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    
    downloadLink.href = url;
    downloadLink.download = 'HPO_terms.txt';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }, 100);

    // Clear all selections after export
    clearAllSelections()
}

// =============================================================================
// UI STATE MANAGEMENT
// =============================================================================

/**
 * Show empty search state
 */
function showEmptySearchState() {
    updateResultsUI(UI_STATES.EMPTY_SEARCH);
}

/**
 * Show loading state during search
 */
function showLoadingState() {
    updateResultsUI(UI_STATES.LOADING);
}

/**
 * Show no results state
 */
function showNoResultsState() {
    updateResultsUI(UI_STATES.NO_RESULTS);
}

/**
 * Show error state
 */
function showErrorState() {
    updateResultsUI(UI_STATES.ERROR);
}

/**
 * Update results UI with specified state
 * @param {Object} state - UI state object with html and count properties
 */
function updateResultsUI(state) {
    DOM.search.list.innerHTML = state.html;
    DOM.search.count.textContent = state.count;
}

/**
 * Show modal no data state
 */
function showModalNoDataState() {
    if (DOM.modal.genes) DOM.modal.genes.innerHTML = '<em>No HP ID available</em>';
    if (DOM.modal.diseases) DOM.modal.diseases.innerHTML = '<li><em>No HP ID available</em></li>';
}

/**
 * Show modal error state
 */
function showModalErrorState() {
    if (DOM.modal.genes) DOM.modal.genes.innerHTML = '<em>Unable to load genes</em>';
    if (DOM.modal.diseases) DOM.modal.diseases.innerHTML = '<li><em>Unable to load diseases</em></li>';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Basic HTML escaping to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Initialize the application
 * Sets up event listeners and initial UI state
 */
function initializeApplication() {
    initializeEventListeners();
    renderFrequentTerms();
    renderSelectionList();
    showEmptySearchState();
    updateExportButtonState();
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApplication);
