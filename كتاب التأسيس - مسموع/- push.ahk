#Requires AutoHotkey v2.0
#SingleInstance Force
SetWinDelay(-1)

; ==============================================================================
; مزامنة كتاب التأسيس - واجهة عائمة دائرية فائقة الفخامة والتنسيق
; ==============================================================================

MyGui := Gui("-Caption +AlwaysOnTop +ToolWindow +Owner", "مزامنة كتاب التأسيس")
MyGui.BackColor := "0x0D161B" ; خلفية داكنة فخمة متناسقة مع برامجك

; تدوير حواف النافذة بشكل دائري واحترافي بنسبة 100%
MyGui.Show("w360 h160 Hide") ; إنشاء النافذة في الخلفية أولاً للحصول على المقاسات
WinSetRegion("0-0 w360 h160 r16-16", MyGui.Hwnd)

; خطوط عربية جميلة
MyGui.SetFont("s16 w700 cWhite", "Amiri")
MyGui.Add("Text", "w360 Center y25", "مزامنة كتاب التأسيس 🚀")

MyGui.SetFont("s10 w500 c0x00D2FF", "Tajawal")
StatusText := MyGui.Add("Text", "w360 Center y+12 vStatus", "جاري تهيئة الاتصال وحفظ التغييرات...")

; شريط تقديم أنيق بلون نيوني أزرق جذاب
ProgressBar := MyGui.Add("Progress", "w300 h6 c0x00D2FF Background0x1A2A33 y+18 x30 vMyProgress", 10)

; إظهار النافذة عائمة في المنتصف تماماً
MyGui.Show("w360 h160 Center")

; ------------------------------------------------------------------------------
; ⚙️ تنفيذ عمليات Git بصمت مطبق في الخلفية وتحديث الواجهة بذكاء
; ------------------------------------------------------------------------------
Sleep(600)

; 1. رصد الملفات المضافة
StatusText.Text := "جاري رصد التغييرات الجديدة..."
ProgressBar.Value := 30
Sleep(400)
RunWait('cmd.exe /c git add .', A_ScriptDir, "Hide")

; 2. حفظ التغييرات محلياً
StatusText.Text := "جاري حفظ التعديلات محلياً..."
ProgressBar.Value := 60
Sleep(400)
RunWait('cmd.exe /c git commit -m "Auto Update"', A_ScriptDir, "Hide")

; 3. الرفع للمخدم والتحقق من النتيجة
StatusText.Text := "جاري المزامنة والرفع للمخدم..."
ProgressBar.Value := 80
Sleep(400)

; تشغيل الرفع والتقاط كود الخروج (Exit Code)
ExitCode := RunWait('cmd.exe /c git push', A_ScriptDir, "Hide")

if (ExitCode = 0) {
    ; نجاح العملية
    StatusText.SetFont("c0x00FF88") ; تغيير لون الخط للأخضر النيوني المضيء
    StatusText.Text := "تمت المزامنة وحفظ البيانات بنجاح! ✔"
    ProgressBar.Value := 100
    Sleep(1500)
    ExitApp()
} else {
    ; فشل العملية (انقطاع إنترنت أو تعارض)
    StatusText.SetFont("c0xFF4B4B") ; تغيير لون الخط للأحمر النيوني المضيء
    StatusText.Text := "فشلت المزامنة! يرجى التحقق من اتصال الإنترنت. ❌"
    ProgressBar.Value := 0
    
    ; إضافة زر إغلاق أنيق للمستخدم لكي يغلق النافذة بعد قراءة الخطأ
    MyGui.SetFont("s9 w700 cWhite", "Tajawal")
    CloseBtn := MyGui.Add("Button", "w100 h28 x130 y+12 Default", "إغلاق")
    CloseBtn.OnEvent("Click", (*) => ExitApp())
}
