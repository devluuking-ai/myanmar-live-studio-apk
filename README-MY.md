# Live Studio APK

Termux မလိုဘဲ ဖုန်းထဲမှာပဲ run တဲ့ TikTok LIVE ဂိမ်း APK ပါ။ App ထဲမှာ Node server (Myanmar Live Studio) ပါပြီး Dashboard နဲ့ Show (overlay) နှစ်ခု ပါပါတယ်။

## သုံးနည်း

1. APK ကို install လုပ်ပြီး app ဖွင့်ပါ။ Server စတင်ပြီး Show ပေါ်လာပါမယ်။
2. **🎛 Dashboard** မှာ ဂိမ်းရွေးပါ၊ Sim နဲ့ အရင် စမ်းပါ။
3. TikTok → **+** → **LIVE** → **Mobile gaming** → **Go LIVE** အရင် စပါ။
4. Dashboard မှာ username `aicreater999` (@ မပါ) ထည့်ပြီး **TikTok ချိတ်မယ်** နှိပ်ပါ။
5. **🎮 Show** ကို နှိပ်ပြီး **⛶ အပြည့်** နှိပ်ပါ — ကြည့်သူတွေ ဂိမ်းမြင်ရပါမယ်။ Screen ကို တစ်ချက်နှိပ်ရင် ပြန်ထွက်ပါတယ်။
6. YouTube/Facebook လွှင့်ချင်ရင် **⚙ Keys** မှာ stream key ထည့်ပြီး **▶ Go Live** နှိပ်ပါ။

## မှတ်ချက်

- TikTok password / API key / license မလိုပါ။ Username နဲ့ public LIVE ကိုပဲ ဖတ်ပါတယ်။
- မြန်မာ TTS အတွက် ဖုန်းမှာ မြန်မာ voice ရှိရပါမယ်။
- Graphics က 2D ပါ။ arm64 ဖုန်းတွေအတွက်ပါ။
- Android 14+ မှာ RTMP က platform တစ်ခုပဲ လွှင့်နိုင်သေးပါတယ်။
- App server က port **3001** သုံးပါတယ် (Stage Show APK က 3000 သုံးလို့ နှစ်ခုလုံး တစ်ပြိုင်နက် ဖွင့်ထားလို့ရအောင်ပါ)။ နောက် device ကနေ Dashboard ဖွင့်ချင်ရင် Wi-Fi တူတူမှာ `http://<phone-IP>:3001/control` ကို ဖွင့်ပါ။
