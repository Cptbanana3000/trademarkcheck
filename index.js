const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- API Configuration ---
// IMPORTANT: The original 'markerapi.com' URL still appears to be defunct based on initial tests.
// While this code is now correctly structured according to the documentation, it will only work
// if the API service at 'markerapi.com' is active.
const API_USERNAME = 'dondakirme';
const API_PASSWORD = 'yzBTM83FKn'; // Your API password

// The base URL from the documentation.
const BASE_URL = 'https://markerapi.com/api/v2/trademarks';

// --- Helper function to make API requests ---
async function makeApiRequest(url) {
    try {
        console.log(`Making request to: ${url}`);
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
            },
            validateStatus: (status) => status < 500, // Handle 4xx errors gracefully
        });

        console.log(`Response Status: ${response.status}`);

        if (response.status !== 200) {
            const errorMsg = response.data?.message || `API returned status ${response.status}`;
            throw new Error(errorMsg);
        }
        
        if (typeof response.data !== 'object' || response.data === null) {
            throw new Error('API did not return valid JSON.');
        }

        return response.data;

    } catch (error) {
        console.error(`API Request Error: ${error.message}`);
        // Re-throw a user-friendly error for the frontend
        throw new Error(`Failed to fetch data from the trademark API. The service might be down or the request is invalid. Check server logs for details.`);
    }
}

// --- HTML Frontend Route ---
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trademark API Tester</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; color: #343a40; }
            h1 { text-align: center; color: #0056b3; }
            .search-section { background: #fff; padding: 25px; margin: 20px 0; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
            h3 { margin-top: 0; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            input, select, button { font-size: 16px; margin: 5px; padding: 12px; border-radius: 5px; border: 1px solid #ced4da; }
            button { background-color: #007bff; color: white; border: none; cursor: pointer; transition: background-color 0.2s; font-weight: bold; }
            button:hover { background-color: #0056b3; }
            button.next-page-btn { background-color: #28a745; margin-top: 10px; }
            button.next-page-btn:hover { background-color: #218838; }
            .results { background: #fdfdff; border: 1px solid #e9ecef; padding: 15px; margin-top: 15px; max-height: 450px; overflow-y: auto; border-radius: 5px; }
            .trademark-item { border-bottom: 1px solid #eee; padding: 15px 5px; }
            .trademark-item:last-child { border-bottom: none; }
            .error { color: #d8000c; background-color: #ffbaba; padding: 10px; border-radius: 5px; }
            .loading { text-align: center; padding: 20px; color: #555; font-style: italic; }
        </style>
    </head>
    <body>
        <h1>Full Trademark API Tester</h1>
        
        <!-- Trademark Search -->
        <div class="search-section">
            <h3>Trademark Search</h3>
            <input type="text" id="trademarkSearch" placeholder="Search term (* for wildcard)" />
            <select id="trademarkStatus">
                <option value="active">Active Only</option>
                <option value="all">All Statuses</option>
            </select>
            <button onclick="searchByTrademark()">Search</button>
            <div id="trademarkResults" class="results" style="display:none;"></div>
        </div>

        <!-- Description Search -->
        <div class="search-section">
            <h3>Description Search</h3>
            <input type="text" id="descriptionSearch" placeholder="Search in descriptions" />
            <select id="descriptionStatus">
                <option value="active">Active Only</option>
                <option value="all">All Statuses</option>
            </select>
            <button onclick="searchByDescription()">Search</button>
            <div id="descriptionResults" class="results" style="display:none;"></div>
        </div>

        <!-- Owner Search -->
        <div class="search-section">
            <h3>Owner Search</h3>
            <input type="text" id="ownerSearch" placeholder="Search by owner name" />
            <button onclick="searchByOwner()">Search</button>
            <div id="ownerResults" class="results" style="display:none;"></div>
        </div>

        <!-- Expiration Search -->
        <div class="search-section">
            <h3>Expiration Search</h3>
            <input type="text" id="expirationPeriod" value="6 months" placeholder="e.g., 90 days, 1 year" />
            <button onclick="searchByExpiration()">Search</button>
            <div id="expirationResults" class="results" style="display:none;"></div>
        </div>
        
        <!-- Serial Number Search -->
        <div class="search-section">
            <h3>Serial Number Search</h3>
            <input type="text" id="serialNumber" placeholder="Enter serial number" />
            <button onclick="searchBySerial()">Search</button>
            <div id="serialResults" class="results" style="display:none;"></div>
        </div>

        <script>
            function showLoading(elementId) {
                const element = document.getElementById(elementId);
                element.style.display = 'block';
                element.innerHTML = '<div class="loading">Searching...</div>';
            }

            function showError(elementId, message) {
                const element = document.getElementById(elementId);
                element.style.display = 'block';
                element.innerHTML = \`<div class="error"><strong>Error:</strong> \${message}</div>\`;
            }

            function displayResults(elementId, data, isAppending = false) {
                const element = document.getElementById(elementId);
                element.style.display = 'block';
                
                const trademarks = data.trademarks || (data.serialnumber ? [data] : []);

                if (!isAppending) {
                    element.innerHTML = ''; // Clear previous results unless appending
                }

                // Remove old "Next Page" button before adding new content
                const oldBtn = element.querySelector('.next-page-btn');
                if (oldBtn) oldBtn.remove();

                if (trademarks.length === 0 && !isAppending) {
                    element.innerHTML = '<div>No results found.</div>';
                    return;
                }

                let html = trademarks.map(tm => \`
                    <div class="trademark-item">
                        <strong>\${tm.wordmark || tm.trademark || 'N/A'}</strong><br>
                        <strong>Serial:</strong> \${tm.serialnumber || 'N/A'} | <strong>Status:</strong> \${tm.status || 'N/A'}<br>
                        <strong>Owner:</strong> \${tm.owner || 'N/A'}<br>
                        <strong>Description:</strong> \${tm.description || 'N/A'}<br>
                        <strong>Filing Date:</strong> \${tm.filingdate || 'N/A'} | <strong>Registration Date:</strong> \${tm.registrationdate || tm.regdate || 'N/A'}
                    </div>
                \`).join('');
                
                element.innerHTML += html;

                // Handle pagination
                if (data.next) {
                    const nextBtn = document.createElement('button');
                    nextBtn.textContent = 'Next Page';
                    nextBtn.className = 'next-page-btn';
                    // The onclick will be set by the calling function
                    element.appendChild(nextBtn);
                }
            }

            async function performSearch(endpoint, resultsId, isAppending = false, onNextClick) {
                if (!isAppending) {
                    showLoading(resultsId);
                }
                try {
                    const response = await fetch(endpoint);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed on the server.');
                    }
                    
                    displayResults(resultsId, data, isAppending);
                    
                    // Setup the next page button's click handler
                    const nextBtn = document.getElementById(resultsId).querySelector('.next-page-btn');
                    if (nextBtn && data.next) {
                        nextBtn.onclick = () => onNextClick(data.next);
                    }

                } catch (error) {
                    showError(resultsId, error.message);
                }
            }

            // --- Search Functions ---
            function searchByTrademark(start = 1) {
                const search = document.getElementById('trademarkSearch').value;
                const status = document.getElementById('trademarkStatus').value;
                if (!search) { alert('Please enter a search term'); return; }
                const endpoint = \`/api/trademark?search=\${encodeURIComponent(search)}&status=\${status}&start=\${start}\`;
                performSearch(endpoint, 'trademarkResults', start > 1, (nextStart) => searchByTrademark(nextStart));
            }

            function searchByDescription(start = 1) {
                const search = document.getElementById('descriptionSearch').value;
                const status = document.getElementById('descriptionStatus').value;
                if (!search) { alert('Please enter a description term'); return; }
                const endpoint = \`/api/description?search=\${encodeURIComponent(search)}&status=\${status}&start=\${start}\`;
                performSearch(endpoint, 'descriptionResults', start > 1, (nextStart) => searchByDescription(nextStart));
            }
            
            function searchByOwner(start = 1) {
                const search = document.getElementById('ownerSearch').value;
                if (!search) { alert('Please enter an owner name'); return; }
                const endpoint = \`/api/owner?search=\${encodeURIComponent(search)}&start=\${start}\`;
                performSearch(endpoint, 'ownerResults', start > 1, (nextStart) => searchByOwner(nextStart));
            }

            function searchByExpiration(start = 1) {
                const period = document.getElementById('expirationPeriod').value;
                if (!period) { alert('Please enter an expiration period'); return; }
                const endpoint = \`/api/expiring?period=\${encodeURIComponent(period)}&start=\${start}\`;
                performSearch(endpoint, 'expirationResults', start > 1, (nextStart) => searchByExpiration(nextStart));
            }

            function searchBySerial() {
                const serialNumber = document.getElementById('serialNumber').value;
                if (!serialNumber) { alert('Please enter a serial number'); return; }
                performSearch('/api/serial/' + encodeURIComponent(serialNumber), 'serialResults', false, null);
            }
        </script>
    </body>
    </html>
    `);
});


// --- API Routes ---

// Trademark Search (from docs)
app.get('/api/trademark', async (req, res) => {
    const { search, status = 'active', start = 1 } = req.query;
    if (!search) return res.status(400).json({ error: 'Search parameter is required' });
    
    try {
        const url = `${BASE_URL}/trademark/${encodeURIComponent(search)}/status/${status}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Description Search (from docs)
app.get('/api/description', async (req, res) => {
    const { search, status = 'active', start = 1 } = req.query;
    if (!search) return res.status(400).json({ error: 'Search parameter is required' });

    try {
        const url = `${BASE_URL}/description/${encodeURIComponent(search)}/status/${status}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Owner Search (from docs)
app.get('/api/owner', async (req, res) => {
    const { search, start = 1 } = req.query;
    if (!search) return res.status(400).json({ error: 'Search parameter is required' });

    try {
        const url = `${BASE_URL}/owner/${encodeURIComponent(search)}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Expiration Search (from docs)
app.get('/api/expiring', async (req, res) => {
    const { period = '6 months', start = 1 } = req.query;
    if (!period) return res.status(400).json({ error: 'Period parameter is required' });
    
    try {
        const url = `${BASE_URL}/expiring/${encodeURIComponent(period)}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serial Number Search (from docs)
app.get('/api/serial/:serialNumber', async (req, res) => {
    const { serialNumber } = req.params;
    try {
        const url = `${BASE_URL}/serialnumber/${encodeURIComponent(serialNumber)}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- Server Start ---
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Trademark API tester running at http://localhost:${port}`);
    });
}

// Export the app for serverless environments like Vercel
module.exports = app;
