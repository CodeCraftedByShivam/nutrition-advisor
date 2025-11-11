# 🥗 NutriAI - AI-Powered Nutrition Advisor

<div align="center">

![NutriAI](https://img.shields.io/badge/NutriAI-Nutrition%20Tracking-brightgreen?style=for-the-badge)
[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-black?style=flat-square&logo=flask)](https://flask.palletsprojects.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Live](https://img.shields.io/badge/Status-Live-success?style=flat-square)](https://nutrition-advisor-frontend.onrender.com)

**AI-powered nutrition tracking platform with machine learning insights**

[Live Demo](https://nutrition-advisor-frontend.onrender.com) • [API Docs](#api-documentation) • [Report Bug](https://github.com/yourusername/nutrition-advisor/issues)

</div>

---

## 📋 Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Machine Learning Models](#machine-learning-models)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## 🎯 About

**NutriAI** is a full-stack nutrition tracking platform with AI-powered dietary insights. Track meals, monitor macros, analyze eating patterns, and receive personalized recommendations using machine learning.

### Key Highlights
- 🔐 JWT-based authentication
- 📊 Real-time dashboard with stats
- 🤖 ML-powered diet classification & clustering
- 🍔 650K+ food database (FatSecret API)
- 📱 Responsive design
- ☁️ Cloud deployed (Render)

---

## ✨ Features

### Core
- ✅ User registration & authentication
- ✅ Meal logging with nutrition calculations
- ✅ Calorie & macro tracking
- ✅ Goal setting & progress monitoring
- ✅ Consecutive day streak tracking
- ✅ Comprehensive food search

### AI/ML
- 🧠 **Diet Classification** - Keto, High-Protein, Balanced, etc.
- 📈 **K-Means Clustering** - Group users by dietary habits
- 🔮 **LSTM Forecasting** - Predict calorie intake

### Analytics
- 📊 Daily/Weekly/Monthly analysis
- 🎯 Goal progress tracking
- 🔥 Streak monitoring
- 📉 Historical visualization

---

## 🛠️ Tech Stack

**Backend**
- Flask 3.0 (Python 3.11)
- MongoDB Atlas
- JWT authentication
- scikit-learn, NumPy, pandas
- FatSecret API
- Gunicorn + Render

**Frontend**
- HTML5, CSS3, Vanilla JS
- Chart.js visualization
- Responsive design
- Render deployment

---

## 🏗️ Architecture


---

## 🤖 Machine Learning Models

### 1. Diet Classification
**Algorithm:** Rule-based with macro ratios

**Features:**
- Protein/Carbs/Fat ratios
- Meal frequency

**Classifications:**
- High Protein (>35% protein)
- Ketogenic (>60% fat, <10% carbs)
- Low Carb (<25% carbs)
- Balanced (15-25% protein, 45-65% carbs)

**Accuracy:** 85-95%

### 2. K-Means Clustering
**Algorithm:** K-Means (5 clusters)

**Features:**
- Daily calories
- Macro distribution
- Meal timing
- Food diversity

**Profiles:**
1. Health-Conscious Eaters
2. High-Protein Athletes
3. Carb-Lovers
4. Balanced Enthusiasts
5. Flexible Dieters

### 3. LSTM Forecasting
**Model:** LSTM neural network

**Purpose:** Predict future calorie intake

**Requirements:** 14+ days data

---

## 🚀 Deployment

### Backend (Render)
1. Create Web Service
2. Build: `pip install -r requirements.txt`
3. Start: `gunicorn --bind 0.0.0.0:$PORT index:app`
4. Root: `api`
5. Add env variables

### Frontend (Render)
1. Create Static Site
2. Publish: `public`
3. Deploy

**Live:**
- Backend: https://nutrition-advisor-a93q.onrender.com
- Frontend: https://nutrition-advisor-frontend.onrender.com

---

## 📁 Project Structure

