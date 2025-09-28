from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt
import os
from dotenv import load_dotenv
import jwt
from functools import wraps
from datetime import datetime, timedelta, timezone
import certifi
from flask_cors import CORS
import requests
from requests_oauthlib import OAuth1
import urllib.parse

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Secret key (better to keep in .env)
SECRET_KEY = os.getenv("SECRET_KEY", "your_super_secret_key")

# MongoDB connection string from .env
MONGO_URI = os.getenv("MONGO_URI")

# FatSecret API Configuration
FATSECRET_CONSUMER_KEY = "2b11373a2a91447c8641b776788d2080"
FATSECRET_CONSUMER_SECRET = "87ae6c68b73d4169a0a54a35b2b2c141"

# Use certifi to fix SSL handshake issue
client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
db = client["nutrition_advisor_db"]
users_collection = db["users"]

# ---------------- JWT Decorator ---------------- #
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header[len("Bearer "):]

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = users_collection.find_one({"_id": ObjectId(data["user_id"])})
            if not current_user:
                return jsonify({"error": "User not found!"}), 401
            kwargs["current_user"] = current_user
        except Exception as e:
            return jsonify({"error": "Token is invalid or expired", "details": str(e)}), 401

        return f(*args, **kwargs)
    return decorated

# ---------------- Routes ---------------- #
@app.route("/")
def home():
    return jsonify({"message": "API is running"})

@app.route("/ping")
def ping():
    return jsonify({"message": "pong"})

# ---------------- Auth Routes ---------------- #
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
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
        "password": hashed_pw
    }

    user_id = users_collection.insert_one(user).inserted_id

    return jsonify({"message": "User registered successfully", "user_id": str(user_id)}), 201

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if "email" not in data or "password" not in data:
        return jsonify({"error": "Email and password required"}), 400

    try:
        user = users_collection.find_one({"email": data["email"]})
    except Exception as e:
        return jsonify({"error": "Database connection failed", "details": str(e)}), 500

    if user and bcrypt.checkpw(data["password"].encode("utf-8"), user["password"]):
        token = jwt.encode({
            "user_id": str(user["_id"]),
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }, SECRET_KEY, algorithm="HS256")
        return jsonify({"message": "Login successful", "token": token}), 200
    else:
        return jsonify({"error": "Invalid email or password"}), 401

# ---------------- User CRUD ---------------- #
@app.route("/user/create", methods=["POST"])
@token_required
def create_user(current_user):
    data = request.get_json()
    required_fields = ["name", "age", "weight", "health_conditions", "activity_level"]

    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    user_id = users_collection.insert_one(data).inserted_id
    data["_id"] = str(user_id)

    return jsonify({"message": "User profile created", "data": data}), 201

@app.route("/users", methods=["GET"])
@token_required
def get_all_users(current_user):
    users_cursor = users_collection.find()
    users = []
    for user in users_cursor:
        user["_id"] = str(user["_id"])
        if "password" in user:
            del user["password"]
        users.append(user)
    return jsonify(users), 200

@app.route("/user/<id>", methods=["GET"])
@token_required
def get_user(id, current_user):
    try:
        user = users_collection.find_one({"_id": ObjectId(id)})
        if user:
            user["_id"] = str(user["_id"])
            if "password" in user:
                del user["password"]
            return jsonify(user), 200
        else:
            return jsonify({"error": "User not found"}), 404
    except:
        return jsonify({"error": "Invalid user ID"}), 400

@app.route("/user/update/<id>", methods=["PUT"])
@token_required
def update_user(id, current_user):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
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
        return jsonify({"error": "Invalid user ID or update failed", "details": str(e)}), 400

@app.route("/user/delete/<id>", methods=["DELETE"])
@token_required
def delete_user(id, current_user):
    try:
        user_id = ObjectId(id)
        result = users_collection.delete_one({"_id": user_id})

        if result.deleted_count == 0:
            return jsonify({"error": "User not found"}), 404

        return jsonify({"message": "User deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": "Invalid user ID or delete failed", "details": str(e)}), 400

# ---------------- Meal Routes ---------------- #
@app.route("/meal/add", methods=["POST"])
@token_required
def add_meal(current_user):
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
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc)
    }
    
    # Create meals collection if it doesn't exist
    meals_collection = db["meals"]
    meal_id = meals_collection.insert_one(meal).inserted_id
    meal["_id"] = str(meal_id)
    
    return jsonify({"message": "Meal added successfully", "meal": meal}), 201

@app.route("/meals", methods=["GET"])
@token_required
def get_user_meals(current_user):
    meals_collection = db["meals"]
    
    # Get date filter from query params (optional)
    date_filter = request.args.get('date')  # Format: YYYY-MM-DD
    
    query = {"user_id": str(current_user["_id"])}
    
    if date_filter:
        # Filter meals for specific date
        start_date = datetime.fromisoformat(date_filter + "T00:00:00+00:00")
        end_date = datetime.fromisoformat(date_filter + "T23:59:59+00:00")
        query["created_at"] = {"$gte": start_date, "$lte": end_date}
    
    meals = list(meals_collection.find(query).sort("created_at", -1))
    
    # Convert ObjectId to string
    for meal in meals:
        meal["_id"] = str(meal["_id"])
        meal["created_at"] = meal["created_at"].isoformat()
    
    return jsonify(meals), 200

@app.route("/meal/delete/<meal_id>", methods=["DELETE"])
@token_required
def delete_meal(meal_id, current_user):
    meals_collection = db["meals"]
    
    try:
        result = meals_collection.delete_one({
            "_id": ObjectId(meal_id),
            "user_id": str(current_user["_id"])
        })
        
        if result.deleted_count == 0:
            return jsonify({"error": "Meal not found"}), 404
            
        return jsonify({"message": "Meal deleted successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": "Invalid meal ID", "details": str(e)}), 400

@app.route("/meals/stats", methods=["GET"])
@token_required
def get_meal_stats(current_user):
    meals_collection = db["meals"]
    
    # Get today's date
    today = datetime.now(timezone.utc).date()
    start_date = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_date = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    # Get today's meals
    today_meals = list(meals_collection.find({
        "user_id": str(current_user["_id"]),
        "created_at": {"$gte": start_date, "$lte": end_date}
    }))
    
    # Calculate stats
    total_calories = sum(meal.get("calories", 0) for meal in today_meals)
    total_protein = sum(meal.get("protein", 0) for meal in today_meals)
    total_carbs = sum(meal.get("carbs", 0) for meal in today_meals)
    total_fat = sum(meal.get("fat", 0) for meal in today_meals)
    meals_count = len(today_meals)
    
    # Calculate goal progress (assuming 2000 calorie goal)
    goal_calories = 2000
    goal_progress = min(round((total_calories / goal_calories) * 100), 100) if goal_calories > 0 else 0
    
    stats = {
        "total_calories": total_calories,
        "total_protein": total_protein,
        "total_carbs": total_carbs,
        "total_fat": total_fat,
        "meals_count": meals_count,
        "goal_progress": goal_progress,
        "streak": 1  # Placeholder - can be calculated based on user activity
    }
    
    return jsonify(stats), 200

# ---------------- Food Search Routes ---------------- #
@app.route("/food/search", methods=["GET"])
@token_required
def search_food(current_user):
    search_query = request.args.get('q', '')
    
    if not search_query:
        return jsonify({"error": "Search query required"}), 400
    
    # FatSecret API call
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
    
    try:
        response = requests.get(url, params=params, auth=auth)
        
        if response.status_code == 200:
            data = response.json()
            
            # Format the response for our frontend
            foods = []
            if 'foods' in data and 'food' in data['foods']:
                food_list = data['foods']['food']
                # Handle both single food item and list of foods
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
        return jsonify({'error': str(e)}), 500

@app.route("/food/details/<food_id>", methods=["GET"])
@token_required
def get_food_details(food_id, current_user):
    url = "https://platform.fatsecret.com/rest/server.api"
    
    params = {
        'method': 'food.get',
        'food_id': food_id,
        'format': 'json'
    }
    
    auth = OAuth1(FATSECRET_CONSUMER_KEY, 
                  client_secret=FATSECRET_CONSUMER_SECRET,
                  signature_type='AUTH_HEADER')
    
    try:
        response = requests.get(url, params=params, auth=auth)
        
        if response.status_code == 200:
            return jsonify(response.json()), 200
        else:
            return jsonify({'error': 'Food details not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/meals/analysis", methods=["GET"])
@token_required
def get_nutrition_analysis(current_user):
    meals_collection = db["meals"]
    period = request.args.get('period', 'today')  # today, week, month
    
    # Calculate date range based on period
    today = datetime.now(timezone.utc).date()
    
    if period == 'today':
        start_date = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    elif period == 'week':
        start_date = datetime.combine(today - timedelta(days=7), datetime.min.time()).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    elif period == 'month':
        start_date = datetime.combine(today - timedelta(days=30), datetime.min.time()).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    # Get meals for the period
    meals = list(meals_collection.find({
        "user_id": str(current_user["_id"]),
        "created_at": {"$gte": start_date, "$lte": end_date}
    }).sort("created_at", 1))
    
    # Calculate totals
    total_calories = sum(meal.get("calories", 0) for meal in meals)
    total_protein = sum(meal.get("protein", 0) for meal in meals)
    total_carbs = sum(meal.get("carbs", 0) for meal in meals)
    total_fat = sum(meal.get("fat", 0) for meal in meals)
    
    # Calculate daily breakdown for charts
    daily_data = {}
    for meal in meals:
        date = meal["created_at"].strftime("%Y-%m-%d")
        if date not in daily_data:
            daily_data[date] = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "meals": 0}
        
        daily_data[date]["calories"] += meal.get("calories", 0)
        daily_data[date]["protein"] += meal.get("protein", 0)
        daily_data[date]["carbs"] += meal.get("carbs", 0)
        daily_data[date]["fat"] += meal.get("fat", 0)
        daily_data[date]["meals"] += 1
    
    # Calculate recommendations
    recommendations = []
    
    days_count = max(len(daily_data), 1)
    avg_calories = total_calories / days_count
    
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
    
    if len(meals) == 0:
        recommendations.append("📝 Start logging meals to get personalized insights!")
    
    analysis = {
        "period": period,
        "total_calories": total_calories,
        "total_protein": total_protein,
        "total_carbs": total_carbs,
        "total_fat": total_fat,
        "total_meals": len(meals),
        "avg_calories": round(avg_calories, 1),
        "daily_data": daily_data,
        "recommendations": recommendations
    }
    
    return jsonify(analysis), 200

# ---------------- Profile Routes ---------------- #
@app.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    profiles_collection = db["profiles"]
    
    profile = profiles_collection.find_one({"user_id": str(current_user["_id"])})
    
    if profile:
        profile["_id"] = str(profile["_id"])
        return jsonify(profile), 200
    else:
        return jsonify({"message": "Profile not found"}), 404

@app.route("/profile", methods=["POST"])
@token_required
def save_profile(current_user):
    data = request.get_json()
    profiles_collection = db["profiles"]
    
    # Validate required fields
    required_fields = ["fullName", "age", "gender", "height", "weight", "activityLevel", "primaryGoal"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400
    
    # Calculate BMR and daily calorie needs
    age = int(data["age"])
    weight = float(data["weight"])
    height = int(data["height"])
    gender = data["gender"]
    activity_level = data["activityLevel"]
    primary_goal = data["primaryGoal"]
    weekly_goal = float(data.get("weeklyGoal", 0))
    
    # Mifflin-St Jeor Equation for BMR
    if gender == "male":
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5
    else:
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161
    
    # Activity multipliers
    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    
    # Calculate TDEE (Total Daily Energy Expenditure)
    tdee = bmr * activity_multipliers.get(activity_level, 1.2)
    
    # Adjust for weight goal (1 kg = 7700 calories)
    weekly_calorie_adjustment = weekly_goal * 7700
    daily_calorie_adjustment = weekly_calorie_adjustment / 7
    daily_calories = tdee + daily_calorie_adjustment
    
    # Calculate macronutrient goals (general recommendations)
    protein_calories = daily_calories * 0.25  # 25% protein
    carbs_calories = daily_calories * 0.45    # 45% carbs
    fat_calories = daily_calories * 0.30      # 30% fat
    
    daily_protein = protein_calories / 4      # 4 calories per gram
    daily_carbs = carbs_calories / 4          # 4 calories per gram
    daily_fat = fat_calories / 9              # 9 calories per gram
    
    profile_data = {
        "user_id": str(current_user["_id"]),
        "fullName": data["fullName"],
        "age": age,
        "gender": gender,
        "height": height,
        "weight": weight,
        "activityLevel": activity_level,
        "primaryGoal": primary_goal,
        "targetWeight": data.get("targetWeight"),
        "dietPreference": data.get("dietPreference"),
        "weeklyGoal": weekly_goal,
        "healthConditions": data.get("healthConditions", ""),
        
        # Calculated goals
        "bmr": round(bmr),
        "tdee": round(tdee),
        "dailyCalories": round(daily_calories),
        "dailyProtein": round(daily_protein),
        "dailyCarbs": round(daily_carbs),
        "dailyFat": round(daily_fat),
        
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Upsert profile (update if exists, create if not)
    profiles_collection.replace_one(
        {"user_id": str(current_user["_id"])}, 
        profile_data, 
        upsert=True
    )
    
    return jsonify({
        "message": "Profile saved successfully",
        "profile": profile_data
    }), 200



# ---------------- Run App ---------------- #
if __name__ == "__main__":
    app.run(debug=True)
