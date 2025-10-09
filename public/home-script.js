// ==================== MOBILE MENU ==================== 
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.getElementById('navLinks');

if (mobileToggle) {
  mobileToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    const icon = mobileToggle.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
  });
}

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      navLinks.classList.remove('active');
      const icon = mobileToggle.querySelector('i');
      icon.classList.remove('fa-times');
      icon.classList.add('fa-bars');
    }
  });
});

// ==================== NAVBAR SCROLL EFFECT ====================
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

// ==================== MODAL FUNCTIONS ====================
function showRegister() {
  document.getElementById('authModal').style.display = 'block';
  document.getElementById('registerSection').style.display = 'block';
  document.getElementById('loginSection').style.display = 'none';
  document.body.style.overflow = 'hidden';
}

function showLogin() {
  document.getElementById('authModal').style.display = 'block';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('registerSection').style.display = 'none';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('authModal').style.display = 'none';
  document.body.style.overflow = '';
  
  // Clear form messages
  const registerMessage = document.getElementById('registerMessage');
  const loginMessage = document.getElementById('loginMessage');
  if (registerMessage) registerMessage.textContent = '';
  if (loginMessage) loginMessage.textContent = '';
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ==================== MESSAGE DISPLAY ====================
function showMessage(elementId, type, message) {
  const messageElement = document.getElementById(elementId);
  if (messageElement) {
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
}

// ==================== API CALL HELPER ====================
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

// ==================== REGISTER FUNCTIONALITY ====================
const registerForm = document.getElementById('registerForm');

if (registerForm) {
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
        showMessage('registerMessage', 'success', '✅ Registration successful! You can login now.');
        registerForm.reset();
        
        // Log success in debug mode
        if (CONFIG.FEATURES.DEBUG_MODE) {
          console.log('✅ Registration successful:', result);
        }
        
        setTimeout(() => showLogin(), 2000);
      } else {
        showMessage('registerMessage', 'error', '❌ ' + (result.error || 'Registration failed'));
        
        // Log error in debug mode
        if (CONFIG.FEATURES.DEBUG_MODE) {
          console.error('❌ Registration failed:', result);
        }
      }
    } catch (error) {
      showMessage('registerMessage', 'error', error.message);
    }
  });
}

// ==================== LOGIN FUNCTIONALITY ====================
const loginForm = document.getElementById('loginForm');

if (loginForm) {
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

        showMessage('loginMessage', 'success', '✅ Login successful! Redirecting to dashboard...');
        loginForm.reset();
        
        // Log success in debug mode
        if (CONFIG.FEATURES.DEBUG_MODE) {
          console.log('✅ Login successful:', {
            user: result.user,
            token: result.token.substring(0, 20) + '...'
          });
        }

        // Redirect to dashboard after 1.5 seconds
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      } else {
        showMessage('loginMessage', 'error', '❌ ' + (result.error || 'Login failed'));
        
        // Log error in debug mode
        if (CONFIG.FEATURES.DEBUG_MODE) {
          console.error('❌ Login failed:', result);
        }
      }
    } catch (error) {
      showMessage('loginMessage', 'error', error.message);
    }
  });
}

// ==================== CHECK IF ALREADY LOGGED IN ====================
document.addEventListener('DOMContentLoaded', function() {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.JWT_TOKEN);
  
  if (token) {
    // User is already logged in
    if (CONFIG.FEATURES.DEBUG_MODE) {
      console.log('🔐 User already logged in, redirecting to dashboard');
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

// ==================== SMOOTH SCROLL FOR ANCHOR LINKS ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});
