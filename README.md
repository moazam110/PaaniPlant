# Paani Delivery System

## Local Development (Firebase-Free)

This project no longer uses Firebase. All data and authentication are handled by a local Express backend for easy local testing and future expansion.

### How to Run Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start the backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   The backend will run on [http://localhost:4000](http://localhost:4000)

3. **Start the frontend:**
   ```bash
   npm run dev
   ```
   The frontend will run on [http://localhost:9002](http://localhost:9002)

---

## 🛠️ Troubleshooting Guide

### "Failed to fetch" / "Backend server is not connected" Error

This error occurs when the frontend cannot reach the backend server. Follow these steps:

#### Step 1: Check if Backend is Running
```bash
# Check if port 4000 is in use
netstat -ano | findstr ":4000"
```
- If you see output, backend is running ✅
- If no output, backend is not running ❌

#### Step 2: Start Backend if Not Running
```bash
cd backend
npm run dev
# Or for production:
npm start
```

#### Step 3: Verify Backend Health
Visit or curl: [http://localhost:4000/api/health](http://localhost:4000/api/health)
```bash
curl http://localhost:4000/api/health
```
Should return: `{"status":"OK","timestamp":"...","database":"connected"}`

#### Step 4: Check Frontend Connection
Visit: [http://localhost:9002/admin](http://localhost:9002/admin)
- Green indicator = Backend connected ✅
- Yellow warning = Backend disconnected ❌

#### Step 5: Force Restart Both Servers
If issues persist:
```bash
# Kill all Node.js processes
taskkill /f /im node.exe

# Restart backend
cd backend
npm run dev

# Restart frontend (in new terminal)
npm run dev
```

### Common Issues & Solutions

1. **Port Conflicts:**
   - Backend (4000): Kill process with `taskkill /f /im node.exe`
   - Frontend (9002): Kill process with `taskkill /f /im node.exe`

2. **MongoDB Connection Issues:**
   - Check internet connection
   - Verify MongoDB Atlas credentials
   - Check backend logs for connection errors

3. **CORS Errors:**
   - Ensure backend is running on port 4000
   - Frontend should be on port 9002
   - Check that backend has `cors()` middleware enabled

4. **Cache Issues:**
   - Clear browser cache
   - Restart both servers
   - Delete `.next` folder and restart frontend

---

- All data is stored locally (in-memory or JSON file).
- No Firebase or cloud dependencies required.
- For production, swap the backend with a real database.
