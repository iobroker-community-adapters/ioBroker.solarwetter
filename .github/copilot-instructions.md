# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## Adapter-Specific Context

**Adapter Name**: ioBroker.solarwetter
**Primary Function**: Solar weather forecast adapter that retrieves daily solar power generation forecasts from solar-wetter.com for German regions
**Key Features**:
- Fetches solar forecast data based on German postal code (PLZ) regions
- Provides clear sky and real sky (min/max) values for solar irradiation
- Calculates expected power output for personal solar installations
- Supports 4-day forecast charts for selected cities
- Creates structured data points: `solarwetter.0.forecast.*`

**Data Source**: http://www.solar-wetter.com - provides solar irradiation forecasts for Germany
**Configuration Requirements**:
- Location selection via postal code (PLZ) from predefined list
- Solar plant power capacity for energy calculation
- City selection for 4-day forecast charts
- No authentication required (removed in 2022/03)

**Key Dependencies**:
- `axios` for HTTP requests to solar-wetter.com
- Data parsing from HTML responses (specific German format)
- German postal code validation (admin/plz.js contains valid PLZ ranges)

**Data Points Structure**:
- `forecast.clearSky` - Clear sky solar irradiation value
- `forecast.realSky_min/max` - Real sky conditions (min/max range)
- `forecast.Datum` - Forecast date
- `forecast.Region` - Selected postal code region
- `forecast.home.Leistung` - Calculated power output for personal installation
- `forecast.chart.city/url` - 4-day forecast chart reference

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Test specific states exist and have expected values
                        const testState = await harness.states.getStateAsync('your-adapter.0.some.state');
                        if (!testState) {
                            return reject(new Error('Expected state not found'));
                        }
                        
                        console.log('✅ Step 4: All tests passed');
                        resolve();
                        
                    } catch (e) {
                        console.error('❌ Test failed:', e.message);
                        reject(e);
                    }
                });
            });
        });
    }
});
```

#### Integration Test Best Practices for ioBroker Adapters

**Test Structure Requirements:**
- Always use `tests.integration(path.join(__dirname, '..'))` as the base
- Use `defineAdditionalTests({ suite })` for custom test scenarios
- Implement proper async/await patterns with Promise wrappers
- Include comprehensive state validation after adapter execution
- Test both successful data retrieval and error conditions

**Configuration Testing:**
```javascript
// Example configuration for testing
Object.assign(obj.native, {
    location: 'test-location',
    apiKey: 'test-api-key',
    updateInterval: 10,
    enableDebugMode: true
});
```

**State Validation Pattern:**
```javascript
// Validate required states exist and have expected types/values
const requiredStates = [
    'your-adapter.0.info.connection',
    'your-adapter.0.data.value1',
    'your-adapter.0.data.value2'
];

for (const stateId of requiredStates) {
    const state = await harness.states.getStateAsync(stateId);
    if (!state) {
        throw new Error(`Required state ${stateId} not found`);
    }
    // Add type and value validation as needed
}
```

**Error Handling in Tests:**
- Wrap all async operations in try-catch blocks
- Use descriptive error messages for test failures
- Test both success and failure scenarios
- Implement proper cleanup in test teardown

**Async Operation Testing:**
```javascript
// For adapters that perform async operations (API calls, file operations)
const waitForAdapter = (harness, timeout = 30000) => {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkStatus = () => {
            harness.states.getState('your-adapter.0.info.connection', (err, state) => {
                if (err) return reject(err);
                
                if (state && state.val === true) {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Adapter connection timeout'));
                } else {
                    setTimeout(checkStatus, 1000);
                }
            });
        };
        
        checkStatus();
    });
};
```

## ioBroker Adapter Development Best Practices

### Adapter Lifecycle Management
- Always implement proper startup sequence in `main()` function
- Use `adapter.on('ready', callback)` for initialization
- Implement `adapter.on('unload', callback)` for clean shutdown
- Clear all timers and intervals in unload handler
- Close network connections and file handles properly

### State Management
- Use `adapter.setState()` for updating values
- Use `adapter.setObjectNotExists()` for creating new objects
- Implement proper state acknowledgment handling
- Use appropriate state types (number, string, boolean, object)

### Error Handling and Logging
```javascript
// Proper error handling pattern
try {
    const result = await someAsyncOperation();
    adapter.log.debug('Operation successful');
    adapter.setState('info.connection', true, true);
} catch (error) {
    adapter.log.error('Operation failed: ' + error.message);
    adapter.setState('info.connection', false, true);
    
    // Don't stop adapter for recoverable errors
    // adapter.stop() only for critical failures
}
```

### Configuration Validation
```javascript
function validateConfig() {
    if (!adapter.config.requiredSetting) {
        adapter.log.error('Required setting missing');
        adapter.stop();
        return false;
    }
    return true;
}
```

### Timer and Interval Management
```javascript
let dataUpdateTimer;

function startDataCollection() {
    if (dataUpdateTimer) clearTimeout(dataUpdateTimer);
    
    dataUpdateTimer = setTimeout(() => {
        collectData();
        startDataCollection(); // Restart timer
    }, adapter.config.interval * 1000);
}

// In unload handler
function unload(callback) {
    try {
        if (dataUpdateTimer) clearTimeout(dataUpdateTimer);
        dataUpdateTimer = undefined;
        // Other cleanup
    } catch (e) {
        // Handle cleanup errors
    } finally {
        callback();
    }
}
```

### JSON Configuration (Admin Interface)
- Define configuration schema in `io-package.json`
- Use appropriate input types (text, number, checkbox, select)
- Implement client-side validation when possible
- Provide helpful descriptions and default values

```json
{
  "native": {
    "apiUrl": {
      "type": "string",
      "default": "https://api.example.com"
    },
    "refreshInterval": {
      "type": "number",
      "default": 300,
      "min": 60,
      "max": 3600
    },
    "enableFeature": {
      "type": "boolean",
      "default": false
    }
  }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

### Solarwetter-Specific Testing Considerations

**Mock Data for Offline Testing**:
- Create mock HTML responses that match solar-wetter.com structure
- Test postal code validation with admin/plz.js data
- Validate German date/time parsing functions
- Test power calculation with different solar plant sizes

**API-Specific Test Scenarios**:
```javascript
// Test with valid German postal codes
const testPLZCodes = ['10115', '20095', '80331', '01067']; // Berlin, Hamburg, Munich, Dresden

// Test data parsing functions
describe('Solar Weather Data Parsing', () => {
    it('should parse clearSky values from HTML', () => {
        const mockHTML = '<html>...mock solar-wetter.com response...</html>';
        const result = findeWertClearsky(mockHTML);
        expect(result).toBeGreaterThan(0);
    });
    
    it('should calculate power output correctly', () => {
        const plantPower = 5.5; // kWp
        const clearSkyValue = 4.2; // kWh/m²
        const expectedOutput = plantPower * clearSkyValue;
        // Test power calculation logic
    });
});
```

**Network Resilience Testing**:
- Test behavior when solar-wetter.com is unreachable
- Validate timeout handling for HTTP requests
- Test graceful degradation when data parsing fails
- Ensure adapter doesn't stop permanently on temporary failures

## Solarwetter-Specific Development Guidelines

### German Localization
- All user-facing messages should support German localization
- Date formats must follow German conventions (DD.MM.YYYY)
- Handle German postal code system (PLZ) properly
- Use appropriate German weather/solar terminology

### Data Source Integration
- **URL Pattern**: `http://www.vorhersage-plz-bereich.solar-wetter.com/html/${plz}.htm`
- **No Authentication**: Removed username/password requirement in 2022/03
- **HTML Parsing**: Use robust parsing that handles format changes
- **Error Handling**: Website availability issues should not crash adapter

### Configuration Management
```javascript
// Postal code validation
function validatePLZ(plz) {
    if (!plz || plz === 'select' || plz.length < 3) {
        adapter.log.warn('Invalid postal code selected');
        return false;
    }
    return true;
}

// Power calculation for solar installations
function calculateSolarOutput(clearSkyValue, plantPower) {
    if (!plantPower || plantPower <= 0) {
        return 0;
    }
    return clearSkyValue * plantPower;
}
```

### Data Point Structure
Maintain consistent naming and types for all data points:
```javascript
const dataPoints = {
    'forecast.clearSky': { type: 'number', unit: 'kWh/m²' },
    'forecast.realSky_min': { type: 'number', unit: 'kWh/m²' },
    'forecast.realSky_max': { type: 'number', unit: 'kWh/m²' },
    'forecast.Datum': { type: 'string', description: 'Forecast date' },
    'forecast.Region': { type: 'string', description: 'PLZ region' },
    'forecast.home.Leistung': { type: 'number', unit: 'kWh' },
    'forecast.chart.city': { type: 'string' },
    'forecast.chart.url': { type: 'string' }
};
```

### Schedule and Timing
- Adapter runs once daily (scheduled execution)
- Use appropriate timeout for web scraping (60 seconds max)
- Implement force termination after 1 minute to prevent hanging
- Consider German timezone for data relevance

### HTML Parsing Best Practices
```javascript
// Robust parsing with error handling
function parseWeatherData(htmlBody) {
    try {
        // Use multiple parsing strategies
        let value = findeWertClearsky(htmlBody);
        if (value === null || value === undefined) {
            adapter.log.warn('Could not parse clear sky value');
            return null;
        }
        return value;
    } catch (error) {
        adapter.log.error('HTML parsing failed: ' + error.message);
        return null;
    }
}
```