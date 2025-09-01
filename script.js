// =============================================
// HPO Portal - Human Phenotype Ontology Search Tool
// JavaScript Implementation
// 
// This script provides functionality for:
// - Searching HPO terms via API
// - Managing selected terms
// - Displaying term details in a modal
// - Exporting selected terms to a text file
// 
// Author : Muhammad Ashraf
// Date   : August 2025
// =============================================
 
// DOM Elements
const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('resultsList');
const resultsCount = document.getElementById('resultsCount');
const selectedList = document.getElementById('selectedList');
const selectedCount = document.getElementById('selectedCount');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const modal = document.getElementById('termModal');
const closeModal = document.querySelector('.close');
const modalTermName = document.getElementById('modalTermName');
const modalTermId = document.getElementById('modalTermId');
const modalTermDefinition = document.getElementById('modalTermDefinition');
const modalTermSynonyms = document.getElementById('modalTermSynonyms');
const addFromModalBtn = document.getElementById('addFromModal');
const modalGenes = document.getElementById('modalGenes');
const modalDiseases = document.getElementById('modalDiseases');
const modalParents = document.getElementById('modalParents');
const modalChildren = document.getElementById('modalChildren');

// State
let selectedTerms = [];
let searchTimeout = null;
let currentTerm = null;

// Event Listeners
searchInput.addEventListener('input', handleSearch);
exportBtn.addEventListener('click', exportToTxt);
clearBtn.addEventListener('click', clearAll);
closeModal.addEventListener('click', () => modal.style.display = 'none');
addFromModalBtn.addEventListener('click', addCurrentTermFromModal);

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// Search Handler - Processes user input with debouncing
function handleSearch() {
    const query = searchInput.value.trim();
    
    // Clear results if query is empty
    if (!query) {
        showEmptyState();
        return;
    }
    
    // Show loading state
    resultsList.innerHTML = `
        <li class="loading">
            <i class="fas fa-spinner"></i>
            <p>Searching HPO database...</p>
        </li>
    `;
    
    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchHPO(query), 500);
}

// Search HPO API with additional fields
async function searchHPO(query) {
    try {
        const url = `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms=${encodeURIComponent(query)}&maxList=500&df=id,name,definition,synonym.term`;
        const response = await fetch(url);
        const data = await response.json();

        const results_list = data[3] || [];

        if (results_list.length > 0) {
            const terms = results_list.map(termData => ({
                id: termData[0] || '',
                name: termData[1] || '',
                definition: termData[2] || '',
                synonyms: termData[3] || ''
            }));
            displayResults(terms);
        } else {
            showNoResults();
        }
    } catch (error) {
        console.error('Error fetching HPO data:', error);
        showError();
    }
}

// Fetch JAX annotations (definition + synonyms) for a given HP ID
async function fetchDefinition(hpId) {
  const url_def = `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}`;
  try {
    const resp_def = await fetch(url_def);
    if (resp_def.ok) {
        const data_def = await resp_def.json();
        const definition = data_def.definition;
        return definition
    }
  } catch (err) {
    console.warn('JAX annotation fetch failed for', hpId, err);
    return NaN
  };
}

// Fetch synonyms for a specific HPO term from JAX API
async function fetchSynonyms(hpId) {
  const url_def = `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}`;
  try {
    const resp_def = await fetch(url_def);
    if (resp_def.ok) {
        const data_def = await resp_def.json();
        const synonyms = data_def.synonyms;
        return synonyms
    }
  } catch (err) {
    console.warn('JAX annotation fetch failed for', hpId, err);
    return NaN
  };
}

// Fetch comprehensive annotations for a specific HPO term
async function fetchJaxAnnotations(hpId) {
  const url = `https://ontology.jax.org/api/network/annotation/${encodeURIComponent(hpId)}`;
  const url_def = `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}`;
  const url_parents = `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}/parents`;
  const url_children = `https://ontology.jax.org/api/hp/terms/${encodeURIComponent(hpId)}/children`;

  try {
    // Fetch all related data in parallel
    const resp = await fetch(url);
    const resp_def = await fetch(url_def);
    const resp_parents = await fetch(url_parents);
    const resp_children = await fetch(url_children);
    
    if (resp.ok && resp_parents.ok && resp_children.ok) { //&& resp_def.ok 
        const data = await resp.json();
        const data_def = await resp_def.json();
        const data_parents = await resp_parents.json();
        const data_children = await resp_children.json();

        // Extract and format data from responses
        const definition = data_def.definition || 'no def!';
        const synonyms = Array.isArray(data_def.synonyms) ? data_def.synonyms.map(g => g).filter(Boolean) : [];
        const genes = Array.isArray(data.genes) ? data.genes.map(g => g.name).filter(Boolean) : [];
        const diseases = Array.isArray(data.diseases) ? data.diseases.map(d => `${d.name} (${d.id})`).filter(Boolean) : [];
        const parents = Array.isArray(data_parents) ? data_parents.map(d => ({ name: d.name, id: d.id })) : [];
        const children = Array.isArray(data_children) ? data_children.map(d => ({ name: d.name, id: d.id })) : [];

        return { definition, synonyms, genes, diseases, parents, children }
    }
  } catch (err) {
    console.warn('JAX annotation fetch failed for', hpId, err);
    return { definition: [], synonyms: [], genes: [], diseases: [], parents: [], children: [] }
  };
}

// Display search results
function displayResults(terms) {
    resultsList.innerHTML = '';
    resultsCount.textContent = `${terms.length} terms found`;
    
    // Create and append result items for each term
    terms.forEach(term => {
        const li = document.createElement('li');
        li.className = 'result-item';
        li.innerHTML = `
            <div class="result-content">
                <span class="term-name">${term.name} - </span>
                <span class="hpo-id">${term.id}</span>
            </div>
            <div class="term-actions">
                <i class="fas fa-info-circle info-icon" title="View details"></i>
            </div>
        `;
        
        // Single click to add to selection
        li.addEventListener('click', (e) => {
            // Only add if not clicking on the info icon
            if (!e.target.classList.contains('info-icon') && 
                !e.target.parentElement.classList.contains('term-actions')) {
                addToSelected(term);
            }
        });
        
        // Info icon click to show details
        const infoIcon = li.querySelector('.info-icon');
        infoIcon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the parent click event
            showTermDetails(term);
        });
        
        resultsList.appendChild(li);
    });
}

// Show term details in modal
async function showTermDetails(term) {
    currentTerm = term;
    modalTermName.textContent = term.name || 'No name available.';
    modalTermId.textContent = term.id || 'No ID available.';

    // Fetch definition and synonyms if not already available
    if (term.definition) {
        modalTermDefinition.textContent = term.definition || 'fail 1';
    } else {
        const definition = await fetchDefinition(term.id);
        modalTermDefinition.textContent = definition;
        const synonyms2 = await fetchSynonyms(term.id);
        term.synonyms = synonyms2;
    }
    
    // Clear and populate synonyms
    modalTermSynonyms.innerHTML = '';
    
    if (term.synonyms) {
        // Synonyms may be a single string separated by semicolons OR an array
        let synonymsArray = [];
        if (typeof term.synonyms === 'string') {
            synonymsArray = term.synonyms.split('; ').map(s => s.trim()).filter(s => s);
        } else if (Array.isArray(term.synonyms)) {
            synonymsArray = term.synonyms.map(String).map(s => s.trim()).filter(s => s);
        }
        
        if (synonymsArray.length > 0) {
            synonymsArray.forEach(synonym => {
                const li = document.createElement('li');
                li.textContent = synonym;
                modalTermSynonyms.appendChild(li);
            });
        } else {
            modalTermSynonyms.innerHTML = '<li>No synonyms available.</li>';
        }
    } else {
        modalTermSynonyms.innerHTML = '<li>No synonyms available.</li>';
    }
    
    // Prepare placeholders for related data
    if (modalParents) modalParents.innerHTML = '<em>Loading parent terms...</em>';
    if (modalChildren) modalChildren.innerHTML = '<em>Loading child terms...</em>';
    if (modalGenes) modalGenes.innerHTML = '<em>Loading associated genes...</em>';
    if (modalDiseases) modalDiseases.innerHTML = '<li><em>Loading associated diseases...</em></li>';

    // Show modal
    modal.style.display = 'block';

    // fetch JAX annotations only for this term (do not change other behavior)
    if (term.id) {
        fetchJaxAnnotations(term.id).then(({ genes, diseases, parents, children }) => {
            // populate parents
            if (modalParents) {
                modalParents.innerHTML = '';
                if (parents.length > 0) {
                    parents.forEach(d => {
                        const li = document.createElement('li');

                        // main sentence
                        const textSpan = document.createElement('span');
                        textSpan.textContent = `${d.name} (${d.id})`;

                        // "info" action
                        const infoSpan = document.createElement('span');
                        infoSpan.style.cursor = 'pointer';
                        infoSpan.style.marginLeft = '10px';
                        infoSpan.innerHTML = '<i class="fa fa-info-circle" aria-hidden="true"></i>';
                        infoSpan.addEventListener('click', () => showTermDetails(d));

                        // "add" action
                        const addSpan = document.createElement('span');
                        addSpan.style.cursor = 'pointer';
                        addSpan.style.marginLeft = '10px';
                        addSpan.innerHTML = '<i class="fa fa-plus-circle" aria-hidden="true"></i>';
                        addSpan.addEventListener('click', () => addToSelected(d));

                        // build li
                        li.appendChild(textSpan);
                        li.appendChild(infoSpan);
                        li.appendChild(addSpan);

                        modalParents.appendChild(li);
                    });
                } else {
                    modalParents.innerHTML = '<li>No associated parent terms found</li>';
                }
            }

            // populate children
            if (modalChildren) {
                modalChildren.innerHTML = '';
                if (children.length > 0) {
                    children.forEach(d => {
                        const li = document.createElement('li');

                        // main sentence
                        const textSpan = document.createElement('span');
                        textSpan.textContent = `${d.name} (${d.id})`;

                        // "info" action
                        const infoSpan = document.createElement('span');
                        infoSpan.style.cursor = 'pointer';
                        infoSpan.style.marginLeft = '10px';
                        infoSpan.innerHTML = '<i class="fa fa-info-circle" aria-hidden="true"></i>';
                        infoSpan.addEventListener('click', () => showTermDetails(d));

                        // "add" action
                        const addSpan = document.createElement('span');
                        addSpan.style.cursor = 'pointer';
                        addSpan.style.marginLeft = '10px';
                        addSpan.innerHTML = '<i class="fa fa-plus-circle" aria-hidden="true"></i>';
                        addSpan.addEventListener('click', () => addToSelected(d));

                        // build li
                        li.appendChild(textSpan);
                        li.appendChild(infoSpan);
                        li.appendChild(addSpan);

                        modalChildren.appendChild(li);
                    });
                } else {
                    modalChildren.innerHTML = '<li>No associated child terms found</li>';
                }
            }

            // populate genes
            if (modalGenes) {
                modalGenes.innerHTML = '';
                if (genes.length > 0) {
                    genes.forEach(gname => {
                        const span = document.createElement('span');
                        span.className = 'gene-chip';
                        span.textContent = gname;
                        modalGenes.appendChild(span);
                    });
                } else {
                    modalGenes.innerHTML = '<em>No associated genes found.</em>';
                }
            }

            // populate diseases
            if (modalDiseases) {
                modalDiseases.innerHTML = '';
                if (diseases.length > 0) {
                    diseases.forEach(d => {
                        const li = document.createElement('li');
                        li.textContent = d;
                        modalDiseases.appendChild(li);
                    });
                } else {
                    modalDiseases.innerHTML = '<li>No associated diseases found</li>';
                }
            }
        }).catch(err => {
            if (modalGenes) modalGenes.innerHTML = '<em>Unable to load genes.</em>';
            if (modalDiseases) modalDiseases.innerHTML = '<li><em>Unable to load diseases.</em></li>';
            console.warn('Error fetching JAX annotations:', err);
        });
    } else {
        if (modalGenes) modalGenes.innerHTML = '<em>No HP ID available.</em>';
        if (modalDiseases) modalDiseases.innerHTML = '<li><em>No HP ID available.</em></li>';
    }
}

// Add term from modal
function addCurrentTermFromModal() {
    if (currentTerm) {
        addToSelected(currentTerm);
        modal.style.display = 'none';
    }
}

// Add term to selected
function addToSelected(term) {
    // Check if term is already selected
    if (selectedTerms.some(t => t.id === term.id)) {
        return;
    }
    
    // Add to selected
    selectedTerms.push(term);
    renderSelectedList();
    
    // Enable export button
    exportBtn.disabled = false;
}

// Frequently Used Terms
const favoriteTerms = [
  { id: "HP:0001263", name: "Global developmental delay" },
  { id: "HP:0000252", name: "Microcephaly" },
  { id: "HP:0001250", name: "Seizure" },
  { id: "HP:0000107", name: "Renal cyst" },
  { id: "HP:0000083", name: "Renal insufficiency" },
  { id: "HP:0000789", name: "Infertility" },
  { id: "HP:0000027", name: "Azoospermia" },
  { id: "HP:0034241", name: "Prenatal death" }
];

// Render favorites in the panel
function renderFavorites() {
    const favoritesList = document.getElementById("favorites-list");
    favoritesList.innerHTML = "";
    favoriteTerms.forEach(term => {
        const li = document.createElement("li");
        li.className = "favorite-item";
        li.innerHTML = `<span>${term.name} (${term.id})</span>`;
        li.addEventListener('click', () => addToSelected(term));
        favoritesList.appendChild(li);
    });
}

// Render selected terms list
function renderSelectedList() {
    selectedList.innerHTML = '';
    selectedCount.textContent = `${selectedTerms.length} terms`;
    
    // Show empty state if no terms selected
    if (selectedTerms.length === 0) {
        selectedList.innerHTML = `
            <li class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>No terms selected yet</p>
                <p>Select terms from the search results</p>
            </li>
        `;
        return;
    }
    
    // Create list items for each selected term
    selectedTerms.forEach(term => {
        const li = document.createElement('li');
        li.className = 'selected-item';
        li.innerHTML = `
            <div>
                <strong>${term.name}</strong>
                <div>${term.id}</div>
            </div>
            <button class="remove-btn" data-id="${term.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Add event listener for remove button
        const removeBtn = li.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeTerm(term.id));
        
        selectedList.appendChild(li);
    });
}

// Remove term from selected
function removeTerm(id) {
    selectedTerms = selectedTerms.filter(term => term.id !== id);
    renderSelectedList();
    
    // Disable export button if no terms selected
    if (selectedTerms.length === 0) {
        exportBtn.disabled = true;
    }
}

// Clear all selected terms
function clearAll() {
    selectedTerms = [];
    renderSelectedList();
    exportBtn.disabled = true;
}

// Export to TXT file
function exportToTxt() {
    if (selectedTerms.length === 0) return;
    
    // Create content for text file
    let content = '';
    selectedTerms.forEach((term, index) => {
        content += `${term.name}\t${term.id}\n`;
    });
    
    // Create and trigger download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `HPO.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// UI States
function showEmptyState() {
    resultsList.innerHTML = `
        <li class="empty-state">
            <i class="fas fa-search"></i>
            <p>Start typing to search HPO terms</p>
        </li>
    `;
    resultsCount.textContent = '0 terms found';
}

function showNoResults() {
    resultsList.innerHTML = `
        <li class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <p>No matching terms found</p>
            <p>Try a different search term</p>
        </li>
    `;
    resultsCount.textContent = '0 terms found';
}

function showError() {
    resultsList.innerHTML = `
        <li class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error fetching data</p>
            <p>Please try again later</p>
        </li>
    `;
    resultsCount.textContent = '0 terms found';
}

// Initialize
showEmptyState();
renderFavorites();
