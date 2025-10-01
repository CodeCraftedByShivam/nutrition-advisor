// Enhanced Configuration Support for Dashboard
const API_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'https://nutrition-advisor-a93q.onrender.com';
const TOKEN_KEY = typeof CONFIG !== 'undefined' ? CONFIG.STORAGE_KEYS.JWT_TOKEN : 'token';
const DEBUG_MODE = typeof CONFIG !== 'undefined' ? CONFIG.FEATURES.DEBUG_MODE : false;

// Check if user is logged in
const token = localStorage.getItem(TOKEN_KEY);
if (!token) {
  window.location.href = 'home.html';
}

let selectedFood = null;

// Chart variables to store chart instances
let macrosChart = null;
let caloriesChart = null;

// Enhanced API call helper function
async function makeApiCall(endpoint, method = 'GET', data = null, showLoading = false) {
  const loadingElement = showLoading ? document.querySelector('.loading') : null;
  
  if (loadingElement) {
    loadingElement.style.display = 'block';
  }

  try {
    const options = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`, options);
    const result = await response.json();

    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    if (DEBUG_MODE) {
      console.log(`API Call ${method} ${endpoint}:`, { response: response.status, result });
    }

    return { response, result };
  } catch (error) {
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }

    if (DEBUG_MODE) {
      console.error(`API Error ${method} ${endpoint}:`, error);
    }

    throw error;
  }
}

// Initialize dashboard - UPDATED to use enhanced stats loading
document.addEventListener('DOMContentLoaded', () => {
  loadUserInfo();
  loadMealStatsWithGoals(); // CHANGED: Now uses personalized goals
  loadTodaysMeals();
  setupFoodSearch();
  
  if (DEBUG_MODE) {
    console.log('🏠 Dashboard loaded in', typeof CONFIG !== 'undefined' ? CONFIG.ENVIRONMENT : 'production', 'mode');
    console.log('🔗 API endpoint:', API_URL);
  }
});

// Load user info
async function loadUserInfo() {
  try {
    const userPrefs = localStorage.getItem(typeof CONFIG !== 'undefined' ? CONFIG.STORAGE_KEYS.USER_PREFERENCES : 'user_prefs');
    if (userPrefs) {
      const user = JSON.parse(userPrefs);
      document.getElementById('welcomeText').textContent = `Welcome back, ${user.name}!`;
    } else {
      document.getElementById('welcomeText').textContent = 'Welcome back!';
    }
  } catch (error) {
    document.getElementById('welcomeText').textContent = 'Welcome back!';
  }
}

// Load meal statistics from backend
async function loadMealStats() {
  try {
    const { response, result } = await makeApiCall('/meals/stats');
    
    if (response.ok) {
      document.getElementById('caloriesCount').textContent = result.total_calories;
      document.getElementById('mealsCount').textContent = result.meals_count;
      document.getElementById('goalProgress').textContent = result.goal_progress + '%';
      document.getElementById('streakCount').textContent = result.streak;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load today's meals from backend
async function loadTodaysMeals() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const { response, result } = await makeApiCall(`/meals?date=${today}`);
    
    if (response.ok) {
      displayMeals(result);
    }
  } catch (error) {
    console.error('Error loading meals:', error);
  }
}

// Display meals in UI
function displayMeals(meals) {
  const mealsContainer = document.getElementById('recentMeals');
  
  if (meals.length === 0) {
    mealsContainer.innerHTML = `
      <div class="empty-state">
        <p>No meals logged today. Start by adding your first meal!</p>
      </div>
    `;
    return;
  }
  
  mealsContainer.innerHTML = meals.map(meal => `
    <div class="meal-item">
      <div class="meal-info">
        <h4>${meal.foodName}</h4>
        <p>${meal.mealType} • ${meal.quantity}</p>
      </div>
      <div class="meal-actions">
        <span class="meal-calories">${meal.calories || 0} cal</span>
        <button onclick="deleteMeal('${meal._id}')" class="delete-btn">×</button>
      </div>
    </div>
  `).join('');
}

// Delete meal function
async function deleteMeal(mealId) {
  if (!confirm('Are you sure you want to delete this meal?')) return;
  
  try {
    const { response } = await makeApiCall(`/meal/delete/${mealId}`, 'DELETE');
    
    if (response.ok) {
      // Refresh the display
      loadMealStatsWithGoals(); // CHANGED: Use enhanced version
      loadTodaysMeals();
    } else {
      alert('Error deleting meal');
    }
  } catch (error) {
    console.error('Error deleting meal:', error);
    alert('Error deleting meal');
  }
}

// Food search functionality
function setupFoodSearch() {
  const foodSearch = document.getElementById('foodSearch');
  const suggestions = document.getElementById('foodSuggestions');
  let searchTimeout;
  
  foodSearch.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      suggestions.innerHTML = '';
      return;
    }
    
    searchTimeout = setTimeout(() => {
      searchFood(query);
    }, 500);
  });
}

async function searchFood(query) {
  try {
    const { response, result } = await makeApiCall(`/food/search?q=${encodeURIComponent(query)}`);
    
    if (response.ok) {
      displayFoodSuggestions(result.foods || []);
    }
  } catch (error) {
    console.error('Error searching food:', error);
  }
}

function displayFoodSuggestions(foods) {
  const suggestions = document.getElementById('foodSuggestions');
  
  if (foods.length === 0) {
    suggestions.innerHTML = '<div class="suggestion-item">No foods found</div>';
    return;
  }
  
  suggestions.innerHTML = foods.map(food => `
    <div class="suggestion-item" onclick="selectFood('${food.food_id}', '${food.food_name.replace(/'/g, "\\'")}')">
      <strong>${food.food_name}</strong>
      <br><small>${food.food_description}</small>
    </div>
  `).join('');
}

// Enhanced selectFood function with debug logs
async function selectFood(foodId, foodName) {
  if (DEBUG_MODE) {
    console.log('Selected food:', foodId, foodName);
  }
  
  document.getElementById('selectedFoodId').value = foodId;
  document.getElementById('selectedFoodName').value = foodName;
  document.getElementById('foodSearch').value = foodName;
  document.getElementById('foodSuggestions').innerHTML = '';
  
  // Show loading in nutrition preview
  document.getElementById('nutritionPreview').style.display = 'block';
  document.getElementById('previewCalories').textContent = 'Loading...';
  document.getElementById('previewProtein').textContent = 'Loading...';
  document.getElementById('previewCarbs').textContent = 'Loading...';
  document.getElementById('previewFat').textContent = 'Loading...';
  
  // Load nutrition details
  try {
    if (DEBUG_MODE) {
      console.log('Fetching food details for ID:', foodId);
    }
    
    const { response, result } = await makeApiCall(`/food/details/${foodId}`);
    
    if (response.ok) {
      if (DEBUG_MODE) {
        console.log('Food details received:', result);
      }
      displayNutritionPreview(result);
      selectedFood = result;
    } else {
      console.error('Error fetching food details:', response.status);
      document.getElementById('previewCalories').textContent = 'Error';
    }
  } catch (error) {
    console.error('Error loading food details:', error);
    document.getElementById('previewCalories').textContent = 'Error';
  }
}

// Enhanced displayNutritionPreview function
function displayNutritionPreview(foodData) {
  if (DEBUG_MODE) {
    console.log('Displaying nutrition for:', foodData);
  }
  
  if (!foodData.food || !foodData.food.servings) {
    console.error('Invalid food data structure:', foodData);
    return;
  }
  
  let serving;
  if (Array.isArray(foodData.food.servings.serving)) {
    serving = foodData.food.servings.serving[0];
  } else {
    serving = foodData.food.servings.serving;
  }
  
  if (DEBUG_MODE) {
    console.log('Using serving data:', serving);
  }
  
  document.getElementById('previewCalories').textContent = serving.calories || '0';
  document.getElementById('previewProtein').textContent = serving.protein || '0';
  document.getElementById('previewCarbs').textContent = serving.carbohydrate || '0';
  document.getElementById('previewFat').textContent = serving.fat || '0';
  
  document.getElementById('nutritionPreview').style.display = 'block';
}

// Modal functions
function showAddMealModal() {
  document.getElementById('addMealModal').style.display = 'block';
}

function closeModal() {
  document.getElementById('addMealModal').style.display = 'none';
  document.getElementById('mealMessage').textContent = '';
  document.getElementById('foodSuggestions').innerHTML = '';
  document.getElementById('nutritionPreview').style.display = 'none';
  
  // Reset form fields
  document.getElementById('selectedFoodId').value = '';
  document.getElementById('selectedFoodName').value = '';
  selectedFood = null;
}

// Show Nutrition Analysis Modal - UPDATED
function showNutritionAnalysis() {
  document.getElementById('analysisModal').style.display = 'block';
  loadAnalysis();
}

// Close Analysis Modal
function closeAnalysisModal() {
  document.getElementById('analysisModal').style.display = 'none';
  
  // Destroy existing charts to prevent memory leaks
  if (macrosChart) {
    macrosChart.destroy();
    macrosChart = null;
  }
  if (caloriesChart) {
    caloriesChart.destroy();
    caloriesChart = null;
  }
}

function showGoalSetting() {
  alert('Goal Setting feature coming soon!');
}

// ==================== PROFILE FUNCTIONS - ALL NEW ====================

// Show Profile Modal - REPLACED the placeholder
function showProfile() {
  document.getElementById('profileModal').style.display = 'block';
  loadUserProfile();
}

// Close Profile Modal - NEW
function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
  document.getElementById('profileMessage').textContent = '';
  document.getElementById('calculatedGoals').style.display = 'none';
}

// Switch between profile tabs - NEW
function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabName + 'Tab').classList.add('active');
  document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
}

// Load existing user profile - NEW
async function loadUserProfile() {
  try {
    const { response, result } = await makeApiCall('/profile');
    
    if (response.ok) {
      populateProfileForm(result);
      
      // Show calculated goals if they exist
      if (result.dailyCalories) {
        displayCalculatedGoals(result);
      }
    } else if (response.status === 404) {
      // Profile doesn't exist yet, that's okay
      if (DEBUG_MODE) {
        console.log('No existing profile found');
      }
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Populate form with existing profile data - NEW
function populateProfileForm(profile) {
  // Personal Info
  document.getElementById('fullName').value = profile.fullName || '';
  document.getElementById('age').value = profile.age || '';
  document.getElementById('gender').value = profile.gender || '';
  document.getElementById('height').value = profile.height || '';
  document.getElementById('weight').value = profile.weight || '';
  document.getElementById('activityLevel').value = profile.activityLevel || '';
  
  // Goals & Preferences
  document.getElementById('primaryGoal').value = profile.primaryGoal || '';
  document.getElementById('targetWeight').value = profile.targetWeight || '';
  document.getElementById('dietPreference').value = profile.dietPreference || 'none';
  document.getElementById('weeklyGoal').value = profile.weeklyGoal || '0';
  document.getElementById('healthConditions').value = profile.healthConditions || '';
}

// Calculate personalized nutrition goals - NEW
function calculateGoals() {
  // Get form data
  const age = parseInt(document.getElementById('age').value);
  const weight = parseFloat(document.getElementById('weight').value);
  const height = parseInt(document.getElementById('height').value);
  const gender = document.getElementById('gender').value;
  const activityLevel = document.getElementById('activityLevel').value;
  const weeklyGoal = parseFloat(document.getElementById('weeklyGoal').value || 0);
  
  // Validate required fields
  if (!age || !weight || !height || !gender || !activityLevel) {
    document.getElementById('profileMessage').className = 'message error';
    document.getElementById('profileMessage').textContent = 'Please fill in all personal information fields first.';
    return;
  }
  
  // Clear any error messages
  document.getElementById('profileMessage').textContent = '';
  
  // Calculate BMR using Mifflin-St Jeor Equation
  let bmr;
  if (gender === 'male') {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }
  
  // Activity level multipliers
  const activityMultipliers = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9
  };
  
  // Calculate TDEE (Total Daily Energy Expenditure)
  const tdee = bmr * (activityMultipliers[activityLevel] || 1.2);
  
  // Adjust for weekly weight goal (1 kg = 7700 calories)
  const weeklyCalorieAdjustment = weeklyGoal * 7700;
  const dailyCalorieAdjustment = weeklyCalorieAdjustment / 7;
  const dailyCalories = Math.round(tdee + dailyCalorieAdjustment);
  
  // Calculate macronutrient goals
  const proteinCalories = dailyCalories * 0.25; // 25% protein
  const carbsCalories = dailyCalories * 0.45;   // 45% carbs
  const fatCalories = dailyCalories * 0.30;     // 30% fat
  
  const dailyProtein = Math.round(proteinCalories / 4); // 4 calories per gram
  const dailyCarbs = Math.round(carbsCalories / 4);     // 4 calories per gram
  const dailyFat = Math.round(fatCalories / 9);         // 9 calories per gram
  
  // Display calculated goals
  const goalsData = {
    dailyCalories,
    dailyProtein,
    dailyCarbs,
    dailyFat
  };
  
  displayCalculatedGoals(goalsData);
}

// Display calculated nutrition goals - NEW
function displayCalculatedGoals(goals) {
  document.getElementById('dailyCalories').textContent = goals.dailyCalories;
  document.getElementById('dailyProtein').textContent = goals.dailyProtein + 'g';
  document.getElementById('dailyCarbs').textContent = goals.dailyCarbs + 'g';
  document.getElementById('dailyFat').textContent = goals.dailyFat + 'g';
  
  document.getElementById('calculatedGoals').style.display = 'block';
  
  // Scroll to goals section
  document.getElementById('calculatedGoals').scrollIntoView({ 
    behavior: 'smooth', 
    block: 'center' 
  });
}

// Save complete profile - NEW
async function saveProfile() {
  // Collect all form data
  const personalForm = document.getElementById('personalInfoForm');
  const goalsForm = document.getElementById('goalsForm');
  
  const formData = new FormData();
  
  // Add personal info
  new FormData(personalForm).forEach((value, key) => {
    formData.append(key, value);
  });
  
  // Add goals info
  new FormData(goalsForm).forEach((value, key) => {
    formData.append(key, value);
  });
  
  // Convert to JSON
  const profileData = {};
  formData.forEach((value, key) => {
    profileData[key] = value;
  });
  
  // Validate required fields
  const requiredFields = ['fullName', 'age', 'gender', 'height', 'weight', 'activityLevel', 'primaryGoal'];
  const missingFields = requiredFields.filter(field => !profileData[field]);
  
  if (missingFields.length > 0) {
    document.getElementById('profileMessage').className = 'message error';
    document.getElementById('profileMessage').textContent = `Please fill in: ${missingFields.join(', ')}`;
    return;
  }
  
  try {
    const { response, result } = await makeApiCall('/profile', 'POST', profileData);
    
    if (response.ok) {
      document.getElementById('profileMessage').className = 'message success';
      document.getElementById('profileMessage').textContent = 'Profile saved successfully! Your personalized goals have been calculated.';
      
      // Display the calculated goals from server response
      displayCalculatedGoals(result.profile);
      
      // Update dashboard stats if needed
      updateDashboardGoals(result.profile);
      
    } else {
      document.getElementById('profileMessage').className = 'message error';
      document.getElementById('profileMessage').textContent = result.error || 'Error saving profile';
    }
  } catch (error) {
    console.error('Error saving profile:', error);
    document.getElementById('profileMessage').className = 'message error';
    document.getElementById('profileMessage').textContent = 'Error saving profile. Please try again.';
  }
}

// Update dashboard with personalized goals - NEW
function updateDashboardGoals(profile) {
  // You can update the dashboard goal display here
  // For example, update the daily goal percentage calculation
  loadMealStatsWithGoals();
}

// Enhanced meal stats loading with personalized goals - NEW
async function loadMealStatsWithGoals() {
  try {
    const [statsResult, profileResult] = await Promise.all([
      makeApiCall('/meals/stats').catch(() => ({ response: { ok: false } })),
      makeApiCall('/profile').catch(() => ({ response: { ok: false } }))
    ]);
    
    if (statsResult.response && statsResult.response.ok) {
      const stats = statsResult.result;
      let goalProgress = stats.goal_progress;
      
      // Use personalized goals if profile exists
      if (profileResult.response && profileResult.response.ok) {
        const profile = profileResult.result;
        if (profile.dailyCalories) {
          goalProgress = Math.min(Math.round((stats.total_calories / profile.dailyCalories) * 100), 100);
        }
      }
      
      document.getElementById('caloriesCount').textContent = stats.total_calories;
      document.getElementById('mealsCount').textContent = stats.meals_count;
      document.getElementById('goalProgress').textContent = goalProgress + '%';
      document.getElementById('streakCount').textContent = stats.streak;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ==================== END OF PROFILE FUNCTIONS ====================

// Logout function
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  
  // Also remove user preferences
  if (typeof CONFIG !== 'undefined') {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES);
  }
  
  window.location.href = 'index.html';
}

// Enhanced meal form submission with proper nutrition handling
document.getElementById('addMealForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  let mealData = {
    mealType: formData.get('mealType'),
    quantity: formData.get('quantity'),
  };
  
  // Get selected food data from hidden inputs
  const selectedFoodName = document.getElementById('selectedFoodName').value;
  const selectedFoodId = document.getElementById('selectedFoodId').value;
  
  if (DEBUG_MODE) {
    console.log('Form submission - Selected food:', selectedFoodName, selectedFoodId);
    console.log('Selected food object:', selectedFood);
  }
  
  if (selectedFoodName && selectedFoodId) {
    // Use selected food from dropdown
    mealData.foodName = selectedFoodName;
    mealData.food_id = selectedFoodId;
    
    // Add nutrition data if available
    if (selectedFood && selectedFood.food && selectedFood.food.servings) {
      let serving;
      if (Array.isArray(selectedFood.food.servings.serving)) {
        serving = selectedFood.food.servings.serving[0];
      } else {
        serving = selectedFood.food.servings.serving;
      }
      
      if (DEBUG_MODE) {
        console.log('Adding nutrition data from serving:', serving);
      }
      
      mealData.calories = parseInt(serving.calories) || 0;
      mealData.protein = parseFloat(serving.protein) || 0;
      mealData.carbs = parseFloat(serving.carbohydrate) || 0;
      mealData.fat = parseFloat(serving.fat) || 0;
    }
  } else {
    // Fallback to manual input
    mealData.foodName = document.getElementById('foodSearch').value;
    mealData.calories = 0;
    if (DEBUG_MODE) {
      console.log('Using manual input:', mealData.foodName);
    }
  }
  
  if (DEBUG_MODE) {
    console.log('Final meal data being sent:', mealData);
  }
  
  try {
    const { response, result } = await makeApiCall('/meal/add', 'POST', mealData);
    
    if (DEBUG_MODE) {
      console.log('Server response:', result);
    }
    
    if (response.ok) {
      // Show success message
      const message = document.getElementById('mealMessage');
      message.className = 'message success';
      message.textContent = 'Meal added successfully!';
      
      // Reset form
      e.target.reset();
      document.getElementById('foodSearch').value = '';
      document.getElementById('selectedFoodId').value = '';
      document.getElementById('selectedFoodName').value = '';
      
      // Update dashboard with enhanced stats
      loadMealStatsWithGoals(); // CHANGED: Use enhanced version
      loadTodaysMeals();
      
      // Close modal after 2 seconds
      setTimeout(() => {
        closeModal();
      }, 2000);
    } else {
      const message = document.getElementById('mealMessage');
      message.className = 'message error';
      message.textContent = 'Error: ' + (result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error adding meal:', error);
    const message = document.getElementById('mealMessage');
    message.className = 'message error';
    message.textContent = 'Error adding meal. Please try again.';
  }
});

// Load Analysis Data
async function loadAnalysis() {
  const period = document.getElementById('periodFilter').value;
  
  try {
    const { response, result } = await makeApiCall(`/meals/analysis?period=${period}`);
    
    if (response.ok) {
      displayAnalysisData(result);
    } else {
      console.error('Error loading analysis data');
    }
  } catch (error) {
    console.error('Error loading analysis:', error);
  }
}

// Display Analysis Data with Charts
function displayAnalysisData(data) {
  // Update stats
  document.getElementById('totalCaloriesAnalysis').textContent = data.total_calories;
  document.getElementById('avgCaloriesAnalysis').textContent = data.avg_calories;
  document.getElementById('totalMealsAnalysis').textContent = data.total_meals;
  
  // Update recommendations
  const recommendationsList = document.getElementById('recommendationsList');
  if (data.recommendations.length > 0) {
    recommendationsList.innerHTML = data.recommendations.map(rec => `<p>${rec}</p>`).join('');
  } else {
    recommendationsList.innerHTML = '<p>No recommendations available yet. Log more meals!</p>';
  }
  
  // Create Macros Pie Chart
  createMacrosChart(data.total_protein, data.total_carbs, data.total_fat);
  
  // Create Daily Calories Chart
  createCaloriesChart(data.daily_data);
}

// Create Macronutrient Pie Chart - FIXED
function createMacrosChart(protein, carbs, fat) {
  const ctx = document.getElementById('macrosChart').getContext('2d');
  
  // Destroy existing chart
  if (macrosChart) {
    macrosChart.destroy();
  }
  
  // Calculate calories from macros
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const total = proteinCals + carbsCals + fatCals;
  
  if (total === 0) {
    // Show placeholder when no data
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add meals to see breakdown', ctx.canvas.width/2, ctx.canvas.height/2);
    return;
  }
  
  macrosChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Protein', 'Carbohydrates', 'Fat'],
      datasets: [{
        data: [proteinCals, carbsCals, fatCals],
        backgroundColor: [
          '#FF6B6B',  // Red for protein
          '#4ECDC4',  // Teal for carbs
          '#FFE66D'   // Yellow for fat
        ],
        borderWidth: 3,
        borderColor: '#fff',
        hoverBorderWidth: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: function(context) {
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return `${context.label}: ${percentage}%`;
            }
          }
        }
      }
    }
  });
}

// Create Daily Calories Line Chart - FIXED
function createCaloriesChart(dailyData) {
  const ctx = document.getElementById('caloriesChart').getContext('2d');
  
  // Destroy existing chart
  if (caloriesChart) {
    caloriesChart.destroy();
  }
  
  // Prepare data for chart
  const dates = Object.keys(dailyData).sort();
  const calories = dates.map(date => dailyData[date].calories);
  
  if (dates.length === 0) {
    // Show placeholder when no data
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add meals to see trends', ctx.canvas.width/2, ctx.canvas.height/2);
    return;
  }
  
  // Format dates for display
  const formattedDates = dates.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  caloriesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: formattedDates,
      datasets: [{
        label: 'Daily Calories',
        data: calories,
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4CAF50',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0,0,0,0.1)'
          },
          title: {
            display: true,
            text: 'Calories',
            font: {
              size: 12,
              weight: 'bold'
            }
          }
        },
        x: {
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            title: function(context) {
              return `Date: ${context[0].label}`;
            },
            label: function(context) {
              return `Calories: ${context.raw}`;
            }
          }
        }
      }
    }
  });
}

// Close modal when clicking outside - UPDATED to include profile modal
window.onclick = function(event) {
  const addMealModal = document.getElementById('addMealModal');
  const analysisModal = document.getElementById('analysisModal');
  const profileModal = document.getElementById('profileModal');
  
  if (event.target === addMealModal) {
    closeModal();
  }
  if (event.target === analysisModal) {
    closeAnalysisModal();
  }
  if (event.target === profileModal) { // NEW: Added profile modal handling
    closeProfileModal();
  }
}
