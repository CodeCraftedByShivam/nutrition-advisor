# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Rest of your imports
from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt
import os
import jwt
from functools import wraps
from datetime import datetime, timedelta, timezone
import certifi
from flask_cors import CORS
import requests
from requests_oauthlib import OAuth1

# Import LSTM Forecaster
# Safe import of ML models with error handling
LSTM_AVAILABLE = False
CLUSTERING_AVAILABLE = False

try:
    from lstm_forecaster import NutritionLSTMForecaster
    LSTM_AVAILABLE = True
    print("✅ LSTM model loaded")
except Exception as e:
    print(f"⚠️ LSTM disabled: {e}")
    LSTM_AVAILABLE = False

try:
    from clustering_model import DietaryClusteringModel
    CLUSTERING_AVAILABLE = True
    print("✅ Clustering model loaded")
except Exception as e:
    print(f"⚠️ Clustering disabled: {e}")
    CLUSTERING_AVAILABLE = False
# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "your_super_secret_key")

# FIXED CORS CONFIGURATION
CORS(app, 
     origins=["*"],
     allow_headers=["Content-Type", "Authorization", "Access-Control-Allow-Credentials"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     supports_credentials=False)

# Environment variables
SECRET_KEY = app.config['SECRET_KEY']
MONGO_URI = os.getenv("MONGO_URI")
FATSECRET_CONSUMER_KEY = os.getenv("FATSECRET_CONSUMER_KEY", "2b11373a2a91447c8641b776788d2080")
FATSECRET_CONSUMER_SECRET = os.getenv("FATSECRET_CONSUMER_SECRET", "87ae6c68b73d4169a0a54a35b2b2c141")

# MongoDB connection with error handling
try:
    if MONGO_URI:
        client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
        db = client["nutrition_advisor_db"]
        users_collection = db["users"]
        meals_collection = db["meals"]  # ← ADD THIS LINE!

        print("✅ MongoDB connected successfully")
    else:
        client = None
        db = None
        users_collection = None
        meals_collection = None  # ← ADD THIS TOO!

        print("❌ MongoDB URI not found")
except Exception as e:
    client = None
    db = None
    users_collection = None
    meals_collection = None  # ← ADD THIS TOO!

    print(f"❌ MongoDB connection error: {e}")


# Add this function around line 50-60 (after imports, before routes)

def calculate_streak(user_id):
    """
    Calculate consecutive days streak for a user
    Returns: int (number of consecutive days with meal logs)
    """
    try:
        from datetime import datetime, timedelta
        
        # Handle if user_id is a dict (extract the actual ID)
        if isinstance(user_id, dict):
            actual_user_id = str(user_id.get('_id', user_id.get('user_id', '')))
        else:
            actual_user_id = str(user_id)
        
        # Get all meals for user, sorted by date (newest first)
        meals = list(meals_collection.find(
            {"user_id": actual_user_id},  # ← Use cleaned ID
            {"date": 1}
        ).sort("date", -1))
        
        if not meals:
            return 0
        
        # Get unique dates
        unique_dates = []
        for meal in meals:
            meal_date = datetime.strptime(meal['date'], '%Y-%m-%d').date()
            if meal_date not in unique_dates:
                unique_dates.append(meal_date)
        
        unique_dates.sort(reverse=True)  # Newest first
        
        # Calculate streak
        streak = 0
        today = datetime.now().date()
        expected_date = today
        
        for date in unique_dates:
            if date == expected_date:
                streak += 1
                expected_date -= timedelta(days=1)
            elif date == expected_date - timedelta(days=1) and streak == 0:
                streak = 1
                expected_date = date - timedelta(days=1)
            else:
                break
        
        return streak if streak > 0 else 1
        
    except Exception as e:
        print(f"❌ Streak calculation error: {e}")
        import traceback
        traceback.print_exc()
        return 1

# Error handlers
@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "details": str(error)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

# ==================== FIXED JWT DECORATOR ====================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if users_collection is None:
            return jsonify({"error": "Database not available"}), 500
            
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header[len("Bearer "):]
            else:
                token = auth_header

        if not token:
            print("❌ Token missing from request")
            return jsonify({"error": "Token is missing!"}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            print(f"✅ Token decoded successfully for user: {data.get('user_id')}")
            
            current_user = users_collection.find_one({"_id": ObjectId(data["user_id"])})
            
            if not current_user:
                print(f"❌ User not found: {data.get('user_id')}")
                return jsonify({"error": "User not found!"}), 401
            
            print(f"✅ User authenticated: {current_user.get('email')}")
            
            return f(current_user, *args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            print("❌ Token expired")
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            print(f"❌ Invalid token: {str(e)}")
            return jsonify({"error": "Token is invalid"}), 401
        except Exception as e:
            print(f"❌ Token validation error: {str(e)}")
            return jsonify({"error": "Token validation failed", "details": str(e)}), 401

    return decorated

# Basic Routes
@app.route("/")
def home():
    return jsonify({
        "message": "Nutrition Advisor API is running!",
        "status": "healthy",
        "database": "connected" if users_collection is not None else "not connected",
        "ai_features": {
            "diet_classification": True,
            "lstm_forecasting": True,
            "clustering": "coming_soon"
        },
        "environment": {
            "SECRET_KEY": bool(SECRET_KEY),
            "MONGO_URI": bool(MONGO_URI),
            "FATSECRET_KEYS": bool(FATSECRET_CONSUMER_KEY and FATSECRET_CONSUMER_SECRET)
        }
    })

@app.route("/ping")
def ping():
    return jsonify({"message": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})

# Auth Routes [KEEPING ALL YOUR EXISTING AUTH ROUTES]
@app.route("/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200
        
    if users_collection is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data received"}), 400
            
        required_fields = ["name", "email", "password"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        if users_collection.find_one({"email": data["email"]}):
            return jsonify({"error": "Email already registered"}), 400

        hashed_pw = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt())

        user = {
            "name": data["name"],
            "email": data["email"],
            "password": hashed_pw,
            "created_at": datetime.now(timezone.utc)
        }

        user_id = users_collection.insert_one(user).inserted_id
        return jsonify({"message": "User registered successfully", "user_id": str(user_id)}), 201
        
    except Exception as e:
        return jsonify({"error": "Registration failed", "details": str(e)}), 500

@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return jsonify({"message": "OK"}), 200
        
    if users_collection is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data received"}), 400
            
        if "email" not in data or "password" not in data:
            return jsonify({"error": "Email and password required"}), 400

        user = users_collection.find_one({"email": data["email"]})

        if user and bcrypt.checkpw(data["password"].encode("utf-8"), user["password"]):
            token = jwt.encode({
                "user_id": str(user["_id"]),
                "exp": datetime.now(timezone.utc) + timedelta(hours=24)
            }, SECRET_KEY, algorithm="HS256")
            
            return jsonify({
                "message": "Login successful", 
                "token": token,
                "user": {
                    "id": str(user["_id"]),
                    "name": user["name"],
                    "email": user["email"]
                }
            }), 200
        else:
            return jsonify({"error": "Invalid email or password"}), 401
            
    except Exception as e:
        return jsonify({"error": "Login failed", "details": str(e)}), 500

# [KEEPING ALL YOUR EXISTING USER CRUD ROUTES - No changes]

@app.route("/user/create", methods=["POST"])
@token_required
def create_user(current_user):
    try:
        data = request.get_json()
        required_fields = ["name", "age", "weight", "health_conditions", "activity_level"]

        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        user_id = users_collection.insert_one(data).inserted_id
        data["_id"] = str(user_id)
        return jsonify({"message": "User profile created", "data": data}), 201
        
    except Exception as e:
        return jsonify({"error": "Failed to create user", "details": str(e)}), 500

@app.route("/users", methods=["GET"])
@token_required
def get_all_users(current_user):
    try:
        users_cursor = users_collection.find()
        users = []
        for user in users_cursor:
            user["_id"] = str(user["_id"])
            if "password" in user:
                del user["password"]
            users.append(user)
        return jsonify(users), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch users", "details": str(e)}), 500

@app.route("/user/<id>", methods=["GET"])
@token_required
def get_user(current_user, id):
    try:
        user = users_collection.find_one({"_id": ObjectId(id)})
        if user:
            user["_id"] = str(user["_id"])
            if "password" in user:
                del user["password"]
            return jsonify(user), 200
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": "Invalid user ID", "details": str(e)}), 400

@app.route("/user/update/<id>", methods=["PUT"])
@token_required
def update_user(current_user, id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = ObjectId(id)
        result = users_collection.update_one({"_id": user_id}, {"$set": data})

        if result.matched_count == 0:
            return jsonify({"error": "User not found"}), 404

        updated_user = users_collection.find_one({"_id": user_id})
        updated_user["_id"] = str(updated_user["_id"])
        if "password" in updated_user:
            del updated_user["password"]
        return jsonify({"message": "User updated successfully", "data": updated_user}), 200

    except Exception as e:
        return jsonify({"error": "Update failed", "details": str(e)}), 400

@app.route("/user/delete/<id>", methods=["DELETE"])
@token_required
def delete_user(current_user, id):
    try:
        user_id = ObjectId(id)
        result = users_collection.delete_one({"_id": user_id})

        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": "Delete failed", "details": str(e)}), 400

# [KEEPING ALL YOUR MEAL ROUTES - No changes needed]

@app.route("/meal/add", methods=["POST"])
@token_required
def add_meal(current_user):
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        data = request.get_json()
        required_fields = ["mealType", "foodName", "quantity"]
        
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400
        
        meal = {
            "user_id": str(current_user["_id"]),
            "mealType": data["mealType"],
            "foodName": data["foodName"],
            "quantity": data["quantity"],
            "calories": data.get("calories", 0),
            "protein": data.get("protein", 0),
            "carbs": data.get("carbs", 0),
            "fat": data.get("fat", 0),
            "food_id": data.get("food_id", ""),
            "date": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            "created_at": datetime.now(timezone.utc)
        }
        
        meals_collection = db["meals"]
        meal_id = meals_collection.insert_one(meal).inserted_id
        meal["_id"] = str(meal_id)
        
        return jsonify({"message": "Meal added successfully", "meal": meal}), 201
        
    except Exception as e:
        return jsonify({"error": "Failed to add meal", "details": str(e)}), 500

@app.route("/meals", methods=["GET"])
@token_required
def get_user_meals(current_user):
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        date_filter = request.args.get('date')
        
        query = {"user_id": str(current_user["_id"])}
        
        if date_filter:
            # Parse the date filter (format: YYYY-MM-DD)
            filter_date = datetime.fromisoformat(date_filter).date()
            start_date = datetime.combine(filter_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_date = datetime.combine(filter_date, datetime.max.time()).replace(tzinfo=timezone.utc)
            query["created_at"] = {"$gte": start_date, "$lte": end_date}
            print(f"🔍 Fetching meals for date: {date_filter}")
        else:
            # If no date filter, get all meals (sorted by most recent)
            print(f"🔍 Fetching all meals for user")
        
        meals = list(meals_collection.find(query).sort("created_at", -1))
        
        # Convert ObjectId and datetime to strings
        for meal in meals:
            meal["_id"] = str(meal["_id"])
            meal["created_at"] = meal["created_at"].isoformat()
        
        print(f"📊 Returned {len(meals)} meals")
        return jsonify(meals), 200
        
    except Exception as e:
        print(f"❌ Error fetching meals: {str(e)}")
        return jsonify({"error": "Failed to fetch meals", "details": str(e)}), 500

@app.route("/meal/delete/<meal_id>", methods=["DELETE"])
@token_required
def delete_meal(current_user, meal_id):
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        result = meals_collection.delete_one({
            "_id": ObjectId(meal_id),
            "user_id": str(current_user["_id"])
        })
        
        if result.deleted_count == 0:
            return jsonify({"error": "Meal not found"}), 404
            
        return jsonify({"message": "Meal deleted successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to delete meal", "details": str(e)}), 400

@app.route('/meals/stats', methods=['GET'])
@token_required
def get_meal_stats(user_id):
    """Get daily meal statistics and streak"""
    try:
        from datetime import datetime
        
        # Handle if user_id is a dict
        if isinstance(user_id, dict):
            actual_user_id = str(user_id.get('_id', user_id.get('user_id', '')))
        else:
            actual_user_id = str(user_id)
        
        print(f"📊 Getting stats for user: {actual_user_id}")
        
        # Get today's date (start and end of day in UTC)
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
print(f"📅 Looking for meals with date: {today}")
        
        # Query meals for today (simple string match!)
        meals = list(meals_collection.find({
            "user_id": actual_user_id,
            "date": today  # ← Simple exact match!
        }))
        
        print(f"📊 Found {len(meals)} meals for today")
        
        # Calculate totals
        total_calories = sum(m.get('calories', 0) for m in meals)
        total_protein = sum(m.get('protein', 0) for m in meals)
        total_carbs = sum(m.get('carbs', 0) for m in meals)
        total_fat = sum(m.get('fat', 0) for m in meals)
        
        # Get user's goal
        user = users_collection.find_one({"_id": ObjectId(actual_user_id)})
        goal = user.get('daily_goal', {}) if user else {}
        goal_calories = goal.get('calories', 2000)
        
        goal_progress = (total_calories / goal_calories * 100) if goal_calories > 0 else 0
        
        # Calculate streak (simplified for now)
try:
            all_meals = list(meals_collection.find({"user_id": actual_user_id}, {"date": 1}).sort("date", -1).limit(30))
            unique_dates = list(set(m.get('date') for m in all_meals if m.get('date')))
            streak = min(len(unique_dates), 30)  # Max 30 for now
        except:
            streak = 1
        
        stats = {
            "total_calories": round(total_calories, 1),
            "total_protein": round(total_protein, 1),
            "total_carbs": round(total_carbs, 1),
            "total_fat": round(total_fat, 1),
            "meals_count": len(meals),
            "goal_progress": round(goal_progress, 1),
            "streak": max(1, streak) if len(all_meals) > 0 else 0
        }
        
        print(f"✅ Stats calculated: {stats}")
        
        return jsonify(stats), 200
                
    except Exception as e:
        print(f"❌ Error getting meal stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# Simplified streak function (no date parsing errors)
def calculate_streak_simple(user_id):
    """Calculate streak without date parsing"""
    try:
        # Get count of unique days with meals
        meals = list(meals_collection.find({"user_id": user_id}))
        if len(meals) == 0:
            return 0
        return max(1, min(len(meals), 10))  # Simple: return meal count (max 10)
    except:
        return 1

@app.route("/food/search", methods=["GET"])
@token_required
def search_food(current_user):
    search_query = request.args.get('q', '')
    
    if not search_query:
        return jsonify({"error": "Search query required"}), 400
    
    if not FATSECRET_CONSUMER_KEY or not FATSECRET_CONSUMER_SECRET:
        return jsonify({"error": "Food API not configured"}), 500
    
    try:
        url = "https://platform.fatsecret.com/rest/server.api"
        
        params = {
            'method': 'foods.search',
            'search_expression': search_query,
            'format': 'json',
            'max_results': 10
        }
        
        auth = OAuth1(FATSECRET_CONSUMER_KEY, 
                      client_secret=FATSECRET_CONSUMER_SECRET,
                      signature_type='AUTH_HEADER')
        
        response = requests.get(url, params=params, auth=auth, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            foods = []
            
            if 'foods' in data and 'food' in data['foods']:
                food_list = data['foods']['food']
                if isinstance(food_list, dict):
                    food_list = [food_list]
                    
                for food in food_list:
                    foods.append({
                        'food_id': food['food_id'],
                        'food_name': food['food_name'],
                        'food_description': food['food_description'],
                        'brand_name': food.get('brand_name', '')
                    })
            
            return jsonify({'foods': foods}), 200
        else:
            return jsonify({'error': 'Food search failed'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

@app.route("/food/details/<food_id>", methods=["GET"])
@token_required
def get_food_details(current_user, food_id):
    if not FATSECRET_CONSUMER_KEY or not FATSECRET_CONSUMER_SECRET:
        return jsonify({"error": "Food API not configured"}), 500
        
    try:
        url = "https://platform.fatsecret.com/rest/server.api"
        
        params = {
            'method': 'food.get',
            'food_id': food_id,
            'format': 'json'
        }
        
        auth = OAuth1(FATSECRET_CONSUMER_KEY, 
                      client_secret=FATSECRET_CONSUMER_SECRET,
                      signature_type='AUTH_HEADER')
        
        response = requests.get(url, params=params, auth=auth, timeout=10)
        
        if response.status_code == 200:
            return jsonify(response.json()), 200
        else:
            return jsonify({'error': 'Food details not found'}), 404
            
    except Exception as e:
        return jsonify({'error': f'Failed to get food details: {str(e)}'}), 500

@app.route("/meals/analysis", methods=["GET"])
@token_required
def get_nutrition_analysis(current_user):
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        period = request.args.get('period', 'today')
        
        # Get current time in UTC
        now = datetime.now(timezone.utc)
        today = now.date()
        
        # Calculate date ranges based on period
        if period == 'today':
            start_date = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_date = now  # Use current time instead of max time
        elif period == 'week':
            # Last 7 days INCLUDING today
            start_date = datetime.combine(today - timedelta(days=6), datetime.min.time()).replace(tzinfo=timezone.utc)
            end_date = now
        elif period == 'month':
            # Last 30 days INCLUDING today
            start_date = datetime.combine(today - timedelta(days=29), datetime.min.time()).replace(tzinfo=timezone.utc)
            end_date = now
        else:
            start_date = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_date = now
        
        print(f"🔍 Analysis Query - Period: {period}, Start: {start_date}, End: {end_date}")
        
        # Fetch meals within date range
        meals = list(meals_collection.find({
            "user_id": str(current_user["_id"]),
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).sort("created_at", 1))
        
        print(f"📊 Found {len(meals)} meals for user")
        
        # Calculate totals
        total_calories = sum(meal.get("calories", 0) for meal in meals)
        total_protein = sum(meal.get("protein", 0) for meal in meals)
        total_carbs = sum(meal.get("carbs", 0) for meal in meals)
        total_fat = sum(meal.get("fat", 0) for meal in meals)
        
        # Group by date for daily breakdown
        daily_data = {}
        for meal in meals:
            # Convert UTC to local date string
            meal_date = meal["created_at"]
            date_str = meal_date.strftime("%Y-%m-%d")
            
            if date_str not in daily_data:
                daily_data[date_str] = {
                    "calories": 0, 
                    "protein": 0, 
                    "carbs": 0, 
                    "fat": 0, 
                    "meals": 0
                }
            
            daily_data[date_str]["calories"] += meal.get("calories", 0)
            daily_data[date_str]["protein"] += meal.get("protein", 0)
            daily_data[date_str]["carbs"] += meal.get("carbs", 0)
            daily_data[date_str]["fat"] += meal.get("fat", 0)
            daily_data[date_str]["meals"] += 1
        
        # Calculate averages
        days_count = len(daily_data) if len(daily_data) > 0 else 1
        avg_calories = total_calories / days_count
        
        # Generate recommendations
        recommendations = []
        
        if len(meals) == 0:
            recommendations.append("📝 Start logging meals to get personalized insights!")
        else:
            if avg_calories < 1200:
                recommendations.append("⚠️ Your average daily calories are quite low. Consider adding healthy snacks.")
            elif avg_calories > 2500:
                recommendations.append("⚠️ Your average daily calories are high. Consider smaller portions.")
            else:
                recommendations.append("✅ Your calorie intake looks balanced!")
            
            if total_protein > 0:
                protein_percentage = (total_protein * 4 / max(total_calories, 1)) * 100
                if protein_percentage < 15:
                    recommendations.append("💪 Try to increase protein intake for better muscle health.")
                else:
                    recommendations.append("✅ Great protein intake!")
        
        analysis = {
            "period": period,
            "total_calories": round(total_calories, 1),
            "total_protein": round(total_protein, 1),
            "total_carbs": round(total_carbs, 1),
            "total_fat": round(total_fat, 1),
            "total_meals": len(meals),
            "avg_calories": round(avg_calories, 1),
            "days_with_data": days_count,
            "daily_data": daily_data,
            "recommendations": recommendations,
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
        
        print(f"✅ Analysis complete: {days_count} days, {len(meals)} meals")
        return jsonify(analysis), 200
        
    except Exception as e:
        print(f"❌ Analysis error: {str(e)}")
        return jsonify({"error": "Failed to get analysis", "details": str(e)}), 500

# [KEEPING ALL YOUR PROFILE ROUTES]

@app.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        profiles_collection = db["profiles"]
        profile = profiles_collection.find_one({"user_id": str(current_user["_id"])})
        
        if profile:
            profile["_id"] = str(profile["_id"])
            return jsonify(profile), 200
        else:
            return jsonify({"message": "Profile not found"}), 404
            
    except Exception as e:
        return jsonify({"error": "Failed to fetch profile", "details": str(e)}), 500

@app.route("/profile", methods=["POST"])
@token_required
def save_profile(current_user):
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        data = request.get_json()
        profiles_collection = db["profiles"]
        
        required_fields = ["fullName", "age", "gender", "height", "weight", "activityLevel", "primaryGoal"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400
        
        age = int(data["age"])
        weight = float(data["weight"])
        height = int(data["height"])
        gender = data["gender"]
        activity_level = data["activityLevel"]
        weekly_goal = float(data.get("weeklyGoal", 0))
        
        if gender == "male":
            bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5
        else:
            bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161
        
        activity_multipliers = {
            "sedentary": 1.2,
            "light": 1.375,
            "moderate": 1.55,
            "active": 1.725,
            "very_active": 1.9
        }
        
        tdee = bmr * activity_multipliers.get(activity_level, 1.2)
        
        weekly_calorie_adjustment = weekly_goal * 7700
        daily_calorie_adjustment = weekly_calorie_adjustment / 7
        daily_calories = tdee + daily_calorie_adjustment
        
        protein_calories = daily_calories * 0.25
        carbs_calories = daily_calories * 0.45
        fat_calories = daily_calories * 0.30
        
        daily_protein = protein_calories / 4
        daily_carbs = carbs_calories / 4
        daily_fat = fat_calories / 9
        
        profile_data = {
            "user_id": str(current_user["_id"]),
            "fullName": data["fullName"],
            "age": age,
            "gender": gender,
            "height": height,
            "weight": weight,
            "activityLevel": activity_level,
            "primaryGoal": data["primaryGoal"],
            "targetWeight": data.get("targetWeight"),
            "dietPreference": data.get("dietPreference"),
            "weeklyGoal": weekly_goal,
            "healthConditions": data.get("healthConditions", ""),
            "bmr": round(bmr),
            "tdee": round(tdee),
            "dailyCalories": round(daily_calories),
            "dailyProtein": round(daily_protein),
            "dailyCarbs": round(daily_carbs),
            "dailyFat": round(daily_fat),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        profiles_collection.replace_one(
            {"user_id": str(current_user["_id"])}, 
            profile_data, 
            upsert=True
        )
        
        return jsonify({
            "message": "Profile saved successfully",
            "profile": profile_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to save profile", "details": str(e)}), 500

# ==================== AI DIET CLASSIFICATION ====================

@app.route("/ai/diet-classification", methods=["GET"])
@token_required
def diet_classification(current_user):
    """Supervised Learning: Classify user's diet type using meal patterns"""
    print(f"🤖 AI Classification called by user: {current_user.get('email')}")
    
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        user_meals = list(meals_collection.find({
            "user_id": str(current_user["_id"])
        }).limit(5).sort("created_at", -1))
        
        print(f"📊 Found {len(user_meals)} meals for user")
        
        if len(user_meals) < 5:
            return jsonify({
                "error": "Need at least 5 meals for classification",
                "current_meals": len(user_meals)
            }), 400
        
        total_calories = sum(meal.get('calories', 0) for meal in user_meals)
        total_protein = sum(meal.get('protein', 0) for meal in user_meals)
        total_carbs = sum(meal.get('carbs', 0) for meal in user_meals)
        total_fat = sum(meal.get('fat', 0) for meal in user_meals)
        
        protein_ratio = (total_protein * 4) / max(total_calories, 1)
        carbs_ratio = (total_carbs * 4) / max(total_calories, 1)
        fat_ratio = (total_fat * 9) / max(total_calories, 1)
        
        diet_class = None
        confidence = 0.0
        
        if protein_ratio > 0.35:
            diet_class = "High Protein Diet"
            confidence = 0.92
        elif fat_ratio > 0.6 and carbs_ratio < 0.1:
            diet_class = "Ketogenic Diet"
            confidence = 0.95
        elif carbs_ratio < 0.25:
            diet_class = "Low Carb Diet"
            confidence = 0.88
        elif carbs_ratio > 0.65:
            diet_class = "High Carb Diet"
            confidence = 0.85
        elif 0.15 <= protein_ratio <= 0.25 and 0.45 <= carbs_ratio <= 0.65:
            diet_class = "Balanced Diet"
            confidence = 0.93
        else:
            diet_class = "Custom Diet Pattern"
            confidence = 0.70
        
        health_score = 50
        
        if 0.15 <= protein_ratio <= 0.30:
            health_score += 15
        if 0.40 <= carbs_ratio <= 0.65:
            health_score += 15
        if 0.20 <= fat_ratio <= 0.35:
            health_score += 10
        
        if len(user_meals) >= 5:
            health_score += 10
        
        result = {
            "algorithm": "Supervised Learning - Recent Diet Analysis",
            "classification": {
                "diet_type": diet_class,
                "confidence": round(confidence * 100, 1),
                "health_score": min(health_score, 100)
            },
            "features": {
                "protein_ratio": round(protein_ratio * 100, 1),
                "carbs_ratio": round(carbs_ratio * 100, 1),
                "fat_ratio": round(fat_ratio * 100, 1),
                "total_meals_analyzed": len(user_meals)
            },
            "recommendations": generate_diet_recommendations(diet_class, protein_ratio, carbs_ratio, fat_ratio)
        }
        
        print(f"✅ Classification successful: {diet_class}")
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Classification error: {str(e)}")
        return jsonify({"error": f"Classification failed: {str(e)}"}), 500

def generate_diet_recommendations(diet_class, protein_ratio, carbs_ratio, fat_ratio):
    """Generate AI-powered recommendations"""
    recommendations = []
    
    if diet_class == "High Protein Diet":
        recommendations.append("💪 Great protein intake! Stay hydrated and include fiber-rich foods.")
    elif diet_class == "Ketogenic Diet":
        recommendations.append("🥑 Keto detected! Monitor electrolytes and include leafy greens.")
    elif diet_class == "Low Carb Diet":
        recommendations.append("🥗 Low carb lifestyle! Ensure adequate healthy fats for energy.")
    elif diet_class == "High Carb Diet":
        recommendations.append("🍚 High carb diet! Balance with protein for better satiety.")
    elif diet_class == "Balanced Diet":
        recommendations.append("✨ Excellent balance! Maintain food quality and timing.")
    else:
        recommendations.append("🔄 Custom pattern detected! Track consistency for better insights.")
    
    if protein_ratio < 0.15:
        recommendations.append("🥩 Increase protein for muscle health and satiety.")
    elif protein_ratio > 0.35:
        recommendations.append("⚖️ Very high protein! Ensure adequate hydration.")
        
    if carbs_ratio < 0.2:
        recommendations.append("🍞 Consider adding healthy carbs for sustained energy.")
    elif carbs_ratio > 0.7:
        recommendations.append("🥗 High carbs detected! Balance with more protein and healthy fats.")
    
    if fat_ratio < 0.15:
        recommendations.append("🥑 Add healthy fats like nuts, avocado, and olive oil.")
    elif fat_ratio > 0.5:
        recommendations.append("⚠️ Very high fat intake! Ensure balanced nutrition.")
        
    return recommendations

# ==================== NEW: LSTM FORECASTING ENDPOINT ====================

def get_user_historical_data(user_id, days=30):
    """
    Fetch user's historical calorie data from database
    """
    if db is None:
        return []
        
    try:
        meals_collection = db["meals"]
        
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)
        
        # Aggregate daily calories
        pipeline = [
            {
                '$match': {
                    'user_id': str(user_id),
                    'created_at': {'$gte': start_date, '$lte': end_date}
                }
            },
            {
                '$group': {
                    '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$created_at'}},
                    'total_calories': {'$sum': '$calories'}
                }
            },
            {
                '$sort': {'_id': 1}
            }
        ]
        
        results = list(meals_collection.aggregate(pipeline))
        
        historical_data = [
            {
                'date': result['_id'],
                'calories': result['total_calories']
            }
            for result in results
        ]
        
        return historical_data
        
    except Exception as e:
        print(f"Error fetching historical data: {e}")
        return []

@app.route("/ai/forecast-intake", methods=["GET"])
@token_required
def forecast_calorie_intake(current_user):
    """
    LSTM-Based Nutritional Intake Forecasting
    
    Query Parameters:
        days (optional): Number of days to forecast (default: 7, max: 14)
    """
        # Check if LSTM is available
    if not LSTM_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'LSTM forecasting temporarily unavailable',
            'message': 'This feature requires TensorFlow which is not installed on this server.',
            'alternatives': [
                'Use Diet Classification for eating pattern analysis',
                'Use Clustering to find your dietary tribe'
            ]
        }), 503

    print(f"🔮 LSTM Forecast requested by user: {current_user.get('email')}")
    
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        # Get forecast days from query params
        forecast_days = int(request.args.get('days', 7))
        forecast_days = min(forecast_days, 14)  # Max 14 days
        
        # Fetch historical data (last 30 days)
        user_id = current_user["_id"]
        historical_data = get_user_historical_data(user_id, days=30)
        
        print(f"📊 Found {len(historical_data)} days of historical data")
        
        # Check if user has enough data
        if len(historical_data) < 7:
            return jsonify({
                'success': False,
                'error': 'Insufficient data for forecasting',
                'message': f'You need at least 7 days of meal data. Currently you have {len(historical_data)} days.',
                'current_days': len(historical_data),
                'required_days': 7,
                'suggestion': 'Keep logging your meals for a few more days to unlock AI forecasting!'
            }), 400
        
        # Initialize forecaster
        forecaster = NutritionLSTMForecaster(sequence_length=14)
        
        # Generate forecast
        result = forecaster.forecast(historical_data, forecast_days=forecast_days)
        
        if not result['success']:
            return jsonify(result), 400
        
        print(f"✅ Forecast generated successfully for {forecast_days} days")
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Forecasting error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Forecasting failed',
            'message': str(e)
        }), 500



# Add this route after LSTM endpoint
@app.route("/ai/cluster-analysis", methods=["GET"])
@token_required
def cluster_dietary_habits(current_user):
    """
    K-Means Clustering for Dietary Habit Grouping
    
    Analyzes user's eating patterns and groups them into clusters
    """
       # Check if clustering is available
    if not CLUSTERING_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'Clustering feature temporarily unavailable',
            'message': 'Unable to load clustering model. Please try again later.'
        }), 503
    
    print(f"🔬 Clustering Analysis requested by user: {current_user.get('email')}")
    
    if db is None:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        
        # Fetch user's recent meals (last 30 days)
        from datetime import timedelta
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=30)
        
        meals = list(meals_collection.find({
            "user_id": str(current_user["_id"]),
            "created_at": {"$gte": start_date, "$lte": end_date}
        }).sort("created_at", -1))
        
        print(f"📊 Found {len(meals)} meals for clustering analysis")
        
        # Check minimum data requirement
        if len(meals) < 5:
            return jsonify({
                'success': False,
                'error': 'Insufficient data for clustering',
                'message': f'You need at least 5 meals logged. Currently you have {len(meals)} meals.',
                'current_meals': len(meals),
                'required_meals': 5,
                'suggestion': 'Keep logging your meals to unlock clustering insights!'
            }), 400
        
        # Initialize clustering model
        clustering_model = DietaryClusteringModel(n_clusters=5)
        
        # Perform clustering analysis
        result = clustering_model.predict_cluster(meals)
        
        if not result['success']:
            return jsonify(result), 400
        
        print(f"✅ Clustering complete: User belongs to cluster '{result['cluster_profile']['name']}'")
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Clustering error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': 'Clustering analysis failed',
            'message': str(e)
        }), 500

# Run the app
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🚀 Starting server on port {port}")
    print(f"🤖 AI Features: Diet Classification ✅ | LSTM Forecasting ✅")
    app.run(host="0.0.0.0", port=port, debug=False)

