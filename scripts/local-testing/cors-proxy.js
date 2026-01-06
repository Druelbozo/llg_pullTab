const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config(); // Load environment variables from .env file

// Load AWS configuration
// const AWS_CONFIG = require('./aws/aws-config');

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Configure AWS SDK with credentials from environment variables
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🔍 Request received: ${req.method} ${req.path}`);
  console.log(`🔍 Headers:`, req.headers);
  next();
});

// Simple upload endpoint that uses child process to avoid credential issues
app.post('/api/upload-background', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Background upload request received');
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const { fileName, description, bucket, folder } = req.body;
    const file = req.file;
    
    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Invalid file type. Only images are allowed.' });
    }
    
    // Use provided filename or original filename
    const finalFileName = fileName || file.originalname;
    
    // Create S3 key
    const s3Key = `${folder}/${finalFileName}`;
    
    console.log(`📁 Uploading to S3: ${bucket}/${s3Key}`);
    console.log(`📊 File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`📋 Description: ${description}`);
    
    // Use child process to upload with fresh credentials
    const { spawn } = require('child_process');
    const fs = require('fs');
    
    // Create temporary file
    const tempFile = `temp-upload-${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, file.buffer);
    
    // Create upload script
    const uploadScript = `
      const AWS = require('aws-sdk');
      const fs = require('fs');
      
      AWS.config.update({
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
      
      const s3 = new AWS.S3();
      
      async function upload() {
        try {
          const fileBuffer = fs.readFileSync('${tempFile}');
          const result = await s3.upload({
            Bucket: 'llg-games',
            Key: '${s3Key}',
            Body: fileBuffer,
            ContentType: '${file.mimetype}',
            Metadata: {
              description: '${description || 'Custom background image'}',
              uploadedBy: 'designer-upload-tool',
              uploadedAt: new Date().toISOString()
            }
          }).promise();
          
          console.log(JSON.stringify({ success: true, url: result.Location }));
          fs.unlinkSync('${tempFile}');
        } catch (error) {
          console.log(JSON.stringify({ success: false, error: error.message }));
          if (fs.existsSync('${tempFile}')) fs.unlinkSync('${tempFile}');
        }
      }
      
      upload();
    `;
    
    const scriptFile = `upload-script-${Date.now()}.js`;
    fs.writeFileSync(scriptFile, uploadScript);
    
    // Execute upload script
    const child = spawn('node', [scriptFile], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      // Clean up script file
      if (fs.existsSync(scriptFile)) fs.unlinkSync(scriptFile);
      
      if (code === 0 && output) {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            console.log(`✅ Upload successful: ${result.url}`);
            res.json({
              success: true,
              url: result.url,
              key: s3Key,
              bucket: 'llg-games',
              fileName: finalFileName,
              description: description
            });
          } else {
            console.error('❌ Upload failed:', result.error);
            res.status(500).json({
              success: false,
              error: result.error || 'Upload failed'
            });
          }
        } catch (parseError) {
          console.error('❌ Failed to parse upload result:', parseError);
          res.status(500).json({
            success: false,
            error: 'Failed to parse upload result'
          });
        }
      } else {
        console.error('❌ Upload script failed:', errorOutput);
        res.status(500).json({
          success: false,
          error: 'Upload script failed'
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Upload failed'
    });
  }
});

// Theme creation endpoint
app.post('/api/save-theme', async (req, res) => {
  try {
    console.log('🎨 Theme creation request received');
    
    const { themeName, themeData } = req.body;
    
    if (!themeName || !themeData) {
      return res.status(400).json({ success: false, error: 'Missing theme name or data' });
    }
    
    // Validate theme name
    if (!/^[a-zA-Z0-9-]+$/.test(themeName)) {
      return res.status(400).json({ success: false, error: 'Theme name can only contain letters, numbers, and hyphens' });
    }
    
    // Create themes directory if it doesn't exist
    const themesDir = path.join(__dirname, 'themes');
    if (!fs.existsSync(themesDir)) {
      fs.mkdirSync(themesDir, { recursive: true });
    }
    
    // Save theme file
    const themePath = path.join(themesDir, `${themeName}.json`);
    const themeContent = JSON.stringify(themeData, null, 2);
    
    fs.writeFileSync(themePath, themeContent);
    
    console.log(`✅ Theme saved: ${themePath}`);
    
    res.json({
      success: true,
      themeName: themeName,
      themePath: themePath,
      message: 'Theme created successfully'
    });
    
  } catch (error) {
    console.error('❌ Theme creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Theme creation failed'
    });
  }
});

// Theme deletion endpoint (must be BEFORE the catch-all proxy)
app.post('/api/delete-theme', async (req, res) => {
  try {
    console.log('🗑️ Theme deletion request received');
    
    const { themeName } = req.body;
    
    if (!themeName) {
      return res.status(400).json({ success: false, error: 'Missing theme name' });
    }
    
    // Prevent deletion of default theme
    if (themeName === 'default') {
      return res.status(400).json({ success: false, error: 'Cannot delete the default theme' });
    }
    
    // Check if theme file exists
    const themesDir = path.join(__dirname, 'themes');
    const themePath = path.join(themesDir, `${themeName}.json`);
    
    if (!fs.existsSync(themePath)) {
      return res.status(404).json({ success: false, error: 'Theme file not found' });
    }
    
    // Delete theme file
    fs.unlinkSync(themePath);
    
    console.log(`✅ Theme deleted: ${themePath}`);
    
    res.json({
      success: true,
      themeName: themeName,
      message: 'Theme deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Theme deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Theme deletion failed'
    });
  }
});

// AI Image Generation endpoint (must be BEFORE the catch-all proxy)
app.post('/api/generate-background', async (req, res) => {
  try {
    console.log('🤖 AI background generation request received');
    
    const { prompt, provider = 'openai' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'No prompt provided' });
    }
    
    console.log(`🎨 Generating background with prompt: "${prompt}" using ${provider}`);
    
    let imageUrl;
    
    if (provider === 'openai') {
      // Use OpenAI DALL-E API
      imageUrl = await generateWithOpenAI(prompt);
    } else if (provider === 'grok') {
      // Use Grok API (if available)
      imageUrl = await generateWithGrok(prompt);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid provider. Use "openai" or "grok"' });
    }
    
    if (!imageUrl) {
      return res.status(500).json({ success: false, error: 'Failed to generate image' });
    }
    
    console.log(`✅ AI generated image URL: ${imageUrl}`);
    
    // Create a proxied URL to avoid CORS issues
    const proxiedUrl = `http://localhost:8081/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    
    res.json({
      success: true,
      url: imageUrl, // Original URL for reference
      proxiedUrl: proxiedUrl, // CORS-safe proxied URL
      prompt: prompt,
      provider: provider,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ AI background generation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'AI image generation failed',
      details: error.message 
    });
  }
});

// Image proxy endpoint for AI-generated images (CORS fix)
app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'No URL provided' });
    }
    
    console.log(`🖼️ Proxying image: ${url}`);
    
    // Fetch the image from the external URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    // Set CORS headers
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    
    // Stream the image data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
    
  } catch (error) {
    console.error('❌ Image proxy failed:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// OpenAI DALL-E image generation
async function generateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  console.log('🔑 OpenAI API Key check:', apiKey ? `Found (${apiKey.substring(0, 20)}...)` : 'NOT FOUND');
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
  }
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1792x1024', // Good aspect ratio for game backgrounds
      quality: 'standard',
      style: 'natural'
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
  }
  
  const data = await response.json();
  return data.data[0].url;
}

// Grok image generation (placeholder - implement when Grok API is available)
async function generateWithGrok(prompt) {
  // TODO: Implement Grok API integration when available
  throw new Error('Grok API integration not yet implemented');
}

// Upload AI generated background to S3 endpoint (must be BEFORE the catch-all proxy)
app.post('/api/upload-generated-to-s3', async (req, res) => {
  try {
    console.log('📤 AI generated image upload request received');
    
    const { tempUrl, filename, description, prompt, folder } = req.body;
    
    if (!tempUrl || !filename) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: tempUrl and filename' 
      });
    }
    
    // Default to 'backgrounds' for backward compatibility
    const targetFolder = folder || 'backgrounds';
    
    // Download the image from the temporary URL
    console.log(`📥 Downloading image from: ${tempUrl}`);
    const imageResponse = await fetch(tempUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }
    
    console.log(`📥 Image response status: ${imageResponse.status}`);
    console.log(`📥 Image content type: ${imageResponse.headers.get('content-type')}`);
    
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);
    console.log(`📥 Downloaded ${imageBuffer.length} bytes`);
    
    // Generate S3 key using folder parameter
    const s3Key = `games/video-poker/assets/${targetFolder}/${filename}`;
    
    // Upload to S3
    const uploadParams = {
      Bucket: 'llg-games',
      Key: s3Key,
      Body: imageBuffer,
      ContentType: 'image/png',
      Metadata: {
        'description': description || `AI Generated: ${prompt}`,
        'prompt': prompt || 'Unknown',
        'generated-at': new Date().toISOString()
      }
    };
    
    console.log(`📤 Uploading to S3: ${s3Key}`);
    const uploadResult = await s3.upload(uploadParams).promise();
    
    const s3Url = `https://llg-games.s3.us-east-1.amazonaws.com/${s3Key}`;
    
    console.log(`✅ Successfully uploaded to S3: ${s3Url}`);
    
    res.json({ 
      success: true, 
      s3Url: s3Url,
      s3Key: s3Key,
      filename: filename,
      size: imageBuffer.length
    });
    
  } catch (error) {
    console.error('❌ Error uploading AI generated image to S3:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// List S3 background images endpoint (must be BEFORE the catch-all proxy)
app.get('/api/list-backgrounds', async (req, res) => {
  try {
    console.log('📋 Background list request received');
    
    const params = {
      Bucket: 'llg-games',
      Prefix: 'games/video-poker/assets/backgrounds/',
      Delimiter: '/'
    };
    
    const result = await s3.listObjectsV2(params).promise();
    
    // Extract image files from the results
    const images = result.Contents
      .filter(obj => obj.Key !== 'games/video-poker/assets/backgrounds/') // Exclude the folder itself
      .map(obj => ({
        key: obj.Key,
        name: obj.Key.replace('games/video-poker/assets/backgrounds/', ''), // Remove the prefix
        size: obj.Size,
        lastModified: obj.LastModified,
        url: `https://llg-games.s3.us-east-1.amazonaws.com/${obj.Key}`
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    
    console.log(`✅ Found ${images.length} background images`);
    
    res.json({
      success: true,
      images: images,
      count: images.length
    });
    
  } catch (error) {
    console.error('❌ Background list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list backgrounds'
    });
  }
});

// Generic delete image endpoint (must be BEFORE the catch-all proxy)
app.post('/api/delete-image', async (req, res) => {
  try {
    console.log('🗑️ Image deletion request received');
    
    const { s3Key, folder } = req.body;
    
    if (!s3Key) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing S3 key' 
      });
    }
    
    if (!folder) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing folder parameter' 
      });
    }
    
    // Validate that the key is in the specified folder
    const expectedPrefix = `games/video-poker/assets/${folder}/`;
    if (!s3Key.startsWith(expectedPrefix)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid S3 key - must be in ${folder} folder` 
      });
    }
    
    console.log(`🗑️ Deleting image from S3: ${s3Key} (folder: ${folder})`);
    
    // Delete from S3
    const deleteParams = {
      Bucket: 'llg-games',
      Key: s3Key
    };
    
    await s3.deleteObject(deleteParams).promise();
    
    console.log(`✅ Successfully deleted image: ${s3Key}`);
    
    res.json({
      success: true,
      s3Key: s3Key,
      folder: folder,
      message: 'Image deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Image deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete image'
    });
  }
});

// Delete S3 background image endpoint (must be BEFORE the catch-all proxy)
// Kept for backward compatibility - calls the generic delete-image endpoint
app.post('/api/delete-background', async (req, res) => {
  try {
    console.log('🗑️ Background deletion request received (legacy endpoint)');
    
    const { s3Key } = req.body;
    
    if (!s3Key) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing S3 key' 
      });
    }
    
    // Validate that the key is in the backgrounds folder
    if (!s3Key.startsWith('games/video-poker/assets/backgrounds/')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid S3 key - must be in backgrounds folder' 
      });
    }
    
    // Call the generic delete-image endpoint internally
    const deleteParams = {
      Bucket: 'llg-games',
      Key: s3Key
    };
    
    await s3.deleteObject(deleteParams).promise();
    
    console.log(`✅ Successfully deleted background: ${s3Key}`);
    
    res.json({
      success: true,
      s3Key: s3Key,
      message: 'Background deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Background deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete background'
    });
  }
});

// List S3 cardback images endpoint (must be BEFORE the catch-all proxy)
app.get('/api/list-cardbacks', async (req, res) => {
  try {
    console.log('🃏 Cardback list request received');
    
    const params = {
      Bucket: 'llg-games',
      Prefix: 'games/video-poker/assets/cardBacks/',
      Delimiter: '/'
    };
    
    const result = await s3.listObjectsV2(params).promise();
    
    console.log(`📦 S3 listObjectsV2 result:`, {
      keyCount: result.Contents?.length || 0,
      keys: result.Contents?.map(obj => obj.Key) || []
    });
    
    // Extract image files from the results
    const images = (result.Contents || [])
      .filter(obj => {
        // Exclude the folder itself and only include actual files
        const isFolder = obj.Key === 'games/video-poker/assets/cardBacks/' || obj.Key.endsWith('/');
        if (isFolder) {
          console.log(`⏭️ Skipping folder object: ${obj.Key}`);
        }
        return !isFolder;
      })
      .map(obj => {
        const name = obj.Key.replace('games/video-poker/assets/cardBacks/', ''); // Remove the prefix
        console.log(`📄 Processing cardback: ${name} (key: ${obj.Key})`);
        return {
          key: obj.Key,
          name: name,
          size: obj.Size,
          lastModified: obj.LastModified,
          url: `https://llg-games.s3.us-east-1.amazonaws.com/${obj.Key}`
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    
    console.log(`✅ Found ${images.length} cardback images:`, images.map(img => img.name));
    
    res.json({
      success: true,
      images: images,
      count: images.length
    });
    
  } catch (error) {
    console.error('❌ Cardback list error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list cardbacks'
    });
  }
});

// Root route handler to prevent "Cannot Get /" errors
// This handles requests when Cursor's auto-browser tries to access the root path
app.get('/', (req, res) => {
  res.json({
    message: 'CORS Proxy is running',
    service: 'LLG Provider API Proxy',
    endpoints: {
      test: '/test',
      health: '/health',
      debug: '/debug',
      ip: '/ip',
      api: '/api/* (proxied to AWS API)'
    },
    documentation: 'This is a CORS proxy server. Use /api/* endpoints to access the LLG Provider API.'
  });
});

// Simple proxy middleware for the LLG Provider API
app.use('/api', (req, res, next) => {
  // Skip local endpoints that should be handled by this server
  if (      req.path === '/list-backgrounds' || req.path === '/list-cardbacks' || 
      req.path === '/upload-background' || req.path === '/generate-background' ||
      req.path === '/upload-generated-to-s3' || req.path === '/delete-background' ||
      req.path === '/delete-image' || req.path === '/delete-cardback') {
    return next(); // Skip proxy, let local handlers process
  }
  
  console.log(`🔄 Proxying: ${req.method} ${req.path} -> /dev${req.path.replace('/api', '')}`);
  
  // Get the real client IP
  let clientIP = req.connection.remoteAddress || 
                 req.socket.remoteAddress || 
                 req.ip ||
                 'unknown';
  
  // If client IP is localhost, use the actual public IP
  if (clientIP === '::1' || clientIP === '127.0.0.1' || clientIP === 'localhost') {
      clientIP = '212.15.81.44'; // Your whitelisted IP
      console.log('🔄 Localhost detected, using whitelisted IP:', clientIP);
  }
  
  console.log(`🌐 Client IP: ${clientIP}`);
  
  // Create the target URL with query parameters
  const targetPath = req.path.replace('/api', '');
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `https://q0pcptpjxd.execute-api.us-east-1.amazonaws.com/dev${targetPath}${queryString}`;
  console.log(`🎯 Target URL: ${targetUrl}`);
  
  // Forward the request (use https for HTTPS URLs)
  const https = require('https');
  const url = require('url');
  const parsedUrl = url.parse(targetUrl);
  
  const proxyReq = https.request({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 443,
    path: parsedUrl.path,
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'User-Agent': req.headers['user-agent'],
      'X-Forwarded-For': clientIP,
      'X-Real-IP': clientIP
    }
  }, (proxyRes) => {
    console.log(`📥 Response: ${proxyRes.statusCode} ${req.method} ${req.path}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Brand-Id, X-Secret-Key');
    
    // Forward the response
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('❌ Proxy Error:', err.message);
    res.status(500).json({ 
      error: 'Proxy Error', 
      message: err.message,
      request: `${req.method} ${req.path}`
    });
  });
  
  // Forward the request body if it exists
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyData = JSON.stringify(req.body);
    console.log(`📤 Request body: ${bodyData}`);
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
  
  proxyReq.end();
});

const PORT = 8081;
const HOST = '0.0.0.0'; // Bind to all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`🚀 CORS Proxy running on http://localhost:${PORT}`);
  console.log(`🌐 Also accessible on your network IP: http://212.15.81.44:${PORT}`);
  console.log(`📡 Proxying requests to LLG Provider API (New Structure)`);
  console.log(`🔗 Use: http://localhost:${PORT}/api/provider/games`);
  console.log(`🔗 Use: http://212.15.81.44:${PORT}/api/provider/games`);
  console.log(`🔗 Use: http://localhost:${PORT}/api/provider/startGame`);
  console.log(`🔗 Use: http://212.15.81.44:${PORT}/api/provider/startGame`);
  console.log(`🔗 Use: http://localhost:${PORT}/api/provider/session`);
  console.log(`🔗 Use: http://212.15.81.44:${PORT}/api/provider/session`);
  console.log(`🔗 Use: http://localhost:${PORT}/api/video-poker/deal`);
  console.log(`🔗 Use: http://212.15.81.44:${PORT}/api/video-poker/deal`);
  console.log(`🔗 Use: http://localhost:${PORT}/api/video-poker/draw`);
  console.log(`🔗 Use: http://212.15.81.44:${PORT}/api/video-poker/draw`);
  console.log(`\n📋 New API Structure:`);
  console.log(`   - No JWT tokens required`);
  console.log(`   - IP whitelist authentication`);
  console.log(`   - Single /startGame endpoint`);
  console.log(`   - Session management via sessionId`);
  console.log(`\n🌐 Target API: https://q0pcptpjxd.execute-api.us-east-1.amazonaws.com/dev`);
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'CORS Proxy is running!',
    api: 'LLG Provider API (New Structure)',
    authentication: 'IP Whitelist',
    endpoints: [
      'GET /api/provider/games',
      'POST /api/provider/startGame',
      'POST /api/provider/session',
      'POST /api/video-poker/deal',
      'POST /api/video-poker/draw'
    ]
  });
});

// Debug endpoint to test proxy routing
app.get('/debug', (req, res) => {
  res.json({
    message: 'Debug endpoint',
    timestamp: new Date().toISOString(),
    proxy: {
      target: 'https://q0pcptpjxd.execute-api.us-east-1.amazonaws.com',
      pathRewrite: '^/api -> /dev',
      fullUrl: 'https://q0pcptpjxd.execute-api.us-east-1.amazonaws.com/dev'
    },
    testUrls: {
      localhost: 'http://localhost:8081/api/provider/games',
      networkIP: 'http://212.15.81.44:8081/api/provider/games',
      startGame: 'http://212.15.81.44:8081/api/provider/startGame'
    }
  });
});

// Test endpoint to show client IP
app.get('/ip', (req, res) => {
  const clientIP = req.connection.remoteAddress || 
                  req.socket.remoteAddress || 
                  req.connection.socket?.remoteAddress ||
                  req.ip ||
                  'unknown';
  
  res.json({
    message: 'Client IP Test',
    timestamp: new Date().toISOString(),
    clientIP: clientIP,
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'user-agent': req.headers['user-agent']
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}); 