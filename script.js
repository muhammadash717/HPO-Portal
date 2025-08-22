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

// Search Handler
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
                definition: termData[2] || 'No definition available',
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

// Fetch JAX annotations (genes + diseases) for a given HP ID
async function fetchJaxAnnotation(hpId) {
  const url = `https://ontology.jax.org/api/network/annotation/${encodeURIComponent(hpId)}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      // 404 or other non-ok -> return empty lists
      return { genes: [], diseases: [] };
    }
    const data = await resp.json();
    const genes = Array.isArray(data.genes) ? data.genes.map(g => g.name).filter(Boolean) : [];
    const diseases = Array.isArray(data.diseases)
      ? data.diseases.map(d => `${d.name} (${d.id})`).filter(Boolean)
      : [];
    return { genes, diseases };
  } catch (err) {
    console.warn('JAX annotation fetch failed for', hpId, err);
    return { genes: [], diseases: [] };
  }
}

// Display search results
function displayResults(terms) {
    resultsList.innerHTML = '';
    resultsCount.textContent = `${terms.length} terms found`;
    
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
function showTermDetails(term) {
    currentTerm = term;
    modalTermName.textContent = term.name || 'No name available';
    modalTermId.textContent = term.id || 'No ID available';
    modalTermDefinition.textContent = term.definition || 'No definition available';
    
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
            modalTermSynonyms.innerHTML = '<li>No synonyms available</li>';
        }
    } else {
        modalTermSynonyms.innerHTML = '<li>No synonyms available</li>';
    }
    
    // prepare genes/diseases placeholders (show loading text)
    if (modalGenes) modalGenes.innerHTML = '<em>Loading associated genes...</em>';
    if (modalDiseases) modalDiseases.innerHTML = '<li><em>Loading associated diseases...</em></li>';

    // show modal (same as before)
    modal.style.display = 'block';

    // fetch JAX annotations only for this term (do not change other behavior)
    if (term.id) {
        fetchJaxAnnotation(term.id).then(({ genes, diseases }) => {
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
        
        const removeBtn = li.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeTerm(term.id));
        
        selectedList.appendChild(li);
    });
}

// Remove term from selected
function removeTerm(id) {
    selectedTerms = selectedTerms.filter(term => term.id !== id);
    renderSelectedList();
    
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
    
    let content = '';
    selectedTerms.forEach(term => {
        content += `${term.name} (${term.id})\n`;
    });
    
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
