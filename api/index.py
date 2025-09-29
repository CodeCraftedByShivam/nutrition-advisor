from flask import Flask, request, jsonify
app = Flask(__name__)

@app.route('/')
def home():
    return {'message': 'API is working!', 'status': 'healthy'}

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    return {
        'message': 'Login successful',
        'token': 'test_token_12345',
        'user': {
            'id': 'test_user_id',
            'name': 'Test User',
            'email': data.get('email', 'test@example.com')
        }
    }

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    return {
        'message': 'User registered successfully',
        'user_id': 'test_user_id_123'
    }

if __name__ == '__main__':
    app.run()
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
