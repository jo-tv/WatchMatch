const mongoose = require("mongoose");

// تعريف مخطط القنوات
const channelSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  url: { type: String, required: true },
});

// إنشاء النموذج
const Channel = mongoose.model("Channel", channelSchema);

module.exports = Channel;






