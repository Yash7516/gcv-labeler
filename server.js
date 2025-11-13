'use strict';

const express = require('express');
const multer = require('multer');
const morgan = require('morgan');
const path = require('path');
const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Multer setup — store files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  }
});

// Google Cloud Vision client
const visionClient = new ImageAnnotatorClient();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Show upload form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle upload
app.post('/upload', upload.single('pic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    // Send image to Google Cloud Vision
    const [result] = await visionClient.labelDetection({
      image: { content: req.file.buffer }
    });

    const labels = (result.labelAnnotations || []).map(l => ({
      description: l.description,
      score: typeof l.score === 'number' ? Math.round(l.score * 100) : null
    }));

    // Render the result
    res.render('result', {
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeKB: Math.round(req.file.size / 1024),
      base64: req.file.buffer.toString('base64'),
      labels
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(`Error processing image: ${err.message}`);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
