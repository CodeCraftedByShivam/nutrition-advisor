// Modal functions
function showRegister() {
  document.getElementById('authModal').style.display = 'block';
  document.getElementById('registerSection').style.display = 'block';
  document.getElementById('loginSection').style.display = 'none';
}

function showLogin() {
  document.getElementById('authModal').style.display = 'block';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('registerSection').style.display = 'none';
}

function closeModal() {
  document.getElementById('authModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('authModal');
  if (event.target === modal) {
    closeModal();
  }
}

// Enhanced error handling function
function showMessage(elementId, type, message) {
  const messageElement = document.getElementById(elementId);
  messageElement.className = `message ${type}`;
  messageElement.textContent = message;
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageElement.textContent = '';
      messageElement.className = '';
    }, 5000);
  }
}

// Enhanced API call with error handling and loading states
async function makeApiCall(endpoint, method, data = null, loadingElementId = null) {
  if (loadingElementId) {
    const loadingElement = document.getElementById(loadingElementId);
    if (loadingElement) {
      loadingElement.textContent = 'Loading...';
      loadingElement.className = 'message info';
    }
  }

  try {
    const options = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    // Use CONFIG for dynamic URL
    const response = await fetch(CONFIG.getApiUrl(endpoint), options);
    const result = await response.json();

    // Clear loading state
    if (loadingElementId) {
      const loadingElement = document.getElementById(loadingElementId);
      if (loadingElement) {
        loadingElement.textContent = '';
        loadingElement.className = '';
      }
    }

    return { response, result };
  } catch (error) {
    console.error('API call failed:', error);
    
    // Clear loading state
    if (loadingElementId) {
      const loadingElement = document.getElementById(loadingElementId);
      if (loadingElement) {
        loadingElement.textContent = '';
        loadingElement.className = '';
      }
    }

    throw new Error('Network error. Please check your connection and try again.');
  }
}

// Enhanced Register functionality
const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(registerForm);
  const data = Object.fromEntries(formData.entries());

  // Validation
  if (!data.name || !data.email || !data.password) {
    showMessage('registerMessage', 'error', 'Please fill in all fields.');
    return;
  }

  if (data.password.length < 6) {
    showMessage('registerMessage', 'error', 'Password must be at least 6 characters long.');
    return;
  }

  try {
    const { response, result } = await makeApiCall('/register', 'POST', data, 'registerMessage');

    if (response.ok) {
      showMessage('registerMessage', 'success', 'Registration successful! You can login now.');
      registerForm.reset();
      
      // Log success in debug mode
      if (CONFIG.FEATURES.DEBUG_MODE) {
        console.log('✅ Registration successful:', result);
      }
      
      setTimeout(() => showLogin(), 2000);
    } else {
      showMessage('registerMessage', 'error', 'Error: ' + (result.error || 'Registration failed'));
      
      // Log error in debug mode
      if (CONFIG.FEATURES.DEBUG_MODE) {
        console.error('❌ Registration failed:', result);
      }
    }
  } catch (error) {
    showMessage('registerMessage', 'error', error.message);
  }
});

// Enhanced Login functionality
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(loginForm);
  const data = Object.fromEntries(formData.entries());

  // Validation
  if (!data.email || !data.password) {
    showMessage('loginMessage', 'error', 'Please enter both email and password.');
    return;
  }

  try {
    const { response, result } = await makeApiCall('/login', 'POST', data, 'loginMessage');

    if (response.ok) {
      // Store token using CONFIG storage key
      localStorage.setItem(CONFIG.STORAGE_KEYS.JWT_TOKEN, result.token);
      
      // Store user info for later use
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES, JSON.stringify({
        user_id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        loginTime: new Date().toISOString()
      }));

      showMessage('loginMessage', 'success', 'Login successful! Redirecting to dashboard...');
      loginForm.reset();
      
      // Log success in debug mode
      if (CONFIG.FEATURES.DEBUG_MODE) {
        console.log('✅ Login successful:', {
          user: result.user,
          token: result.token.substring(0, 20) + '...'
        });
      }

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 2000);
    } else {
      showMessage('loginMessage', 'error', 'Error: ' + (result.error || 'Login failed'));
      
      // Log error in debug mode
      if (CONFIG.FEATURES.DEBUG_MODE) {
        console.error('❌ Login failed:', result);
      }
    }
  } catch (error) {
    showMessage('loginMessage', 'error', error.message);
  }
});

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.JWT_TOKEN);
  
  if (token) {
    // User is already logged in
    if (CONFIG.FEATURES.DEBUG_MODE) {
      console.log('🔐 User already logged in, redirecting to dashboard');
    }
    
    // Optional: Show a message before redirecting
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
      existingMessage.className = 'message info';
      existingMessage.textContent = 'You are already logged in. Redirecting to dashboard...';
    }
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1000);
  }
  
  // Log environment info in debug mode
  if (CONFIG.FEATURES.DEBUG_MODE) {
    console.log('🏠 Home page loaded in', CONFIG.ENVIRONMENT, 'mode');
    console.log('🔗 API endpoint:', CONFIG.API_BASE_URL);
  }
});
