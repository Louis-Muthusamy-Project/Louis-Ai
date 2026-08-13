const mongoose = require('mongoose');

const visionMemorySchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String, // 'camera', 'screen', 'window'
    required: true
  },
  description: {
    type: String, // Text description from Gemini
    required: true
  },
  ocrText: {
    type: String,
    default: ''
  },
  detectedObjects: [{
    type: String
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
});

module.exports = mongoose.model('VisionMemory', visionMemorySchema);
