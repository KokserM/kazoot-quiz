# Deploying Kazoot to Railway

This guide will help you deploy your Kazoot Kahoot-style quiz application to Railway.

## Prerequisites

1. A Railway account (sign up at [railway.app](https://railway.app))
2. Git repository with your code
3. (Optional) OpenAI API key for AI-generated questions

## Step-by-Step Deployment

### 1. Connect to Railway

1. Visit [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your kazoot-kahoot repository

### 2. Configure Environment Variables

In your Railway project dashboard, go to the Variables tab and add:

**Required:**
- `NODE_ENV` = `production`
- `PORT` = `5000` (or leave empty, Railway will set automatically)

**Optional (for AI-generated questions):**
- `OPENAI_API_KEY` = `your_openai_api_key_here`

**Note:** If you don't provide an OpenAI API key, the app will use demo questions.

### 3. Build Configuration

Railway will automatically detect this is a Node.js project and:
- Run `npm run build` to build the frontend
- Run `npm start` to start the server
- The server will serve both the API and the built React frontend

### 4. Custom Domain (Optional)

1. In Railway dashboard, go to Settings > Domains
2. Click "Generate Domain" for a free Railway subdomain
3. Or add your custom domain

## Environment Variables Reference

```
NODE_ENV=production
PORT=5000
OPENAI_API_KEY=sk-... (optional)
```

## Architecture

- **Backend**: Express.js server with Socket.io for real-time communication
- **Frontend**: React app built and served as static files
- **Database**: In-memory storage (sessions reset on server restart)
- **Real-time**: WebSocket connections for live gameplay

## Troubleshooting

### Build Issues
- Ensure all dependencies are in package.json
- Check build logs in Railway dashboard

### Runtime Issues
- Check application logs in Railway dashboard
- Verify environment variables are set correctly

### WebSocket Issues
- Railway supports WebSocket connections by default
- Ensure CORS is configured for your domain

## Features

- ✅ Real-time multiplayer quiz game
- ✅ AI-generated questions (with OpenAI API)
- ✅ Demo questions (works without API key)
- ✅ Admin controls for game management
- ✅ Live leaderboards and scoring
- ✅ Responsive design for all devices

Your app will be accessible at: `https://your-project-name.railway.app` 