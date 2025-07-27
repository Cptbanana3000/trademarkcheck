const express = require('express');
const axios = require('axios');
const https = require('https');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Your API credentials - replace these with your actual credentials
const API_USERNAME = 'dondakirme';
const API_PASSWORD = 'yzBTM83FKn'; // From your account info

// Try both API URLs - sometimes the dev URL works better
const BASE_URL = 'https://markerapi.com/api/v2/trademarks';
const DEV_BASE_URL = 'https://dev.markerapi.com/api/v2/trademarks';
const AWS_BASE_URL = 'https://api.worldtradingdata.com/api/v2/trademarks'; // Redirect target

// Helper function to make API requests with fallback
async function makeApiRequest(endpoint, useDev = false) {
    const urls = [
        endpoint, 
        endpoint.replace(BASE_URL, DEV_BASE_URL),
        endpoint.replace(BASE_URL, AWS_BASE_URL)
    ];
    
    for (let i = 0; i < urls.length; i++) {
        try {
            console.log(`Attempt ${i + 1} - Making request to:`, urls[i]);
            
            // Configure axios options based on URL
            const axiosConfig = {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.getcenterpage.com/',
                    'Origin': 'https://www.getcenterpage.com'
                },
                maxRedirects: 5, // Follow redirects
                validateStatus: function (status) {
                    return status < 500;
                }
            };
            
            // For dev server, ignore SSL certificate errors
            if (urls[i].includes('dev.markerapi.com')) {
                axiosConfig.httpsAgent = new https.Agent({
                    rejectUnauthorized: false
                });
            }
            
            const response = await axios.get(urls[i], axiosConfig);
            
            console.log('Response status:', response.status);
            console.log('Final URL after redirects:', response.request.res?.responseUrl || urls[i]);
            console.log('Response type:', typeof response.data);
            
            if (response.status === 200) {
                console.log('Success with URL:', urls[i]);
                
                // Handle different response types
                if (typeof response.data === 'string' && response.data.includes('<html>')) {
                    console.log('Received HTML instead of JSON, trying next endpoint...');
                    continue;
                }
                
                return response.data;
            } else {
                console.log('Non-200 status:', response.status, 'trying next URL...');
                continue;
            }
        } catch (error) {
            console.error(`API Request Error (attempt ${i + 1}):`, error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response headers:', error.response.headers);
            }
            
            // If this is the last URL, throw the error
            if (i === urls.length - 1) {
                throw new Error(`All API endpoints failed. Last error: ${error.message}`);
            }
            
            console.log('Trying next URL...');
        }
    }
}

// Routes

// Home page with testing interface
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Trademark API Tester</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            .search-section { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px; }
            input, select, button { margin: 5px; padding: 8px; }
            button { background: #007cba; color: white; border: none; border-radius: 3px; cursor: pointer; }
            button:hover { background: #005a87; }
            .results { background: white; border: 1px solid #ddd; padding: 15px; margin-top: 10px; max-height: 400px; overflow-y: auto; }
            .trademark-item { border-bottom: 1px solid #eee; padding: 10px 0; }
            .error { color: red; background: #ffe6e6; padding: 10px; border-radius: 3px; }
            .loading { color: #666; font-style: italic; }
        </style>
    </head>
    <body>
        <h1>Trademark API Tester</h1>
        
        <div class="search-section">
            <h3>Serial Number Search</h3>
            <input type="text" id="serialNumber" placeholder="Enter serial number" />
            <button onclick="searchBySerial()">Search</button>
            <div id="serialResults" class="results" style="display:none;"></div>
        </div>

        <div class="search-section">
            <h3>Trademark Search</h3>
            <input type="text" id="trademarkSearch" placeholder="Search trademark (use * for wildcards)" />
            <select id="trademarkStatus">
                <option value="active">Active Only</option>
                <option value="all">All Statuses</option>
            </select>
            <button onclick="searchByTrademark()">Search</button>
            <div id="trademarkResults" class="results" style="display:none;"></div>
        </div>

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

        <div class="search-section">
            <h3>Owner Search</h3>
            <input type="text" id="ownerSearch" placeholder="Search by owner name" />
            <button onclick="searchByOwner()">Search</button>
            <div id="ownerResults" class="results" style="display:none;"></div>
        </div>

        <div class="search-section">
            <h3>Expiration Search</h3>
            <select id="expirationPeriod">
                <option value="6 months">6 months</option>
                <option value="1 year">1 year</option>
                <option value="90 days">90 days</option>
                <option value="2 years">2 years</option>
            </select>
            <button onclick="searchByExpiration()">Search</button>
            <div id="expirationResults" class="results" style="display:none;"></div>
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
                element.innerHTML = '<div class="error">Error: ' + message + '</div>';
            }

            function displayResults(elementId, data) {
                const element = document.getElementById(elementId);
                element.style.display = 'block';
                
                if (!data || (data.trademarks && data.trademarks.length === 0)) {
                    element.innerHTML = '<div>No results found.</div>';
                    return;
                }

                let html = '';
                
                if (data.count !== undefined) {
                    html += '<div><strong>Total Results: ' + data.count + '</strong></div><hr>';
                }

                const trademarks = data.trademarks || [data];
                
                trademarks.forEach(tm => {
                    html += '<div class="trademark-item">';
                    html += '<strong>' + (tm.wordmark || tm.trademark || 'N/A') + '</strong><br>';
                    html += 'Serial: ' + (tm.serialnumber || 'N/A') + '<br>';
                    html += 'Status: ' + (tm.status || 'N/A') + '<br>';
                    html += 'Description: ' + (tm.description || 'N/A') + '<br>';
                    html += 'Owner: ' + (tm.owner || 'N/A') + '<br>';
                    html += 'Filing Date: ' + (tm.filingdate || 'N/A') + '<br>';
                    html += 'Registration Date: ' + (tm.registrationdate || tm.regdate || 'N/A') + '<br>';
                    html += '</div>';
                });

                element.innerHTML = html;
            }

            async function searchBySerial() {
                const serialNumber = document.getElementById('serialNumber').value;
                if (!serialNumber) {
                    alert('Please enter a serial number');
                    return;
                }

                showLoading('serialResults');
                
                try {
                    const response = await fetch('/api/serial/' + encodeURIComponent(serialNumber));
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }
                    
                    displayResults('serialResults', data);
                } catch (error) {
                    showError('serialResults', error.message);
                }
            }

            async function searchByTrademark() {
                const search = document.getElementById('trademarkSearch').value;
                const status = document.getElementById('trademarkStatus').value;
                
                if (!search) {
                    alert('Please enter a search term');
                    return;
                }

                showLoading('trademarkResults');
                
                try {
                    const response = await fetch('/api/trademark?search=' + encodeURIComponent(search) + '&status=' + status);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }
                    
                    displayResults('trademarkResults', data);
                } catch (error) {
                    showError('trademarkResults', error.message);
                }
            }

            async function searchByDescription() {
                const search = document.getElementById('descriptionSearch').value;
                const status = document.getElementById('descriptionStatus').value;
                
                if (!search) {
                    alert('Please enter a search term');
                    return;
                }

                showLoading('descriptionResults');
                
                try {
                    const response = await fetch('/api/description?search=' + encodeURIComponent(search) + '&status=' + status);
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }
                    
                    displayResults('descriptionResults', data);
                } catch (error) {
                    showError('descriptionResults', error.message);
                }
            }

            async function searchByOwner() {
                const search = document.getElementById('ownerSearch').value;
                
                if (!search) {
                    alert('Please enter an owner name');
                    return;
                }

                showLoading('ownerResults');
                
                try {
                    const response = await fetch('/api/owner?search=' + encodeURIComponent(search));
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }
                    
                    displayResults('ownerResults', data);
                } catch (error) {
                    showError('ownerResults', error.message);
                }
            }

            async function searchByExpiration() {
                const period = document.getElementById('expirationPeriod').value;

                showLoading('expirationResults');
                
                try {
                    const response = await fetch('/api/expiring?period=' + encodeURIComponent(period));
                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.error || 'Request failed');
                    }
                    
                    displayResults('expirationResults', data);
                } catch (error) {
                    showError('expirationResults', error.message);
                }
            }
        </script>
    </body>
    </html>
    `);
});

// API Routes

// Serial Number Search
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

// Trademark Search
app.get('/api/trademark', async (req, res) => {
    const { search, status = 'active', start = 1 } = req.query;
    
    if (!search) {
        return res.status(400).json({ error: 'Search parameter is required' });
    }
    
    try {
        const url = `${BASE_URL}/trademark/${encodeURIComponent(search)}/status/${status}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Description Search
app.get('/api/description', async (req, res) => {
    const { search, status = 'active', start = 1 } = req.query;
    
    if (!search) {
        return res.status(400).json({ error: 'Search parameter is required' });
    }
    
    try {
        const url = `${BASE_URL}/description/${encodeURIComponent(search)}/status/${status}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Owner Search
app.get('/api/owner', async (req, res) => {
    const { search, start = 1 } = req.query;
    
    if (!search) {
        return res.status(400).json({ error: 'Search parameter is required' });
    }
    
    try {
        const url = `${BASE_URL}/owner/${encodeURIComponent(search)}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Expiration Search
app.get('/api/expiring', async (req, res) => {
    const { period = '6 months', start = 1 } = req.query;
    
    try {
        const url = `${BASE_URL}/expiring/${encodeURIComponent(period)}/start/${start}/username/${API_USERNAME}/password/${API_PASSWORD}`;
        const data = await makeApiRequest(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a route to test different header combinations
app.get('/api/test-headers', async (req, res) => {
    const testConfigurations = [
        {
            name: 'No special headers',
            headers: {
                'User-Agent': 'TrademarkSearchApp/1.0',
                'Accept': 'application/json'
            }
        },
        {
            name: 'With registered domain headers',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.getcenterpage.com/',
                'Origin': 'https://www.getcenterpage.com'
            }
        },
        {
            name: 'Browser-like headers from registered domain',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.getcenterpage.com/',
                'Origin': 'https://www.getcenterpage.com',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'cross-site'
            }
        }
    ];

    const results = [];
    const testUrl = `${BASE_URL}/trademark/starbucks/status/active/start/1/username/${API_USERNAME}/password/${API_PASSWORD}`;

    for (const config of testConfigurations) {
        try {
            console.log(`Testing with: ${config.name}`);
            const response = await axios.get(testUrl, {
                timeout: 15000,
                headers: config.headers,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status < 500;
                }
            });

            results.push({
                configuration: config.name,
                status: 'success',
                responseStatus: response.status,
                finalUrl: response.request.res?.responseUrl || testUrl,
                contentType: response.headers['content-type'],
                dataType: typeof response.data,
                hasData: response.data && Object.keys(response.data).length > 0
            });

        } catch (error) {
            results.push({
                configuration: config.name,
                status: 'failed',
                error: error.message,
                code: error.code,
                responseStatus: error.response?.status
            });
        }
    }

    res.json({
        message: 'Header configuration test results',
        testUrl: testUrl,
        registeredDomain: 'https://www.getcenterpage.com/',
        results: results
    });
});

// Test route to verify API credentials and connectivity
app.get('/api/test', async (req, res) => {
    const testResults = [];
    
    // Test all three URLs
    const testUrls = [
        `${BASE_URL}/trademark/starbucks/status/active/start/1/username/${API_USERNAME}/password/${API_PASSWORD}`,
        `${DEV_BASE_URL}/trademark/starbucks/status/active/start/1/username/${API_USERNAME}/password/${API_PASSWORD}`,
        `${AWS_BASE_URL}/trademark/starbucks/status/active/start/1/username/${API_USERNAME}/password/${API_PASSWORD}`
    ];
    
    for (let i = 0; i < testUrls.length; i++) {
        try {
            console.log(`Testing URL ${i + 1}:`, testUrls[i]);
            
            const axiosConfig = {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.getcenterpage.com/',
                    'Origin': 'https://www.getcenterpage.com'
                },
                maxRedirects: 5
            };
            
            // For dev server, ignore SSL certificate errors
            if (testUrls[i].includes('dev.markerapi.com')) {
                axiosConfig.httpsAgent = new https.Agent({
                    rejectUnauthorized: false
                });
            }
            
            const response = await axios.get(testUrls[i], axiosConfig);
            
            let dataPreview = response.data;
            if (typeof response.data === 'string') {
                dataPreview = response.data.substring(0, 200) + (response.data.length > 200 ? '...' : '');
            }
            
            testResults.push({
                url: testUrls[i],
                finalUrl: response.request.res?.responseUrl || testUrls[i],
                status: 'success',
                responseStatus: response.status,
                contentType: response.headers['content-type'],
                dataType: typeof response.data,
                dataPreview: dataPreview
            });
            
        } catch (error) {
            testResults.push({
                url: testUrls[i],
                status: 'failed',
                error: error.message,
                code: error.code,
                responseStatus: error.response?.status
            });
        }
    }
    
    res.json({
        message: 'API connectivity test results',
        credentials: {
            username: API_USERNAME,
            password: API_PASSWORD.substring(0, 3) + '***'
        },
        results: testResults
    });
});

// Add a simple connectivity test
app.get('/api/ping', async (req, res) => {
    try {
        // Test basic connectivity to the API domain
        const response = await axios.get('https://markerapi.com', {
            timeout: 5000,
            headers: {
                'User-Agent': 'TrademarkSearchApp/1.0'
            }
        });
        res.json({ 
            status: 'success', 
            message: 'Can reach markerapi.com',
            statusCode: response.status 
        });
    } catch (error) {
        res.json({ 
            status: 'failed', 
            message: 'Cannot reach markerapi.com',
            error: error.message,
            code: error.code
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Trademark API tester running at http://localhost:${port}`);
        console.log(`API Username: ${API_USERNAME}`);
        console.log(`Current API_PASSWORD: ${API_PASSWORD}`);
    });
}

// Export for Vercel
module.exports = app;