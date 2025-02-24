const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const app = express();
const Channel = require("./models/channel");
const Match = require("./models/match");
const PORT = 3000;

// الاتصال بقاعدة بيانات MongoDB
async function connectToDatabase() {
 try {
  await mongoose.connect(
   "mongodb+srv://josefuccef7:gHkpeNOLUzOvawuh@cluster0.qmwgw.mongodb.net/alldata?retryWrites=true&w=majority&appName=Cluster0");

  console.log("CONNCET TO DATABASE");

  app.listen(PORT, () => {
   console.log(`Server is running on http://localhost:${PORT}`);
  });
 } catch (error) {
  console.error("ERROR CONNECTING TO DATABASE:", error.message);
 }
}
app.get("/ads.txt", (req, res) => {
 res.sendFile(path.join(__dirname, "public", "ads.txt"));
});

// إعداد البيانات
app.set("views", path.join(__dirname, "./views"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// دالة لتوليد التوكن
function generateToken() {
 const token = Math.random().toString(36).substr(2);
 const expires = Math.floor(Date.now() / 1000) + 3600;
 return { token, expires };
}

// دالة لجلب القنوات وحفظها في قاعدة البيانات
async function fetchChannels() {
 const m3uUrl =
  "http://xtream-ie.com:80/get.php?username=mo3ad201&password=mo3ad201&type=m3u8";

 try {
  console.log("Fetching channels...");
  const { data } = await axios.get(m3uUrl);
  console.log("Channels fetched successfully!");

  const lines = data.split("\n");
  const channels = [];
  let currentName = "";
  let currentUrl = "";

  for (const line of lines) {
   const trimmedLine = line.trim();

   if (trimmedLine.startsWith("#EXTINF")) {
    const nameMatch = trimmedLine.match(/,([^,]+)$/);
    if (nameMatch && nameMatch[1]) {
     currentName = nameMatch[1].trim().toUpperCase();
    }
   } else if (trimmedLine && !trimmedLine.startsWith("#")) {
    currentUrl = trimmedLine;
    if (currentName && currentUrl) {
     channels.push({ name: currentName, url: currentUrl });
     currentName = "";
     currentUrl = "";

     // التوقف عند 20 قناة
     if (channels.length >= 1) {
      break;
     }
    }
   }
  }
  await saveChannelsToDatabase(channels); // حفظ القنوات في قاعدة البيانات
  console.log(`${channels.length} channels saved to the database.`);
 } catch (error) {
  console.error("Error fetching channels:", error.message);
 }
}

// حفظ القنوات في قاعدة البيانات
async function saveChannelsToDatabase(channels) {
 try {
  for (const channel of channels) {
   const existingChannel = await Channel.findOne({ name: channel.name });
   if (!existingChannel) {
    await Channel.create(channel);
    console.log(`تمت إضافة القناة: ${channel.name}`);
   } else {
    console.log(`القناة موجودة بالفعل: ${channel.name}`);
   }
  }
 } catch (error) {
  console.error("Error saving channels to database:", error.message);
 }
}

// قراءة القنوات من قاعدة البيانات
async function readChannelsFromDatabase() {
 try {
  return await Channel.find();
 } catch (error) {
  console.error("Error fetching channels from database:", error.message);
  return [];
 }
}

function subtractOneHour(time) {
 const [hours, minutes] = time.split(":").map(num => parseInt(num, 10));

 const date = new Date();
 date.setHours(hours, minutes, 0);

 if (isNaN(date.getTime())) {
  console.error("Invalid time value:", time);
  return time; // إذا كانت القيمة غير صالحة، أعد الوقت الأصلي
 }

 date.setHours(date.getHours() - 1); // إنقاص ساعة

 const updatedHours = String(date.getHours()).padStart(2, "0");
 const updatedMinutes = String(date.getMinutes()).padStart(2, "0");

 return `${updatedHours}:${updatedMinutes}`; // إعادة الوقت بالتنسيق HH:MM
}

// دالة لجلب المباريات وحفظها في قاعدة البيانات
async function fetchMatches() {
 try {
  const { data } = await axios.get("https://www.koraa-live.com/");
  const $ = require("cheerio").load(data);

  const matches = [];
  const channels = await readChannelsFromDatabase();

  $(".AY_Match").each((index, element) => {
   const team1 = $(element).find(".MT_Team.TM1 .TM_Name").text().trim();
   const team2 = $(element).find(".MT_Team.TM2 .TM_Name").text().trim();
   const logo1 = $(element).find(".MT_Team.TM1 .TM_Logo img").attr("data-src");
   const logo2 = $(element).find(".MT_Team.TM2 .TM_Logo img").attr("data-src");
   const time = $(element).find(".MT_Time").text().trim();
   const competition = $(element).find(".MT_Info ul li").last().text().trim();
   const moaalik = $(element).find(".MT_Info ul li").first().text().trim().toUpperCase();
   const status = $(element).find(".MT_Stat").text().trim();
   const channel = channels.find(ch => ch.name === moaalik);

   // تقليص ساعة من الوقت (إذا كان الوقت متاحًا)
   const updatedTime = time ? subtractOneHour(time) : time;

   matches.push({
    team1,
    team2,
    logo1,
    logo2,
    time: updatedTime, // استخدام الوقت المعدل
    competition,
    moaalik,
    status,
    link: channel ? channel.url : "رابط غير متوفر",
   });
  });

  await saveMatchesToDatabase(matches);
 } catch (error) {
  console.error("Error fetching matches:", error.message);
 }
}

// حفظ المباريات في قاعدة البيانات
async function saveMatchesToDatabase(matches) {
 try {
  for (const match of matches) {
   const existingMatch = await Match.findOne({
    team1: match.team1,
    team2: match.team2,
   });
   if (!existingMatch) {
    await Match.create(match);
    console.log(`تمت إضافة المباراة بين ${match.team1} و ${match.team2}`);
   } else {
    console.log(`المباراة موجودة بالفعل بين ${match.team1} و ${match.team2}`);
   }
  }
 } catch (error) {
  console.error("Error saving matches to database:", error.message);
 }
}

// قراءة المباريات من قاعدة البيانات
async function readMatchesFromDatabase() {
 try {
  return await Match.find();
 } catch (error) {
  console.error("Error fetching matches from database:", error.message);
  return [];
 }
}

// صفحة إعادة تحميل البيانات
app.get("/reload", async (req, res) => {
 await fetchMatches();
 await fetchChannels();
 res.redirect("/edit");
});
;

// دالة لقراءة القنوات من ملف Sport.json
function readChannelsFromFile() {
 try {
  const filePath = path.join("./public/Sport.json");
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
 } catch (error) {
  console.error("Error reading Sport.json:", error.message);
  return [];
 }
}


// دالة لتحديث المباريات مع الرابط المناسب من ملف Sport.json
app.post("/update", async (req, res) => {
 const updatedMatches = req.body.matches;

 if (Array.isArray(updatedMatches)) {
  try {
   const channels = readChannelsFromFile(); // قراءة القنوات من الملف Sport.json

   for (const match of updatedMatches) {
    const { _id, team1, team2, time, competition, moaalik, status, link } = match;

    // إذا لم يتم إرسال رابط جديد من صفحة التعديل، ابحث عن الرابط المناسب من القنوات
    let url = link;
    if (!url || url === "رابط غير متوفر") {
     const channel = channels.find(channel => channel.name === moaalik);
     url = channel ? channel.url : "رابط غير متوفر";
    }

    // تحديث المباراة
    await Match.findByIdAndUpdate(
     _id,
     {
      team1,
      team2,
      time,
      competition,
      moaalik,
      status,
      link: url, // تحديث الرابط باستخدام url من القناة أو الرابط الجديد
     },
     { new: true } // يعيد الكائن بعد التحديث
    );
   }

   console.log("تم تحديث المباريات بنجاح في قاعدة البيانات.");
   res.redirect("/"); // إعادة التوجيه إلى الصفحة الرئيسية
  } catch (error) {
   console.error("Error updating matches:", error.message);
   res.status(500).send("حدث خطأ أثناء تحديث البيانات.");
  }
 } else {
  res.status(400).send("البيانات غير صحيحة.");
 }
});


const updateMatchStatuses = async () => {
 try {
  const matches = await Match.find({}, { _id: 1, status: 1, time: 1, order: 1 });

  if (!matches || matches.length === 0) {
   console.warn("No matches found in the database.");
   return;
  }

  const now = moment().utcOffset(0).add(2, "hours");

  for (const match of matches) {
   let newStatus;
   const todayDate = moment().format("YYYY-MM-DD");
   const matchTimeString = `${todayDate}T${match.time}`;
   let matchTime = moment(matchTimeString);

   if (matchTime.isBefore(now, "minute") && matchTime.isSame(now, "day")) {
    console.log(`Match ${match._id} is still today.`);
   } else if (matchTime.isBefore(now)) {
    matchTime = matchTime.add(1, "day");
   }

   if (!matchTime.isValid()) {
    console.warn(`Invalid match.time for match ${match._id}. Skipping...`);
    continue;
   }

   const timeDifference = matchTime.diff(now, "milliseconds");

   if (timeDifference > 15 * 60 * 1000) {
    newStatus = "لم تبدأ";
   } else if (timeDifference <= 15 * 60 * 1000 && timeDifference > 0) {
    newStatus = "ستبدأ بعد قليل";
   } else if (timeDifference <= 0 && Math.abs(timeDifference) <= 2 * 60 * 60 * 1000) {
    newStatus = "جارية";
   } else if (Math.abs(timeDifference) > 2 * 60 * 60 * 1000) {
    newStatus = "انتهت";
   }

   if (match.status !== newStatus) {
    match.status = newStatus;
    await match.save()
     .then(() => console.log(`Match ${match._id} saved successfully.`))
     .catch((err) => console.error(`Error saving match ${match._id}:`, err.message));
   }
  }

  const sortedMatches = matches.sort((a, b) => {
   if (a.status === "انتهت" && b.status !== "انتهت") return 1;
   if (a.status !== "انتهت" && b.status === "انتهت") return -1;

   const timeA = moment(a.time, "HH:mm");
   const timeB = moment(b.time, "HH:mm");
   return timeA.diff(timeB);
  });

  console.log("Sorted Matches:", sortedMatches);

  const bulkOperations = sortedMatches.map((match, index) => ({
   updateOne: {
    filter: { _id: match._id },
    update: { $set: { order: index } },
   },
  }));

  console.log("Prepared bulk operations:", bulkOperations);

  await Match.bulkWrite(bulkOperations)
   .then((result) => {
    console.log(`Updated ${result.modifiedCount} matches.`);
   })
   .catch((err) => {
    console.error("Error in bulk update:", err.message);
   });

  console.log("All match statuses and order updated successfully.");
 } catch (error) {
  console.error("Error updating match statuses:", error.message);
 }
};

function updateMatchStatus() {
 console.log("تحديث حالة المباريات...");

 // تحديث 3 مرات بفاصل 9 ثوانٍ
 for (let i = 1; i <= 5; i++) {
  setTimeout(() => {
   updateMatchStatuses();
   // استدعاء كود تحديث البيانات هنا
  }, i * 9000);
 }
}

// تشغيل الدالة كل 10 دقائق
setInterval(updateMatchStatus, 10 * 60 * 1000);

// استدعاء أولي عند بدء التشغيل
updateMatchStatus();

// الصفحة الرئيسية
app.get("/", async (req, res) => {
 try {
  const matches = await Match.find().sort({ order: 1 }); // ترتيب تصاعدي حسب الحقل order
  const channels = await readChannelsFromDatabase();
  res.render("index", { matches, channels, noMatches: matches.length === 0 });
 } catch (error) {
  console.error("Error rendering homepage:", error.message);
  res.status(500).send("حدث خطأ أثناء معالجة الطلب.");
 }
});

// صفحة التعديل
app.get("/edit", async (req, res) => {
 const matches = await readMatchesFromDatabase();
 res.render("edit", { matches });
});

// مسح البيانات
app.get("/clear", async (req, res) => {
 try {
  await Channel.deleteMany();
  await Match.deleteMany();
  console.log("All data cleared.");
  res.redirect("/edit");
 } catch (error) {
  console.error("Error clearing data:", error.message);
  res.status(500).send("خطأ أثناء مسح البيانات.");
 }
});

app.get("/login", (req, res) => res.render("singup"));
app.get("/menu", (req, res) => res.render("menu"));
app.get("/beinHd", (req, res) => res.render("beinHd"));
app.get("/beinSd", (req, res) => res.render("beinSd"));
app.get("/beinLQ", (req, res) => res.render("beinLQ"));
app.get("/sportArab", (req, res) => res.render("sportArab"));
app.get("/news", (req, res) => res.render("news"));
app.get("/maroc", (req, res) => res.render("maroc"));
app.get("/arab", (req, res) => res.render("arab"));


function readChannels() {
 try {
  const data = fs.readFileSync("./public/Sport.json", "utf-8");
  const channels = JSON.parse(data);
  return channels; // إرجاع القنوات ككائنات
 } catch (error) {
  console.error("خطأ أثناء قراءة ملف القنوات:", error.message);
  return [];
 }
}

// عرض صفحة البحث
app.get("/search", (req, res) => {
 res.render("search", {
  result: null,
  query: "",
  error: null,
  suggestions: []
 });
});

// البحث عن قناة في ملف Sport.json
app.post("/search", (req, res) => {
 const { channelName } = req.body;

 if (!channelName) {
  return res.render("search", {
   result: null,
   query: "",
   error: "يرجى إدخال اسم القناة.",
   suggestions: []
  });
 }

 // قراءة القنوات من ملف JSON
 const channels = readChannelsFromFile(); // استخدم دالة لقراءة القنوات

 const query = channelName.trim().toUpperCase();
 const suggestions = channels
  .filter(channel => channel.name.includes(query))
  .map(channel => channel.name);

 // إذا كان هناك تطابقات
 if (suggestions.length > 0) {
  const result = suggestions.length === 1
   ? channels.find(channel => channel.name === suggestions[0])
   : null;

  return res.render("search", {
   result,
   query: channelName,
   error: null,
   suggestions
  });
 }

 // إذا لم يتم العثور على أي قناة
 res.render("search", {
  result: null,
  query: channelName,
  error: "لم يتم العثور على القناة.",
  suggestions: []
 });
});


// تشغيل التطبيق
async function main() {
 await connectToDatabase();
}

main();