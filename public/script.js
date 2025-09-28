const registerForm = document.getElementById('registerForm');
const message = document.getElementById('message');

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(registerForm);
  const data = Object.fromEntries(formData.entries());

  const response = await fetch('http://127.0.0.1:5000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (response.ok) {
    message.className = 'message success';
    message.textContent = 'Registration successful! You can login now.';
    registerForm.reset();
  } else {
    message.className = 'message error';
    message.textContent = 'Error: ' + (result.error || 'Unknown error');
  }
});

const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(loginForm);
  const data = Object.fromEntries(formData.entries());

  const response = await fetch('http://127.0.0.1:5000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (response.ok) {
    loginMessage.className = 'message success';
    loginMessage.textContent = 'Login successful! JWT Token saved.';
    localStorage.setItem('token', result.token);
    loginForm.reset();
  } else {
    loginMessage.className = 'message error';
    loginMessage.textContent = 'Error: ' + (result.error || 'Unknown error');
  }
});

// Load Users Functionality
const loadUsersBtn = document.getElementById('loadUsersBtn');
const usersList = document.getElementById('usersList');

loadUsersBtn.addEventListener('click', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must login first!');
    return;
  }

  loadUsersBtn.textContent = 'Loading...';
  loadUsersBtn.disabled = true;

  const response = await fetch('http://127.0.0.1:5000/users', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });

  loadUsersBtn.textContent = 'Load Users';
  loadUsersBtn.disabled = false;

  if (response.ok) {
    const users = await response.json();
    usersList.innerHTML = '';

    users.forEach(user => {
      const userCard = document.createElement('div');
      userCard.className = 'user-card';
      userCard.innerHTML = `
        <div class="user-info">
          <h4>${user.name || 'No Name'}</h4>
          <p>${user.email || 'No Email'}</p>
          <p>ID: ${user._id}</p>
        </div>
      `;
      usersList.appendChild(userCard);
    });

    if (users.length === 0) {
      usersList.innerHTML = '<p>No users found.</p>';
    }
  } else {
    const err = await response.json();
    alert('Error loading users: ' + (err.error || 'Unknown error'));
  }
});
