const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;

require('dotenv').config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const TOKEN_PATH = path.join(__dirname, 'token.json');

// OAuth2 Client Setup
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Scopes: YouTube readonly access
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

// Start the OAuth flow (this will redirect the user to Google's consent screen)
app.get('/login', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(authUrl); // Redirect to Google's OAuth 2.0 consent screen
});

app.get('/liked', (req, res) => {
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) {
            return res.status(500).send('Error retrieving access token: ' + err.message);
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        fetchLikedVideos(oAuth2Client);
        res.send('Liked videos fetched!');
    });
    // if no token, redirect to OAuth flow
    if (!fs.existsSync(TOKEN_PATH)) {
        res.redirect('/login');
    }
});

// Handle the OAuth callback from Google
app.get('/oauth2callback', (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.send('Error: No authorization code received.');
  }

  // Exchange authorization code for an access token
  oAuth2Client.getToken(code, (err, token) => {
    if (err) {
      return res.status(500).send('Error retrieving access token: ' + err.message);
    }

    // Store the token to disk for later use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    oAuth2Client.setCredentials(token);

    res.send('Authorization successful! You can now close this window.');

    // (Optional) Now that we have the token, you could automatically trigger a video-fetch function here.
    fetchLikedVideos(oAuth2Client);
  });
});

// Optionally, handle fetching liked videos after login (add this to the flow if needed)
function fetchLikedVideos(auth) {
    console.log('Fetching liked videos...');

  const youtube = google.youtube({ version: 'v3', auth });
  // list playlist ids
  youtube.playlists.list({
    part: 'snippet',
    mine: true,
  }, (err, res) => {
    if (err) {
      console.error('Error fetching playlists:', err);
      return;
    }
    const playlists = res.data.items;
    playlists.forEach(playlist => {
      console.log(`Playlist ID: ${playlist.id}`);
      console.log(`Playlist Title: ${playlist.snippet.title}`);
      console.log(`Playlist URL: https://www.youtube.com/playlist?list=${playlist.id}`);
    });
  });
  
  youtube.playlistItems.list({
    part: 'snippet',
    playlistId: 'LL', // 'LL' is the alias for the "Liked Videos" playlist
    maxResults: 10,
  }, (err, res) => {
    if (err) {
      console.error('Error fetching liked videos:', err);
      return;
    }
    const videos = res.data.items;
    videos.forEach(video => {
      console.log(`Title: ${video.snippet.title}`);
      console.log(`Video URL: https://www.youtube.com/watch?v=${video.snippet.resourceId.videoId}`);
    });
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
