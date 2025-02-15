    // إنشاء عنصر div لعرض رسالة عدم الاتصال
            const offlineMessage = document.createElement("div");
            offlineMessage.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #ff4444;
        color: white;
        text-align: left;
        padding: 1rem;
        font-size: 1rem;
        z-index: 9999;
        display: none;
        direction: rtl;
        zoom: 1.3;
    `;
            offlineMessage.textContent =
                "لا يتوفر اتصال بالإنترنت. يرجى التحقق من الشبكة الخاصة بك.";
            document.body.appendChild(offlineMessage);

            // دالة لعرض رسالة التحذير
            function showOfflineMessage() {
                offlineMessage.style.display = "block";
                setTimeout(() => {
                    offlineMessage.style.display = "none";
                }, 3000);
            }

            // دالة للتحقق من اتصال الإنترنت الفعلي عن طريق الوصول إلى رابط خارجي
            function checkRealInternetConnection() {
                return fetch("https://www.google.com", {
                    method: "HEAD",
                    mode: "no-cors" // لمنع تحميل المحتوى بالكامل
                })
                    .then(response => {
                        // إذا كان هناك استجابة من الخادم، فهذا يعني أن هناك اتصال بالإنترنت
                        return true;
                    })
                    .catch(() => {
                        // إذا فشل الاتصال، فهذا يعني أنه لا يوجد اتصال بالإنترنت
                        return false;
                    });
            }

            // دالة التحقق من الإنترنت قبل الانتقال إلى الرابط
            async function checkInternetBeforeNavigate(event) {
                const isConnected = await checkRealInternetConnection();
                if (!isConnected) {
                    event.preventDefault(); // منع التفاعل إذا لم يكن هناك اتصال حقيقي
                    showOfflineMessage(); // عرض رسالة عدم الاتصال
                    return false;
                }
                return true;
            }

            // حماية الروابط من التفاعل في حالة عدم وجود الإنترنت
            function protectLinks() {
                document.querySelectorAll("a").forEach(link => {
                    if (!link.hasAttribute("data-protected")) {
                        link.setAttribute("data-protected", "true");

                        // إضافة مستمع حدث للنقر على الرابط
                        link.addEventListener("click", function (e) {
                            return checkInternetBeforeNavigate(e);
                        });
                    }
                });
            }

            // التحقق من حالة الاتصال بالإنترنت عند تحميل الصفحة
            function checkInternetConnection() {
                checkRealInternetConnection().then(isConnected => {
                    if (!isConnected) {
                        showOfflineMessage(); // عرض رسالة عدم الاتصال إذا لم يكن هناك اتصال فعلي
                    } else {
                        offlineMessage.style.display = "none"; // إخفاء الرسالة إذا كان الاتصال موجودًا
                    }
                });
            }

            // مراقبة التغييرات في DOM للروابط الجديدة
            const observer = new MutationObserver(() => protectLinks());

            // بدء مراقبة التغييرات في DOM
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // إعداد مراقبي حالة الاتصال
            window.addEventListener("online", checkInternetConnection);
            window.addEventListener("offline", checkInternetConnection);

            // التطبيق الأولي
            document.addEventListener("DOMContentLoaded", () => {
                protectLinks(); // حماية الروابط بعد تحميل DOM
                checkInternetConnection(); // التحقق من الاتصال بعد التحميل
            });

            // التطبيق بعد تحميل AJAX
            window.addEventListener("load", protectLinks);

            // اعتراض عمليات التنقل
            window.addEventListener("beforeunload", function (e) {
                checkRealInternetConnection().then(isConnected => {
                    if (!isConnected) {
                        e.preventDefault();
                        showOfflineMessage();
                        return false;
                    }
                });
            });

            // التحقق من الاتصال وفتح الرابط
            function checkInternetAndOpenLink(url) {
                checkRealInternetConnection().then(isConnected => {
                    if (isConnected) {
                        try {
                            window.location.href = url; // فتح الرابط إذا كان الاتصال موجودًا
                        } catch (error) {
                            alert("حدث خطأ أثناء محاولة فتح الرابط.");
                        }
                    } else {
                        alert(
                            "لا يتوفر اتصال بالإنترنت. يرجى التحقق من الشبكة الخاصة بك."
                        );
                    }
                });
            }

            // إضافة مستمع للنقر على جميع الأزرار
            document.querySelectorAll(".open-link").forEach(button => {
                button.addEventListener("click", () => {
                    const url = button.getAttribute("data-ur"); // استخراج الرابط من data-ur
                    checkInternetAndOpenLink(url); // تحقق من الاتصال وفتح الرابط
                });
            });