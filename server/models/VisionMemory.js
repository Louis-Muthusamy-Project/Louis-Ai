const mongoose = require('mongoose');

const visionMemorySchema = new mongoose.Schema({
  // Owner of this vision analysis. Required for all new records; see
  // migration note in visionService.js for how pre-existing records
  // (saved before this field existed) are handled.
  userId: {
    type: String,
    required: true,
    index: true
  },
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
