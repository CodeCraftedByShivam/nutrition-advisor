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

# Flask app
app = Flask(__name__)
CORS(app)

# Environment variables (no load_dotenv for Vercel)
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_key_for_development")
MONGO_URI = os.getenv("MONGO_URI", "")
FATSECRET_CONSUMER_KEY = os.getenv("FATSECRET_CONSUMER_KEY", "")
FATSECRET_CONSUMER_SECRET = os.getenv("FATSECRET_CONSUMER_SECRET", "")

# Initialize MongoDB only if URI is available
client = None
db = None
users_collection = None

try:
    if MONGO_URI:
        client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
        db = client["nutrition_advisor_db"]
        users_collection = db["users"]
except Exception as e:
    print(f"MongoDB connection error: {e}")

# JWT Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not users_collection:
            return jsonify({"error": "Database not available"}), 500
            
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

# Routes
@app.route("/")
def home():
    return jsonify({
        "message": "API is running", 
        "status": "healthy",
        "database": "connected" if users_collection else "not connected",
        "environment": {
            "SECRET_KEY": bool(SECRET_KEY),
            "MONGO_URI": bool(MONGO_URI),
            "FATSECRET_KEY": bool(FATSECRET_CONSUMER_KEY)
        }
    })

@app.route("/ping")
def ping():
    return jsonify({"message": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})

# Auth Routes
@app.route("/register", methods=["POST"])
def register():
    if not users_collection:
        return jsonify({"error": "Database not available"}), 500
        
    try:
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
            "password": hashed_pw,
            "created_at": datetime.now(timezone.utc)
        }

        user_id = users_collection.insert_one(user).inserted_id
        return jsonify({"message": "User registered successfully", "user_id": str(user_id)}), 201
        
    except Exception as e:
        return jsonify({"error": "Registration failed", "details": str(e)}), 500

@app.route("/login", methods=["POST"])
def login():
    if not users_collection:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        data = request.get_json()
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

# Meal Routes
@app.route("/meal/add", methods=["POST"])
@token_required
def add_meal(current_user):
    if not db:
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
            "date": datetime.now(timezone.utc).isoformat(),
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
    if not db:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        date_filter = request.args.get('date')
        
        query = {"user_id": str(current_user["_id"])}
        
        if date_filter:
            start_date = datetime.fromisoformat(date_filter + "T00:00:00+00:00")
            end_date = datetime.fromisoformat(date_filter + "T23:59:59+00:00")
            query["created_at"] = {"$gte": start_date, "$lte": end_date}
        
        meals = list(meals_collection.find(query).sort("created_at", -1))
        
        for meal in meals:
            meal["_id"] = str(meal["_id"])
            meal["created_at"] = meal["created_at"].isoformat()
        
        return jsonify(meals), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch meals", "details": str(e)}), 500

@app.route("/meals/stats", methods=["GET"])
@token_required
def get_meal_stats(current_user):
    if not db:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        meals_collection = db["meals"]
        today = datetime.now(timezone.utc).date()
        start_date = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_date = datetime.combine(today, datetime.max.time()).replace(tzinfo=timezone.utc)
        
        today_meals = list(meals_collection.find({
            "user_id": str(current_user["_id"]),
            "created_at": {"$gte": start_date, "$lte": end_date}
        }))
        
        total_calories = sum(meal.get("calories", 0) for meal in today_meals)
        total_protein = sum(meal.get("protein", 0) for meal in today_meals)
        total_carbs = sum(meal.get("carbs", 0) for meal in today_meals)
        total_fat = sum(meal.get("fat", 0) for meal in today_meals)
        meals_count = len(today_meals)
        
        goal_calories = 2000
        goal_progress = min(round((total_calories / goal_calories) * 100), 100) if goal_calories > 0 else 0
        
        stats = {
            "total_calories": total_calories,
            "total_protein": total_protein,
            "total_carbs": total_carbs,
            "total_fat": total_fat,
            "meals_count": meals_count,
            "goal_progress": goal_progress,
            "streak": 1
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch stats", "details": str(e)}), 500

# Food Search Routes
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

# Profile Routes
@app.route("/profile", methods=["GET"])
@token_required
def get_profile(current_user):
    if not db:
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
    if not db:
        return jsonify({"error": "Database not available"}), 500
        
    try:
        data = request.get_json()
        profiles_collection = db["profiles"]
        
        required_fields = ["fullName", "age", "gender", "height", "weight", "activityLevel", "primaryGoal"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400
        
        # Calculate BMR and goals
        age = int(data["age"])
        weight = float(data["weight"])
        height = int(data["height"])
        gender = data["gender"]
        
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
        
        tdee = bmr * activity_multipliers.get(data["activityLevel"], 1.2)
        
        profile_data = {
            "user_id": str(current_user["_id"]),
            "fullName": data["fullName"],
            "age": age,
            "gender": gender,
            "height": height,
            "weight": weight,
            "activityLevel": data["activityLevel"],
            "primaryGoal": data["primaryGoal"],
            "bmr": round(bmr),
            "tdee": round(tdee),
            "dailyCalories": round(tdee),
            "dailyProtein": round(tdee * 0.25 / 4),
            "dailyCarbs": round(tdee * 0.45 / 4),
            "dailyFat": round(tdee * 0.30 / 9),
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

# Vercel handler
if __name__ == "__main__":
    app.run(debug=True)
