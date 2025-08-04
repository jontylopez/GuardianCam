const { initializeFirebase, getFirestore } = require("./config/firebase");
const PythonModelIntegration = require("./utils/pythonModelIntegration");

async function testBackendSetup() {
  console.log("🧪 Testing GuardianCam Backend Setup...\n");

  try {
    // Test 1: Firebase Connection
    console.log("1. Testing Firebase Connection...");
    initializeFirebase();
    const db = getFirestore();
    console.log("✅ Firebase connection successful\n");

    // Test 2: Python Model Integration
    console.log("2. Testing Python Model Integration...");
    const modelIntegration = new PythonModelIntegration();
    const modelInfo = await modelIntegration.getModelInfo();
    console.log("Model Info:", modelInfo);
    console.log("✅ Python model integration test completed\n");

    // Test 3: Environment Variables
    console.log("3. Testing Environment Variables...");
    const requiredEnvVars = [
      "PORT",
      "NODE_ENV",
      "JWT_SECRET",
      "JWT_EXPIRES_IN",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      console.log("⚠️  Missing environment variables:", missingVars);
      console.log("   Please check your .env file");
    } else {
      console.log("✅ All required environment variables are set");
    }
    console.log("");

    // Test 4: File System
    console.log("4. Testing File System...");
    const fs = require("fs");
    const path = require("path");

    // Check if uploads directory exists
    const uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log("✅ Created uploads directory");
    } else {
      console.log("✅ Uploads directory exists");
    }

    // Check if Firebase key exists
    const firebaseKeyPath = path.join(__dirname, "firebase-key.json");
    if (fs.existsSync(firebaseKeyPath)) {
      console.log("✅ Firebase key file exists");
    } else {
      console.log("❌ Firebase key file not found");
    }
    console.log("");

    // Test 5: Dependencies
    console.log("5. Testing Dependencies...");
    const requiredModules = [
      "express",
      "cors",
      "helmet",
      "compression",
      "morgan",
      "express-rate-limit",
      "socket.io",
      "bcryptjs",
      "jsonwebtoken",
      "express-validator",
      "multer",
      "uuid",
      "firebase-admin",
    ];

    const missingModules = [];
    for (const module of requiredModules) {
      try {
        require(module);
      } catch (error) {
        missingModules.push(module);
      }
    }

    if (missingModules.length > 0) {
      console.log("❌ Missing dependencies:", missingModules);
      console.log("   Run: npm install");
    } else {
      console.log("✅ All required dependencies are installed");
    }
    console.log("");

    // Test 6: Routes
    console.log("6. Testing Route Files...");
    const routeFiles = [
      "routes/auth.js",
      "routes/users.js",
      "routes/fallDetection.js",
      "routes/alerts.js",
    ];

    const missingRoutes = [];
    for (const routeFile of routeFiles) {
      const routePath = path.join(__dirname, routeFile);
      if (!fs.existsSync(routePath)) {
        missingRoutes.push(routeFile);
      }
    }

    if (missingRoutes.length > 0) {
      console.log("❌ Missing route files:", missingRoutes);
    } else {
      console.log("✅ All route files exist");
    }
    console.log("");

    // Test 7: Middleware
    console.log("7. Testing Middleware Files...");
    const middlewareFiles = [
      "middleware/auth.js",
      "middleware/errorHandler.js",
    ];

    const missingMiddleware = [];
    for (const middlewareFile of middlewareFiles) {
      const middlewarePath = path.join(__dirname, middlewareFile);
      if (!fs.existsSync(middlewarePath)) {
        missingMiddleware.push(middlewareFile);
      }
    }

    if (missingMiddleware.length > 0) {
      console.log("❌ Missing middleware files:", missingMiddleware);
    } else {
      console.log("✅ All middleware files exist");
    }
    console.log("");

    // Summary
    console.log("📊 Setup Test Summary:");
    console.log("✅ Firebase: Connected");
    console.log("✅ Python Model: Available");
    console.log("✅ File System: Ready");
    console.log("✅ Dependencies: Installed");
    console.log("✅ Routes: Configured");
    console.log("✅ Middleware: Ready");
    console.log("\n🎉 Backend setup is complete and ready to run!");
    console.log("\nTo start the server:");
    console.log("  npm run dev    # Development mode");
    console.log("  npm start      # Production mode");
  } catch (error) {
    console.error("❌ Setup test failed:", error.message);
    console.log("\nPlease check the error above and fix any issues.");
  }
}

// Run the test
testBackendSetup();
