# LiveKit Setup Guide

## Current Issue
The LiveKit streaming service is not configured, which is why you're seeing a 404 error when trying to access `/livekit/broadcast`.

## Quick Setup Options

### Option 1: Use LiveKit Cloud (Recommended for Testing)
1. Go to [https://cloud.livekit.io/](https://cloud.livekit.io/)
2. Sign up for a free account
3. Create a new project
4. Copy the following values to your `.env` file:
   ```
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_api_key_here
   LIVEKIT_API_SECRET=your_api_secret_here
   ```

### Option 2: Run LiveKit Locally
1. Install Docker
2. Run: `docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp livekit/livekit-server --dev`
3. Set in your `.env` file:
   ```
   LIVEKIT_URL=ws://localhost:7880
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   ```

### Option 3: Disable LiveKit for Now
If you don't need streaming functionality right now, you can:
1. Comment out the LiveKit routes in `server.js`
2. Remove the LiveKit components from the frontend
3. Focus on testing other features first

## Environment Variables
Make sure your `.env` file in the Backend directory contains:
```env
LIVEKIT_URL=your_livekit_url_here
LIVEKIT_API_KEY=your_api_key_here
LIVEKIT_API_SECRET=your_api_secret_here
```

## Testing
After setup:
1. Restart your backend server
2. Try accessing `/livekit/broadcast` again
3. Check the browser console for any errors

## Troubleshooting
- **404 Error**: Check if backend is running and LiveKit routes are registered
- **503 Error**: Check if LiveKit environment variables are set correctly
- **Connection Failed**: Check if LiveKit server is accessible from your network
