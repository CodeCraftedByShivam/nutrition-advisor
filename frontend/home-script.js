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

// Register functionality
const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(registerForm);
  const data = Object.fromEntries(formData.entries());

  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (response.ok) {
    registerMessage.className = 'message success';
    registerMessage.textContent = 'Registration successful! You can login now.';
    registerForm.reset();
    setTimeout(() => showLogin(), 2000);
  } else {
    registerMessage.className = 'message error';
    registerMessage.textContent = 'Error: ' + (result.error || 'Unknown error');
  }
});

// Login functionality
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(loginForm);
  const data = Object.fromEntries(formData.entries());

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (response.ok) {
    localStorage.setItem('token', result.token);
    loginMessage.className = 'message success';
    loginMessage.textContent = 'Login successful! Redirecting to dashboard...';
    loginForm.reset();
    
    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);
  } else {
    loginMessage.className = 'message error';
    loginMessage.textContent = 'Error: ' + (result.error || 'Unknown error');
  }
});
