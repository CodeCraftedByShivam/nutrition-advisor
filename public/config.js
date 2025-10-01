// Enhanced Configuration for Nutrition Advisor
// Auto-detects environment and sets appropriate URLs

const CONFIG = {
    // Environment Detection
    ENVIRONMENT: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'development' 
        : 'production',
    
    // API Base URLs
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://nutrition-advisor-a93q.onrender.com',
    
    // Frontend URLs
    FRONTEND_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://nutrition-advisor-frontend.onrender.com',
    
    // Feature Flags - Enable/Disable features based on environment
    FEATURES: {
        AI_ENABLED: true,
        DEBUG_MODE: window.location.hostname === 'localhost',
        ANALYTICS: window.location.hostname !== 'localhost',
        SERVICE_WORKER: window.location.hostname !== 'localhost'
    },
    
    // API Timeouts (ms)
    TIMEOUTS: {
        DEFAULT: window.location.hostname === 'localhost' ? 5000 : 10000,
        UPLOAD: 30000,
        AI_REQUEST: 15000
    },
    
    // Storage Keys
    STORAGE_KEYS: {
        JWT_TOKEN: 'nutrition_advisor_token',
        USER_PREFERENCES: 'nutrition_advisor_prefs',
        THEME: 'nutrition_advisor_theme'
    }
};

// Helper Functions
CONFIG.getApiUrl = function(endpoint) {
    return `${this.API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

CONFIG.isLocal = function() {
    return this.ENVIRONMENT === 'development';
};

CONFIG.isProduction = function() {
    return this.ENVIRONMENT === 'production';
};

// Console Logging with Environment Info
if (CONFIG.FEATURES.DEBUG_MODE) {
    console.log('🏠 DEVELOPMENT MODE ACTIVE');
    console.log('📍 API URL:', CONFIG.API_BASE_URL);
    console.log('🎯 Frontend URL:', CONFIG.FRONTEND_URL);
    console.log('🔧 Features:', CONFIG.FEATURES);
} else {
    console.log('☁️ PRODUCTION MODE');
    console.log('🚀 App running at:', CONFIG.FRONTEND_URL);
}

// Export for use in other files
window.CONFIG = CONFIG;
