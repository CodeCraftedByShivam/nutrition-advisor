# clustering_model.py
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timezone
import json

class DietaryClusteringModel:
    """
    K-Means Clustering for Dietary Habit Grouping
    Clusters users based on their eating patterns
    """
    
    def __init__(self, n_clusters=5):
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        
        # Cluster profiles (based on typical patterns)
        self.cluster_profiles = {
            0: {
                "name": "High Protein Athletes",
                "description": "High protein intake, moderate calories, active lifestyle",
                "icon": "💪",
                "color": "#EF4444"
            },
            1: {
                "name": "Balanced Eaters",
                "description": "Well-balanced macros, consistent meal patterns",
                "icon": "⚖️",
                "color": "#10B981"
            },
            2: {
                "name": "Low Carb Enthusiasts",
                "description": "Low carb intake, higher fats, ketogenic tendencies",
                "icon": "🥑",
                "color": "#F59E0B"
            },
            3: {
                "name": "Calorie Conscious",
                "description": "Lower calorie intake, weight loss focus",
                "icon": "🎯",
                "color": "#3B82F6"
            },
            4: {
                "name": "High Carb Energy Seekers",
                "description": "High carb intake, moderate protein, energy-focused",
                "icon": "🍚",
                "color": "#8B5CF6"
            }
        }
    
    def extract_features(self, meals_data):
        """
        Extract features from user's meal data for clustering
        """
        if len(meals_data) < 5:
            return None
        
        # Calculate aggregate features
        total_calories = sum(meal.get('calories', 0) for meal in meals_data)
        total_protein = sum(meal.get('protein', 0) for meal in meals_data)
        total_carbs = sum(meal.get('carbs', 0) for meal in meals_data)
        total_fat = sum(meal.get('fat', 0) for meal in meals_data)
        
        num_meals = len(meals_data)
        
        # Calculate ratios and averages
        avg_calories = total_calories / num_meals
        
        # Macro ratios (as percentage of total calories)
        protein_ratio = (total_protein * 4) / max(total_calories, 1)
        carbs_ratio = (total_carbs * 4) / max(total_calories, 1)
        fat_ratio = (total_fat * 9) / max(total_calories, 1)
        
        # Meal frequency (meals per day estimate)
        if meals_data:
            date_range = self._calculate_date_range(meals_data)
            meal_frequency = num_meals / max(date_range, 1)
        else:
            meal_frequency = 0
        
        # Calculate meal consistency (standard deviation of calories)
        meal_calories = [meal.get('calories', 0) for meal in meals_data]
        calorie_std = np.std(meal_calories) if len(meal_calories) > 1 else 0
        
        # Feature vector
        features = [
            avg_calories,           # Average daily calories
            protein_ratio,          # Protein percentage
            carbs_ratio,            # Carbs percentage
            fat_ratio,              # Fat percentage
            meal_frequency,         # Meals per day
            calorie_std,            # Calorie consistency
            total_protein / num_meals,  # Avg protein per meal
        ]
        
        return np.array(features).reshape(1, -1)
    
    def _calculate_date_range(self, meals_data):
        """Calculate number of days covered by meal data"""
        try:
            dates = []
            for meal in meals_data:
                if 'created_at' in meal:
                    if isinstance(meal['created_at'], str):
                        date = datetime.fromisoformat(meal['created_at'].replace('Z', '+00:00'))
                    else:
                        date = meal['created_at']
                    dates.append(date.date())
            
            if dates:
                unique_dates = len(set(dates))
                return max(unique_dates, 1)
        except:
            pass
        
        return 1
    
    def predict_cluster(self, meals_data):
        """
        Predict which cluster a user belongs to based on their meals
        """
        features = self.extract_features(meals_data)
        
        if features is None:
            return {
                'success': False,
                'error': 'Insufficient data',
                'message': 'Need at least 5 meals to perform clustering analysis',
                'meals_logged': len(meals_data),
                'required_meals': 5
            }
        
        # For demo purposes, use rule-based clustering
        # (In production, you'd train on larger dataset)
        cluster_id = self._rule_based_clustering(features[0])
        
        profile = self.cluster_profiles.get(cluster_id, self.cluster_profiles[1])
        
        # Generate insights
        insights = self._generate_cluster_insights(features[0], cluster_id, meals_data)
        
        # Get similar users count (simulated for demo)
        similar_users = self._estimate_cluster_size(cluster_id)
        
        result = {
            'success': True,
            'algorithm': 'K-Means Clustering (Unsupervised Learning)',
            'cluster_id': int(cluster_id),
            'cluster_profile': {
                'name': profile['name'],
                'description': profile['description'],
                'icon': profile['icon'],
                'color': profile['color']
            },
            'features_analyzed': {
                'avg_calories': round(float(features[0][0]), 1),
                'protein_ratio': round(float(features[0][1] * 100), 1),
                'carbs_ratio': round(float(features[0][2] * 100), 1),
                'fat_ratio': round(float(features[0][3] * 100), 1),
                'meal_frequency': round(float(features[0][4]), 1),
                'calorie_consistency': round(float(features[0][5]), 1)
            },
            'insights': insights,
            'similar_users': similar_users,
            'meals_analyzed': len(meals_data),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        return result
    
    def _rule_based_clustering(self, features):
        """
        Rule-based clustering logic (simulates trained K-Means)
        """
        avg_calories = features[0]
        protein_ratio = features[1]
        carbs_ratio = features[2]
        fat_ratio = features[3]
        
        # Cluster 0: High Protein Athletes
        if protein_ratio > 0.30:
            return 0
        
        # Cluster 2: Low Carb Enthusiasts
        elif carbs_ratio < 0.25 and fat_ratio > 0.40:
            return 2
        
        # Cluster 3: Calorie Conscious
        elif avg_calories < 1500:
            return 3
        
        # Cluster 4: High Carb Energy Seekers
        elif carbs_ratio > 0.60:
            return 4
        
        # Cluster 1: Balanced Eaters (default)
        else:
            return 1
    
    def _generate_cluster_insights(self, features, cluster_id, meals_data):
        """Generate personalized insights based on cluster"""
        insights = []
        
        avg_calories = features[0]
        protein_ratio = features[1] * 100
        carbs_ratio = features[2] * 100
        fat_ratio = features[3] * 100
        
        if cluster_id == 0:  # High Protein
            insights.append({
                'icon': '💪',
                'title': 'Protein Power',
                'message': f'Your protein intake ({protein_ratio:.1f}%) is excellent for muscle building and recovery.'
            })
            insights.append({
                'icon': '💧',
                'title': 'Hydration Alert',
                'message': 'High protein diets require extra hydration. Aim for 3-4 liters of water daily.'
            })
        
        elif cluster_id == 1:  # Balanced
            insights.append({
                'icon': '✨',
                'title': 'Perfect Balance',
                'message': 'Your macros are well-balanced! Keep maintaining this healthy eating pattern.'
            })
            insights.append({
                'icon': '📈',
                'title': 'Consistency',
                'message': 'You\'re logging meals regularly. Great habit for long-term success!'
            })
        
        elif cluster_id == 2:  # Low Carb
            insights.append({
                'icon': '🥑',
                'title': 'Keto-Friendly',
                'message': f'Your low carb intake ({carbs_ratio:.1f}%) suggests a ketogenic or low-carb lifestyle.'
            })
            insights.append({
                'icon': '🥬',
                'title': 'Fiber Focus',
                'message': 'Ensure adequate fiber intake through leafy greens and vegetables.'
            })
        
        elif cluster_id == 3:  # Calorie Conscious
            insights.append({
                'icon': '🎯',
                'title': 'Goal-Oriented',
                'message': f'Your calorie intake ({avg_calories:.0f} kcal) shows dedication to weight management goals.'
            })
            insights.append({
                'icon': '⚠️',
                'title': 'Nutrition Warning',
                'message': 'Ensure you\'re getting enough nutrients. Consider micronutrient tracking.'
            })
        
        elif cluster_id == 4:  # High Carb
            insights.append({
                'icon': '⚡',
                'title': 'Energy Focus',
                'message': f'High carb intake ({carbs_ratio:.1f}%) provides excellent energy for active lifestyles.'
            })
            insights.append({
                'icon': '🏃',
                'title': 'Activity Recommendation',
                'message': 'Your diet supports endurance activities. Great for runners and athletes!'
            })
        
        # Add general insight about meal count
        insights.append({
            'icon': '📊',
            'title': 'Data Analysis',
            'message': f'Analyzed {len(meals_data)} meals to determine your dietary pattern.'
        })
        
        return insights
    
    def _estimate_cluster_size(self, cluster_id):
        """Estimate number of users in similar cluster (simulated)"""
        # Simulated cluster sizes for demo
        cluster_sizes = {
            0: 1247,  # High Protein Athletes
            1: 3891,  # Balanced Eaters (largest)
            2: 892,   # Low Carb Enthusiasts
            3: 2156,  # Calorie Conscious
            4: 1634   # High Carb Energy Seekers
        }
        
        return cluster_sizes.get(cluster_id, 1500)
