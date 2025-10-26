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

    // Handle 401 - Token expired
    if (response.status === 401) {
      alert('⚠️ Your session has expired. Please login again.');
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'index.html';
      return { response, result: { error: 'Unauthorized' } };
    }

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
  loadMealStatsWithGoals();
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

// Load today's meals from backend
async function loadTodaysMeals() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { response, result } = await makeApiCall(`/meals?date=${today}`);

    if (response.ok) {
      displayMeals(result);
    }
  } catch (error) {
    console.error('Error loading meals:', error);
  }
}

// ==================== AI DIET CLASSIFICATION (UPDATED) ====================

async function runDietClassification() {
  const resultsContainer = document.getElementById('aiClassificationResults');
  const button = document.getElementById('aiAnalyzeBtn');
  const refreshBtn = document.getElementById('aiRefreshBtn');

  if (!button || !resultsContainer) {
    console.error('Required elements not found');
    return;
  }

  // Show loading state
  button.disabled = true;
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

  // Show results container with loading
  resultsContainer.style.display = 'block';
  resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <div style="width: 60px; height: 60px; border: 4px solid var(--border); border-top: 4px solid var(--accent-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem;"></div>
            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">🧠 AI is analyzing your diet patterns...</h3>
            <p style="color: var(--text-secondary);">Using supervised machine learning algorithms</p>
        </div>
    `;

  try {
    const { response, result } = await makeApiCall('/ai/diet-classification');

    if (response.ok) {
      displayDietClassification(result);

      // Show refresh button after successful analysis
      if (refreshBtn) {
        refreshBtn.style.display = 'flex';
      }
    } else {
      resultsContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div style="background: rgba(239, 68, 68, 0.1); padding: 2rem; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <h3 style="color: var(--accent-danger); margin-bottom: 1rem;">⚠️ ${result.error || 'Analysis failed'}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                            ${result.current_meals ? `You have ${result.current_meals} meals logged. Need at least 5 meals for AI analysis.` : 'Please log more meals and try again.'}
                        </p>
                        <button onclick="showAddMealModal()" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Add More Meals
                        </button>
                    </div>
                </div>
            `;
    }
  } catch (error) {
    console.error('AI Classification error:', error);
    resultsContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <div style="background: rgba(239, 68, 68, 0.1); padding: 2rem; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <h3 style="color: var(--accent-danger); margin-bottom: 1rem;">❌ Connection Error</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">Please check your internet connection and try again.</p>
                    <p style="color: var(--text-muted); font-size: 0.8rem;">Error: ${error.message}</p>
                </div>
            </div>
        `;
  } finally {
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}

// ==================== DISPLAY AI RESULTS (NEW PROFESSIONAL LAYOUT) ====================

function displayDietClassification(data) {
  const resultsContainer = document.getElementById('aiClassificationResults');

  if (!resultsContainer) return;

  const html = `
        <!-- Header Section -->
        <div class="ai-result-header">
            <span class="algorithm-badge">
                <i class="fas fa-brain"></i> ${data.algorithm}
            </span>
            <h3>🎯 ${data.classification.diet_type}</h3>
            <span class="confidence-badge">
                ${data.classification.confidence}% Confidence
            </span>
        </div>
        
        <!-- Main Content -->
        <div class="ai-result-content">
            <!-- Left: Health Score -->
            <div class="ai-health-score">
                <h4>Your Health Score</h4>
                <div class="score-circle-container">
                    <svg width="150" height="150">
                        <circle cx="75" cy="75" r="60" stroke="#e5e7eb" stroke-width="10" fill="none" />
                        <circle cx="75" cy="75" r="60" 
                                stroke="#10B981" 
                                stroke-width="10" 
                                fill="none"
                                stroke-dasharray="${(data.classification.health_score / 100) * 377} 377"
                                stroke-linecap="round" />
                    </svg>
                    <div class="score-value">${data.classification.health_score}</div>
                </div>
                <p class="score-label">out of 100</p>
            </div>
            
            <!-- Right: Nutrition Profile -->
            <div class="ai-nutrition-profile">
                <h4>📈 Your Nutrition Profile</h4>
                <div class="nutrition-stats-grid">
                    <div class="nutrition-stat-box">
                        <h5>Protein</h5>
                        <div class="value">${data.features.protein_ratio}%</div>
                    </div>
                    <div class="nutrition-stat-box">
                        <h5>Carbs</h5>
                        <div class="value">${data.features.carbs_ratio}%</div>
                    </div>
                    <div class="nutrition-stat-box">
                        <h5>Fat</h5>
                        <div class="value">${data.features.fat_ratio}%</div>
                    </div>
                    <div class="nutrition-stat-box">
                        <h5>Meals</h5>
                        <div class="value">${data.features.total_meals_analyzed}</div>
                    </div>
                </div>
                
                <!-- Recommendations -->
                <div class="ai-recommendations">
                    <h4>💡 AI-Powered Recommendations</h4>
                    <div class="recommendation-list">
                        ${data.recommendations.map(rec => `
                            <div class="recommendation-item">
                                <span class="recommendation-icon">${rec.substring(0, 2)}</span>
                                <span class="recommendation-text">${rec.substring(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Timestamp -->
        <div class="ai-timestamp">
            🕐 Analysis updated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
    `;

  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';

  // Smooth scroll to results
  setTimeout(() => {
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
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
      loadMealStatsWithGoals();
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

async function selectFood(foodId, foodName) {
  if (DEBUG_MODE) {
    console.log('Selected food:', foodId, foodName);
  }

  document.getElementById('selectedFoodId').value = foodId;
  document.getElementById('selectedFoodName').value = foodName;
  document.getElementById('foodSearch').value = foodName;
  document.getElementById('foodSuggestions').innerHTML = '';

  document.getElementById('nutritionPreview').style.display = 'block';
  document.getElementById('previewCalories').textContent = 'Loading...';
  document.getElementById('previewProtein').textContent = 'Loading...';
  document.getElementById('previewCarbs').textContent = 'Loading...';
  document.getElementById('previewFat').textContent = 'Loading...';

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

  document.getElementById('selectedFoodId').value = '';
  document.getElementById('selectedFoodName').value = '';
  selectedFood = null;
}

function showNutritionAnalysis() {
  document.getElementById('analysisModal').style.display = 'block';
  loadAnalysis();
}

function closeAnalysisModal() {
  document.getElementById('analysisModal').style.display = 'none';

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

// ==================== PROFILE FUNCTIONS ====================

function showProfile() {
  document.getElementById('profileModal').style.display = 'block';
  loadUserProfile();
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
  document.getElementById('profileMessage').textContent = '';
  document.getElementById('calculatedGoals').style.display = 'none';
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(tabName + 'Tab').classList.add('active');
  document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
}

async function loadUserProfile() {
  try {
    const { response, result } = await makeApiCall('/profile');

    if (response.ok) {
      populateProfileForm(result);

      if (result.dailyCalories) {
        displayCalculatedGoals(result);
      }
    } else if (response.status === 404) {
      if (DEBUG_MODE) {
        console.log('No existing profile found');
      }
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

function populateProfileForm(profile) {
  document.getElementById('fullName').value = profile.fullName || '';
  document.getElementById('age').value = profile.age || '';
  document.getElementById('gender').value = profile.gender || '';
  document.getElementById('height').value = profile.height || '';
  document.getElementById('weight').value = profile.weight || '';
  document.getElementById('activityLevel').value = profile.activityLevel || '';

  document.getElementById('primaryGoal').value = profile.primaryGoal || '';
  document.getElementById('targetWeight').value = profile.targetWeight || '';
  document.getElementById('dietPreference').value = profile.dietPreference || 'none';
  document.getElementById('weeklyGoal').value = profile.weeklyGoal || '0';
  document.getElementById('healthConditions').value = profile.healthConditions || '';
}

function calculateGoals() {
  const age = parseInt(document.getElementById('age').value);
  const weight = parseFloat(document.getElementById('weight').value);
  const height = parseInt(document.getElementById('height').value);
  const gender = document.getElementById('gender').value;
  const activityLevel = document.getElementById('activityLevel').value;
  const weeklyGoal = parseFloat(document.getElementById('weeklyGoal').value || 0);

  if (!age || !weight || !height || !gender || !activityLevel) {
    document.getElementById('profileMessage').className = 'message error';
    document.getElementById('profileMessage').textContent = 'Please fill in all personal information fields first.';
    return;
  }

  document.getElementById('profileMessage').textContent = '';

  let bmr;
  if (gender === 'male') {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
  } else {
    bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
  }

  const activityMultipliers = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9
  };

  const tdee = bmr * (activityMultipliers[activityLevel] || 1.2);

  const weeklyCalorieAdjustment = weeklyGoal * 7700;
  const dailyCalorieAdjustment = weeklyCalorieAdjustment / 7;
  const dailyCalories = Math.round(tdee + dailyCalorieAdjustment);

  const proteinCalories = dailyCalories * 0.25;
  const carbsCalories = dailyCalories * 0.45;
  const fatCalories = dailyCalories * 0.30;

  const dailyProtein = Math.round(proteinCalories / 4);
  const dailyCarbs = Math.round(carbsCalories / 4);
  const dailyFat = Math.round(fatCalories / 9);

  const goalsData = {
    dailyCalories,
    dailyProtein,
    dailyCarbs,
    dailyFat
  };

  displayCalculatedGoals(goalsData);
}

function displayCalculatedGoals(goals) {
  document.getElementById('dailyCalories').textContent = goals.dailyCalories;
  document.getElementById('dailyProtein').textContent = goals.dailyProtein + 'g';
  document.getElementById('dailyCarbs').textContent = goals.dailyCarbs + 'g';
  document.getElementById('dailyFat').textContent = goals.dailyFat + 'g';

  document.getElementById('calculatedGoals').style.display = 'block';

  document.getElementById('calculatedGoals').scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

async function saveProfile() {
  const personalForm = document.getElementById('personalInfoForm');
  const goalsForm = document.getElementById('goalsForm');

  const formData = new FormData();

  new FormData(personalForm).forEach((value, key) => {
    formData.append(key, value);
  });

  new FormData(goalsForm).forEach((value, key) => {
    formData.append(key, value);
  });

  const profileData = {};
  formData.forEach((value, key) => {
    profileData[key] = value;
  });

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

      displayCalculatedGoals(result.profile);
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

function updateDashboardGoals(profile) {
  loadMealStatsWithGoals();
}

async function loadMealStatsWithGoals() {
  try {
    const [statsResult, profileResult] = await Promise.all([
      makeApiCall('/meals/stats').catch(() => ({ response: { ok: false } })),
      makeApiCall('/profile').catch(() => ({ response: { ok: false } }))
    ]);

    if (statsResult.response && statsResult.response.ok) {
      const stats = statsResult.result;
      let goalProgress = stats.goal_progress;

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

// Logout function
function logout() {
  localStorage.removeItem(TOKEN_KEY);

  if (typeof CONFIG !== 'undefined') {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PREFERENCES);
  }

  window.location.href = 'index.html';
}

// Enhanced meal form submission
document.getElementById('addMealForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  let mealData = {
    mealType: formData.get('mealType'),
    quantity: formData.get('quantity'),
  };

  const selectedFoodName = document.getElementById('selectedFoodName').value;
  const selectedFoodId = document.getElementById('selectedFoodId').value;

  if (DEBUG_MODE) {
    console.log('Form submission - Selected food:', selectedFoodName, selectedFoodId);
    console.log('Selected food object:', selectedFood);
  }

  if (selectedFoodName && selectedFoodId) {
    mealData.foodName = selectedFoodName;
    mealData.food_id = selectedFoodId;

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
      const message = document.getElementById('mealMessage');
      message.className = 'message success';
      message.textContent = 'Meal added successfully!';

      e.target.reset();
      document.getElementById('foodSearch').value = '';
      document.getElementById('selectedFoodId').value = '';
      document.getElementById('selectedFoodName').value = '';

      loadMealStatsWithGoals();
      loadTodaysMeals();

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
  document.getElementById('totalCaloriesAnalysis').textContent = data.total_calories;
  document.getElementById('avgCaloriesAnalysis').textContent = data.avg_calories;
  document.getElementById('totalMealsAnalysis').textContent = data.total_meals;

  const recommendationsList = document.getElementById('recommendationsList');
  if (data.recommendations.length > 0) {
    recommendationsList.innerHTML = data.recommendations.map(rec => `<p>${rec}</p>`).join('');
  } else {
    recommendationsList.innerHTML = '<p>No recommendations available yet. Log more meals!</p>';
  }

  createMacrosChart(data.total_protein, data.total_carbs, data.total_fat);
  createCaloriesChart(data.daily_data);
}

function createMacrosChart(protein, carbs, fat) {
  const ctx = document.getElementById('macrosChart').getContext('2d');

  if (macrosChart) {
    macrosChart.destroy();
  }

  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const total = proteinCals + carbsCals + fatCals;

  if (total === 0) {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add meals to see breakdown', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  macrosChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Protein', 'Carbohydrates', 'Fat'],
      datasets: [{
        data: [proteinCals, carbsCals, fatCals],
        backgroundColor: ['#FF6B6B', '#4ECDC4', '#FFE66D'],
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
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            label: function (context) {
              const percentage = ((context.raw / total) * 100).toFixed(1);
              return `${context.label}: ${percentage}%`;
            }
          }
        }
      }
    }
  });
}

function createCaloriesChart(dailyData) {
  const ctx = document.getElementById('caloriesChart').getContext('2d');

  if (caloriesChart) {
    caloriesChart.destroy();
  }

  const dates = Object.keys(dailyData).sort();
  const calories = dates.map(date => dailyData[date].calories);

  if (dates.length === 0) {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Add meals to see trends', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

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
          grid: { color: 'rgba(0,0,0,0.1)' },
          title: {
            display: true,
            text: 'Calories',
            font: { size: 12, weight: 'bold' }
          }
        },
        x: { grid: { color: 'rgba(0,0,0,0.1)' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          callbacks: {
            title: function (context) {
              return `Date: ${context[0].label}`;
            },
            label: function (context) {
              return `Calories: ${context.raw}`;
            }
          }
        }
      }
    }
  });
}

// Close modal when clicking outside
window.onclick = function (event) {
  const addMealModal = document.getElementById('addMealModal');
  const analysisModal = document.getElementById('analysisModal');
  const profileModal = document.getElementById('profileModal');

  if (event.target === addMealModal) {
    closeModal();
  }
  if (event.target === analysisModal) {
    closeAnalysisModal();
  }
  if (event.target === profileModal) {
    closeProfileModal();
  }
}

// ==================== LSTM FORECASTING ====================

async function runLSTMForecast() {
  const resultsContainer = document.getElementById('lstmForecastResults');
  const button = document.getElementById('lstmForecastBtn');
  const refreshBtn = document.getElementById('lstmRefreshBtn');

  if (!button || !resultsContainer) {
    console.error('Required elements not found');
    return;
  }

  // Show loading state
  button.disabled = true;
  const originalHTML = button.innerHTML;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Forecasting...';

  // Show results container with loading
  resultsContainer.style.display = 'block';
  resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 3rem;">
            <div style="width: 60px; height: 60px; border: 4px solid var(--border); border-top: 4px solid var(--accent-tertiary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.5rem;"></div>
            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">🔮 LSTM is analyzing your patterns...</h3>
            <p style="color: var(--text-secondary);">Using deep learning to forecast next 7 days</p>
        </div>
    `;

  try {
    const { response, result } = await makeApiCall('/ai/forecast-intake?days=7');

    if (response.ok && result.success) {
      displayLSTMForecast(result);

      // Show refresh button
      if (refreshBtn) {
        refreshBtn.style.display = 'flex';
      }
    } else {
      resultsContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div style="background: rgba(239, 68, 68, 0.1); padding: 2rem; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                        <h3 style="color: var(--accent-danger); margin-bottom: 1rem;">⚠️ ${result.error || 'Forecasting unavailable'}</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                            ${result.message || 'Not enough data to generate forecast'}
                        </p>
                        ${result.current_days !== undefined ? `
                            <div style="margin: 1.5rem 0;">
                                <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; display: inline-block;">
                                    <strong style="color: var(--text-primary); font-size: 2rem;">${result.current_days}</strong>
                                    <span style="color: var(--text-muted); display: block; font-size: 0.85rem;">days logged</span>
                                </div>
                                <span style="margin: 0 1rem; color: var(--text-muted);">→</span>
                                <div style="background: var(--bg-card); padding: 1rem; border-radius: 8px; display: inline-block;">
                                    <strong style="color: var(--accent-primary); font-size: 2rem;">${result.required_days}</strong>
                                    <span style="color: var(--text-muted); display: block; font-size: 0.85rem;">days needed</span>
                                </div>
                            </div>
                        ` : ''}
                        <button onclick="showAddMealModal()" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Log More Meals
                        </button>
                    </div>
                </div>
            `;
    }
  } catch (error) {
    console.error('LSTM Forecast error:', error);
    resultsContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center;">
                <div style="background: rgba(239, 68, 68, 0.1); padding: 2rem; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <h3 style="color: var(--accent-danger); margin-bottom: 1rem;">❌ Connection Error</h3>
                    <p style="color: var(--text-secondary);">Please check your internet connection and try again.</p>
                    <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">Error: ${error.message}</p>
                </div>
            </div>
        `;
  } finally {
    button.disabled = false;
    button.innerHTML = originalHTML;
  }
}

function displayLSTMForecast(data) {
  const resultsContainer = document.getElementById('lstmForecastResults');

  if (!resultsContainer) return;

  const { current_stats, forecasts, insights, analysis_period } = data;

  // Get trend icon and class
  const trendClass = current_stats.trend;
  const trendIcon = {
    'increasing': '📈',
    'decreasing': '📉',
    'stable': '➡️'
  }[trendClass] || '➡️';

  const html = `
        <!-- Header -->
        <div class="forecast-header">
            <span class="model-badge">
                <i class="fas fa-brain"></i> ${data.model}
            </span>
            <h3>${trendIcon} Next 7 Days Forecast</h3>
        </div>
        
        <!-- Current Stats -->
        <div class="forecast-stats-grid">
            <div class="forecast-stat-box">
                <h5>Average Daily</h5>
                <div class="value">${current_stats.average_daily_calories}</div>
                <div class="label">calories/day</div>
            </div>
            
            <div class="forecast-stat-box" style="border-left-color: var(--accent-primary);">
                <h5>Recent Trend</h5>
                <div class="value">${current_stats.recent_average}</div>
                <div class="label">last week avg</div>
                <span class="forecast-trend-badge ${trendClass}">
                    ${current_stats.trend}
                </span>
            </div>
            
            <div class="forecast-stat-box" style="border-left-color: var(--accent-secondary);">
                <h5>Volatility</h5>
                <div class="value">${current_stats.volatility_score}%</div>
                <div class="label">variation</div>
            </div>
        </div>
        
        <!-- Forecast Table -->
        <div class="forecast-chart-section">
            <h4>📅 7-Day Calorie Forecast</h4>
            <table class="forecast-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Day</th>
                        <th>Predicted Calories</th>
                        <th>Range</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    ${forecasts.map(forecast => `
                        <tr>
                            <td><strong>${new Date(forecast.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong></td>
                            <td>${forecast.day_name}</td>
                            <td><strong style="color: var(--accent-primary); font-size: 1.1rem;">${forecast.predicted_calories}</strong> cal</td>
                            <td style="font-size: 0.85rem; color: var(--text-muted);">
                                ${forecast.range.lower} - ${forecast.range.upper}
                            </td>
                            <td>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <div class="confidence-bar" style="flex: 1;">
                                        <div class="confidence-fill" style="width: ${forecast.confidence}%;"></div>
                                    </div>
                                    <span style="font-weight: 700; font-size: 0.85rem;">${forecast.confidence}%</span>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Insights -->
        <div class="forecast-insights">
            <h4>💡 AI-Powered Insights</h4>
            ${insights.map(insight => `
                <div class="insight-item">
                    <span class="insight-icon">${insight.icon}</span>
                    <div class="insight-content">
                        <h5>${insight.title}</h5>
                        <p>${insight.message}</p>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <!-- Timestamp -->
        <div class="forecast-timestamp">
            🕐 Forecast generated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} | 
            Analyzed ${analysis_period.days_analyzed} days of data
        </div>
    `;

  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';

  // Smooth scroll
  setTimeout(() => {
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}


// ==================== CLUSTERING ANALYSIS ====================
// ==================== CLUSTERING ANALYSIS ====================

// Initialize clustering when page loads
document.addEventListener('DOMContentLoaded', function () {
  initializeClusteringButtons();
});

function initializeClusteringButtons() {
  const analyzeBtn = document.getElementById('clusterAnalyzeBtn');
  const refreshBtn = document.getElementById('clusterRefreshBtn');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', runClusterAnalysis);
    console.log('✅ Cluster analyze button initialized');
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', runClusterAnalysis);
    console.log('✅ Cluster refresh button initialized');
  }
}

async function runClusterAnalysis() {
  console.log('🔬 Clustering analysis started');
  const analyzeBtn = document.getElementById('clusterAnalyzeBtn');
  const refreshBtn = document.getElementById('clusterRefreshBtn');
  const resultsDiv = document.getElementById('clusterResults');

  if (!analyzeBtn) {
    console.error('Cluster analyze button not found');
    return;
  }

  // Show loading state
  const originalHTML = analyzeBtn.innerHTML;
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';

  try {
    console.log('Making API call to ai/cluster-analysis');
    const { response, result } = await makeApiCall('ai/cluster-analysis', 'GET');  // ← DESTRUCTURE!

    console.log('✅ Cluster API response:', { response, result });

    if (response.ok && result.success) {  // ← CORRECT CHECK!
      console.log('✅ Clustering successful:', result.cluster_profile.name);

      // Hide analyze button, show refresh button
      analyzeBtn.style.display = 'none';
      if (refreshBtn) {
        refreshBtn.style.display = 'flex';
      }

      // Display results
      displayClusterResults(result);  // ← Pass result, not response

      if (resultsDiv) {
        resultsDiv.style.display = 'block';
        // Smooth scroll to results
        setTimeout(() => {
          resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    } else {
      console.error('❌ Clustering failed:', result);

      // Show error message
      const errorMsg = result.message || result.error || 'Failed to perform clustering analysis';
      alert(errorMsg);

      // If insufficient data, show helpful message
      if (result.current_meals !== undefined) {
        alert(`You have ${result.current_meals} meals logged. You need at least ${result.required_meals} meals for clustering analysis.\n\n${result.suggestion || 'Keep logging meals!'}`);
      }
    }
  } catch (error) {
    console.error('❌ Clustering error:', error);
    alert(`Failed to perform clustering analysis. Please check:\n1. Backend server is running\n2. You are logged in\n3. You have logged at least 5 meals\n\n${error.message}`);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = originalHTML;
  }
}
function displayClusterResults(data) {
  console.log('🎨 Displaying cluster results');

  const resultsDiv = document.getElementById('clusterResults');
  if (!resultsDiv) {
    console.error('❌ clusterResults div not found');
    return;
  }

  const profile = data.cluster_profile;
  const features = data.features_analyzed;

  const html = `
    <div class="cluster-result-card">
      <!-- Header -->
      <div class="cluster-header" style="background: linear-gradient(135deg, ${profile.color}15, ${profile.color}05);">
        <span class="algorithm-badge">🔬 ${data.algorithm}</span>
        <div class="cluster-icon-large">${profile.icon}</div>
        <h3 style="color: ${profile.color};">${profile.name}</h3>
        <p class="cluster-description">${profile.description}</p>
        <div class="similar-users-badge">
          <i class="fas fa-users"></i> ${data.similar_users.toLocaleString()} users in this group
        </div>
      </div>

      <!-- Features Grid -->
      <div class="cluster-features-section">
        <h4>📊 Your Dietary Pattern Analysis</h4>
        <div class="cluster-features-grid">
          <div class="cluster-feature-box">
            <h5>Avg Calories</h5>
            <div class="value">${Math.round(features.avg_calories)}</div>
            <span class="label">kcal/day</span>
          </div>
          <div class="cluster-feature-box">
            <h5>Protein</h5>
            <div class="value">${features.protein_ratio}%</div>
            <span class="label">of calories</span>
          </div>
          <div class="cluster-feature-box">
            <h5>Carbs</h5>
            <div class="value">${features.carbs_ratio}%</div>
            <span class="label">of calories</span>
          </div>
          <div class="cluster-feature-box">
            <h5>Fat</h5>
            <div class="value">${features.fat_ratio}%</div>
            <span class="label">of calories</span>
          </div>
          <div class="cluster-feature-box">
            <h5>Meal Frequency</h5>
            <div class="value">${features.meal_frequency.toFixed(1)}</div>
            <span class="label">meals/day</span>
          </div>
          <div class="cluster-feature-box">
            <h5>Consistency</h5>
            <div class="value">${Math.round(features.calorie_consistency)}</div>
            <span class="label">std deviation</span>
          </div>
        </div>
      </div>

      <!-- Insights -->
      <div class="cluster-insights-section">
        <h4>💡 Personalized Insights for Your Group</h4>
        <div class="cluster-insights-list">
          ${data.insights.map(insight => `
            <div class="cluster-insight-item">
              <div class="insight-icon">${insight.icon}</div>
              <div class="insight-content">
                <h5>${insight.title}</h5>
                <p>${insight.message}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Metadata -->
      <div class="cluster-metadata">
        <span><i class="fas fa-utensils"></i> ${data.meals_analyzed} meals analyzed</span>
        <span><i class="fas fa-clock"></i> ${new Date(data.timestamp).toLocaleString()}</span>
      </div>
    </div>
  `;

  resultsDiv.innerHTML = html;
  console.log('✅ Cluster results displayed successfully');
}

// Log that clustering module is loaded
console.log('✅ Clustering analysis module loaded and ready');
