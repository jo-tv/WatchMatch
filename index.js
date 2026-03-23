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
      "mongodb+srv://josefuccef7:gHkpeNOLUzOvawuh@cluster0.qmwgw.mongodb.net/alldata?retryWrites=true&w=majority&appName=Cluster0"
    );

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
      const existingChannel = await Channel.findOne({
        name: channel.name
      });
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
  // نكتشف إذا الوقت يحتوي على AM أو PM
  const ampmMatch = time.match(/\s?(AM|PM)$/i);
  const ampm = ampmMatch ? ampmMatch[1].toUpperCase() : null;

  // إزالة AM/PM لتحويل الوقت إلى صيغة رقمية
  const timeWithoutAmPm = time.replace(/\s?(AM|PM)$/i, "");
  let [hours, minutes] = timeWithoutAmPm
    .split(":")
    .map(num => parseInt(num, 10));

  if (isNaN(hours) || isNaN(minutes)) {
    console.error("Invalid time value:", time);
    return time; // إذا كانت القيمة غير صالحة، أعد الوقت الأصلي
  }

  // تحويل الوقت إلى صيغة 24 ساعة إذا كان PM
  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  // إنقاص ساعة
  hours -= 2;
  if (hours < 0) hours += 12; // ضبط اليوم السابق إذا قلنا عن 0

  // إعادة تحويل الوقت إلى صيغة AM/PM إذا كانت موجودة
  let updatedAmPm = ampm;
  let displayHours = hours;

  if (ampm) {
    if (hours === 0) {
      displayHours = 12;
      updatedAmPm = "AM";
    } else if (hours < 12) {
      displayHours = hours;
      updatedAmPm = "AM";
    } else if (hours === 12) {
      displayHours = 12;
      updatedAmPm = "PM";
    } else {
      displayHours = hours - 12;
      updatedAmPm = "PM";
    }
  }

  const updatedHours = String(displayHours).padStart(2, "0");
  const updatedMinutes = String(minutes).padStart(2, "0");

  return updatedAmPm
    ? `${updatedHours}:${updatedMinutes} ${updatedAmPm}`
    : `${updatedHours}:${updatedMinutes}`;
}

// دالة لجلب المباريات وحفظها في قاعدة البيانات
async function fetchMatches() {
  try {
    const { data } = await axios.get("https://www.live-match.tv/");
    const $ = require("cheerio").load(data);

    const matches = [];
    const channels = await readChannelsFromDatabase();

    $(".AY_Match").each((index, element) => {
      const team1 = $(element)
        .find(".MT_Team.TM1 .TM_Name")
        .text()
        .trim();
      const team2 = $(element)
        .find(".MT_Team.TM2 .TM_Name")
        .text()
        .trim();
      const logo1 = $(element)
        .find(".MT_Team.TM1 .TM_Logo img")
        .attr("data-src");
      const logo2 = $(element)
        .find(".MT_Team.TM2 .TM_Logo img")
        .attr("data-src");
      const time = $(element).find(".MT_Time").text().trim();
      const competition = $(element)
        .find(".MT_Info ul li")
        .last()
        .text()
        .trim();
      const moaalik = $(element)
        .find(".MT_Info ul li")
        .first()
        .text()
        .trim()
        .toUpperCase();
      const status = $(element).find(".MT_Stat").text().trim();
      const channel = channels.find(ch => ch.name === moaalik);

      // تقليص ساعة من الوقت (إذا كان الوقت متاحًا)
      const updatedTime = time ? subtractOneHour(time) : time;
      console.log(updatedTime);
      matches.push({
        team1,
        team2,
        logo1,
        logo2,
        time: updatedTime, // استخدام الوقت المعدل
        competition,
        moaalik,
        status,
        link: channel ? channel.url : "رابط غير متوفر"
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
        team2: match.team2
      });
      if (!existingMatch) {
        await Match.create(match);
        console.log(
          `تمت إضافة المباراة بين ${match.team1} و ${match.team2}`
        );
      } else {
        console.log(
          `المباراة موجودة بالفعل بين ${match.team1} و ${match.team2}`
        );
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
        const {
          _id,
          team1,
          team2,
          logo1,
          logo2,
          time,
          competition,
          moaalik,
          status,
          link
        } = match;

        // 🟢 إذا لم يتم إرسال رابط جديد من صفحة التعديل، نبحث عن الرابط المناسب
        let url = link;
        if (!url || url === "رابط غير متوفر") {
          // ✅ البحث الذكي داخل Sport.json حسب أسماء القناة المتعددة
          const channel = channels.find(
            ch =>
              Array.isArray(ch.name) &&
              ch.name.some(
                alias =>
                  alias.toLowerCase().trim() ===
                  moaalik.toLowerCase().trim()
              )
          );

          if (channel) {
            if (
              Array.isArray(channel.url) &&
              channel.url.length > 1
            ) {
              // 🔹 إذا كانت القناة تحتوي على أكثر من رابط
              url = `[${channel.url
                .map(u => `"${u}"`)
                .join(",")}]`;
            } else {
              // 🔹 إذا كانت القناة تحتوي على رابط واحد
              url = Array.isArray(channel.url)
                ? channel.url[0]
                : channel.url;
            }
          } else {
            url = "رابط غير متوفر"; // لم يتم العثور على القناة
          }
        }

        // 🟢 تحديث المباراة في قاعدة البيانات
        await Match.findByIdAndUpdate(
          _id,
          {
            team1,
            team2,
            logo1,
            logo2,
            time,
            competition,
            moaalik,
            status,
            link: url
          },
          { new: true }
        );
      }

      console.log("✅ تم تحديث المباريات بنجاح في قاعدة البيانات.");
      res.redirect("/");
    } catch (error) {
      console.error("❌ خطأ أثناء تحديث المباريات:", error.message);
      res.status(500).send("حدث خطأ أثناء تحديث البيانات.");
    }
  } else {
    res.status(400).send("البيانات غير صحيحة.");
  }
});

const updateMatchStatuses = async () => {
  try {
    const matches = await Match.find({}, { _id: 1, status: 1, time: 1, order: 1 });

    if (!matches?.length) {
      console.warn("No matches found");
      return;
    }

    // توحيد التوقيت (اختر واحدة: utc أو local)
    const now = moment().utc(); 

    for (const match of matches) {
      const todayDate = moment().utc().format("YYYY-MM-DD");
      
      // تحويل وقت المباراة إلى صيغة 24 ساعة
      const matchTime24 = moment(match.time, "hh:mm A").format("HH:mm");
      let matchTime = moment(`${todayDate}T${matchTime24}`, "YYYY-MM-DDTHH:mm").utc();

      if (!matchTime.isValid()) {
        console.warn(`Invalid time for match ${match._id}`);
        continue;
      }

      // إذا كان وقت المباراة قبل الآن، نضيف يوم (للمباريات الليلية)
      if (matchTime.isBefore(now, "minute")) {
        const nextDay = matchTime.clone().add(1, "day");
        if (Math.abs(nextDay.diff(now)) < Math.abs(matchTime.diff(now))) {
          matchTime = nextDay;
        }
      }

      const timeDiff = matchTime.diff(now, "milliseconds");
      let newStatus;

      if (timeDiff > 15 * 60 * 1000) {
        newStatus = "لم تبدأ";
      } 
      else if ( timeDiff <= 15 * 60 * 1000 && timeDiff >= 0) {
        newStatus = "ستبدأ بعد قليل"; // ✅ هذا هو الإصلاح الرئيسي
      } 
      else if (timeDiff < 0 && Math.abs(timeDiff) <= 2 * 60 * 60 * 1000) {
        newStatus = "جارية";
      } 
      else if (timeDiff < -2 * 60 * 60 * 1000) {
        newStatus = "انتهت";
      }

      // حفظ التغييرات إذا تغيرت الحالة
      if (match.status !== newStatus) {
        match.status = newStatus;
        await match.save();
        console.log(`Match ${match._id} → ${newStatus}`);
      }
    }

    // تحديث الترتيب (Sort)
    const sorted = matches.sort((a, b) => {
      const statusOrder = { "جارية": 1, "ستبدأ بعد قليل": 2, "لم تبدأ": 3, "انتهت": 4 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return moment(a.time, "hh:mm A").diff(moment(b.time, "hh:mm A"));
    });

    const bulkOps = sorted.map((m, i) => ({
      updateOne: {
        filter: { _id: m._id },
        update: { $set: { order: i } }
      }
    }));

    await Match.bulkWrite(bulkOps);
    console.log("✅ Match statuses updated");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
};

function updateMatchStatus() {
  console.log("تحديث حالة المباريات...");

  // تحديث 3 مرات بفاصل 9 ثوانٍ
  for (let i = 1; i <= 3; i++) {
    setTimeout(() => {
      updateMatchStatuses();
      // استدعاء كود تحديث البيانات هنا
    }, i * 9000);
  }
}

// تشغيل الدالة كل 10 دقائق
setInterval(updateMatchStatus, 10 * 60 * 1000);

// الصفحة الرئيسية
app.get("/", async (req, res) => {
  try {
    const matches = await Match.find().sort({ order: 1 }); // ترتيب تصاعدي حسب الحقل order
    const channels = await readChannelsFromDatabase();
    res.render("index", {
      matches,
      channels,
      noMatches: matches.length === 0
    });
  } catch (error) {
    console.error("Error rendering homepage:", error.message);
    res.status(500).send("حدث خطأ أثناء معالجة الطلب.");
  }
  // استدعاء أولي عند بدء التشغيل
  updateMatchStatus();
});

// صفحة التعديل
app.get("/edit", async (req, res) => {
  const matches = await readMatchesFromDatabase();
  res.render("edit", { matches });
});

app.delete("/delete/:id", async (req, res) => {
  try {
    await Match.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send("خطأ أثناء الحذف");
  }
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
app.get("/sendNot", (req, res) => res.render("sendNotification"));

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
    results: [], // ✅ يجب أن تكون نفس الاسم
    jsonOutput: "[]", // ✅ حتى لا يعطي undefined
    query: "",
    error: null,
    suggestions: []
  });
});

// البحث عن قناة في ملف Sport.json
app.post("/search", (req, res) => {
  const { channelName } = req.body;

  // 🟡 الحالة 1: لم يُدخل المستخدم اسم القناة
  if (!channelName) {
    return res.render("search", {
      results: [],
      jsonOutput: "[]",
      query: "",
      error: "يرجى إدخال اسم القناة.",
      suggestions: []
    });
  }

  const channels = readChannelsFromFile();
  const query = channelName.trim().toLowerCase();

  // 🔍 البحث عن القنوات المطابقة
  const matchedChannels = channels.filter(channel =>
    String(channel.name).toLowerCase().includes(query)
  );

  // اقتراحات الأسماء المشابهة
  const suggestions = matchedChannels.map(channel => channel.name);

  let detailedResults = [];
  let jsonOutputArray = [];

  // 🟢 الحالة 2: توجد نتائج
  if (matchedChannels.length > 0) {
    detailedResults = matchedChannels.map(channel => {
      const urlPart = String(channel.url || "");
      const logoPart = `applogobr=${String(channel.applogobr || "")}`;
      const castValue = String(channel.cast || "false");
      const castPart = `cast=${castValue}`;

      let channelNameDisplay = String(
        channel.description_name || channel.name || "Untitled Channel"
      ).replace(/[,"]/g, "");

      const namePart = `name=${channelNameDisplay}`;

      const parts = [urlPart].filter(p => p);
      let formattedLinkRaw = parts.join("|");
      formattedLinkRaw = formattedLinkRaw.replace(
        /,(?=https?:\/\/)/g,
        '","'
      );
      formattedLinkRaw = `"${formattedLinkRaw}"`;

      jsonOutputArray.push(formattedLinkRaw);
      const formattedLinkForDisplay = `[${formattedLinkRaw}]`;

      return {
        name: String(channel.name || "Untitled"),
        formattedLink: formattedLinkForDisplay
      };
    });

    const jsonOutput = `[${jsonOutputArray.join(",\n")}]`;

    return res.render("search", {
      results: detailedResults,
      jsonOutput,
      query: channelName,
      error: null,
      suggestions
    });
  }

  // 🟥 الحالة 3: لا توجد نتائج (لكن المستخدم أدخل اسمًا)
  return res.render("search", {
    results: [],
    jsonOutput: "[]",
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
