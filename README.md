# Chat

غرف دردشة فورية بدون تسجيل.

## ما تم بناؤه

- إنشاء غرفة برقم فريد من 8 أحرف/أرقام.
- مشاركة رابط مثل `?room=XXXXXXXX`.
- الانضمام برقم الغرفة أو بالرابط.
- اسم مؤقت محفوظ على الجهاز، بدون حساب.
- رسائل Realtime عبر Supabase.
- قائمة أعضاء الغرفة.
- نسخ كود الغرفة ومشاركة الرابط.
- وضع تجريبي محلي عندما لا تكون إعدادات Supabase موجودة.
- تصميم متجاوب للجوال والكمبيوتر.

## تفعيل الغرف بين الأجهزة

1. أنشئ مشروعًا في Supabase.
2. افتح SQL Editor.
3. شغّل كامل ملف `rooms.sql` الموجود في هذا المستودع.
4. من Project Settings انسخ Project URL ومفتاح `anon`/publishable.
5. ضع القيم في `supabase-config.js`:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY';
```

لا تضع `service_role` أو أي مفتاح سري في هذا الملف؛ هذا المستودع يعمل على GitHub Pages.

## GitHub Pages

بعد رفع الملفات إلى `main`، اجعل GitHub Pages يعمل من الفرع `main` ومن مجلد `/root`.

الرابط المتوقع:

`https://yasinaa2026-hash.github.io/chat/`

## ملاحظة مهمة

الإصدار الحالي لا يتطلب تسجيلًا. حماية البيانات تعتمد على كود الغرفة العشوائي وقواعد Supabase في `rooms.sql`. يمكن إضافة مصادقة اختيارية لاحقًا دون تغيير واجهة الغرف الأساسية.
