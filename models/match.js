const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
team1: { type: String, required: false }, // اسم الفريق الأول
team2: { type: String, required: false }, // اسم الفريق الثاني
logo1: { type: String, required: false }, // رابط شعار الفريق الأول
logo2: { type: String, required: false }, // رابط شعار الفريق الثاني
time: { type: String, required: false }, // وقت المباراة
competition: { type: String, required: false }, // اسم البطولة
moaalik: { type: String, required: false }, // اسم المعلق
status: { type: String, required: false }, // حالة المباراة (مثل جارية الآن)
order: Number, // الحقل الجديد
link: { type: [String], default: [] }, // رابط البث
}, { timestamps: true }); // لإضافة الوقت والتاريخ تلقائيًا عند الإنشاء والتحديث

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;

