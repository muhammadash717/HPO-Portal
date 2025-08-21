// DOM Elements
const searchInput = document.getElementById('searchInput');
const resultsList = document.getElementById('resultsList');
const resultsCount = document.getElementById('resultsCount');
const selectedList = document.getElementById('selectedList');
const selectedCount = document.getElementById('selectedCount');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

// State
let selectedTerms = [];
let searchTimeout = null;

// Event Listeners
searchInput.addEventListener('input', handleSearch);
exportBtn.addEventListener('click', exportToTxt);
clearBtn.addEventListener('click', clearAll);

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

// Search HPO API
async function searchHPO(query) {
    try {
        const url = `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms=${encodeURIComponent(query)}&maxList=500`;
        const response = await fetch(url);
        const data = await response.json();

        // const ids = data[1] || [];
        // const names = data[3] || [];

        const results_list = data[3] || [];

        if (results_list.length > 0) {
            const terms = results_list.map((id, i) => ({
                id: results_list[i] ? results_list[i][0] : '',
                name: results_list[i] ? results_list[i][1] : ''
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

// Display search results
function displayResults(terms) {
    resultsList.innerHTML = '';
    resultsCount.textContent = `${terms.length} terms found`;
    
    terms.forEach(term => {
        const li = document.createElement('li');
        li.className = 'result-item';
        li.innerHTML = `
            <span>${term.name}</span>
            <span class="hpo-id">${term.id}</span>
        `;
        
        li.addEventListener('click', () => addToSelected(term));
        resultsList.appendChild(li);
    });
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
    
    // Clear search and results
    // searchInput.value = '';
    // showEmptyState();
    
    // Enable export button
    exportBtn.disabled = false;
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
        content += `${term.name} ${term.id}\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    // a.download = `hpo_terms_${new Date().toISOString().slice(0, 10)}.txt`;
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
