"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  User,
  MapPin,
  Save,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { LocationPicker, type PickedLocation } from "@/components/ui/location-picker";
import { Button } from "@/components/ui/button";
import {
  useAddresses,
  useCreateAddress,
  useCustomerProfile,
  useDeleteAddress,
  useSetDefaultAddress,
  useUpdateCustomerProfile,
  type CustomerAddress,
} from "@/hooks/useCustomer";

/**
 * Customer profile + saved-addresses screen.
 *
 * Top half = profile completion / update (firstName, lastName, dateOfBirth,
 * GPS-picked locationLat/Lng). Bottom half = address book CRUD using the
 * same LocationPicker. Both auth via JWT in localStorage (sufra_token).
 */
export default function ProfilePage() {
  const { data: profile, isLoading } = useCustomerProfile();
  const updateProfile = useUpdateCustomerProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaved, setFormSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setDateOfBirth(profile.dateOfBirth ?? "");
    if (profile.locationLat != null && profile.locationLng != null) {
      setPicked({
        lat: Number(profile.locationLat),
        lng: Number(profile.locationLng),
        city: "",
        street: "",
      });
    }
  }, [profile]);

  function saveProfile() {
    setFormError(null);
    setFormSaved(false);
    if (!firstName.trim() || !lastName.trim()) {
      setFormError("الاسم الأول واسم العائلة مطلوبان.");
      return;
    }
    if (!picked) {
      setFormError("الرجاء تحديد موقعك على الخريطة أولاً.");
      return;
    }
    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth || undefined,
        locationLat: picked.lat,
        locationLng: picked.lng,
      },
      {
        onSuccess: () => setFormSaved(true),
        onError: (e: unknown) =>
          setFormError(e instanceof Error ? e.message : "تعذّر الحفظ."),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-7 h-7 animate-spin text-[#1f8a5b]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-black text-gray-900">حسابي</h1>
          <p className="text-sm text-gray-500 mt-1">
            أكمل بياناتك وأضف عناوينك المحفوظة لتسهيل الطلب لاحقاً.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Profile card */}
        <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <User className="w-4 h-4 text-[#1f8a5b]" />
            </span>
            <h2 className="text-base font-bold">البيانات الشخصية</h2>
            {profile?.profileCompleted && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                مكتمل
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="الاسم الأول">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="مثال: محمد"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1f8a5b]"
              />
            </Field>
            <Field label="اسم العائلة">
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="مثال: السالم"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1f8a5b]"
              />
            </Field>
            <Field label="تاريخ الميلاد (اختياري)" className="sm:col-span-2">
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1f8a5b]"
              />
            </Field>
          </div>

          <div className="mt-5">
            <p className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#1f8a5b]" />
              موقعي على الخريطة
            </p>
            <p className="text-xs text-gray-500 mb-3">
              اضغط زر «استخدم موقعي الحالي» للحصول على الإحداثيات من جهازك، أو اسحب
              الدبوس لتحديد موقع آخر.
            </p>
            <LocationPicker
              value={picked ? { lat: picked.lat, lng: picked.lng } : null}
              onChange={setPicked}
            />
          </div>

          {formError && (
            <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}
          {formSaved && !formError && (
            <div className="mt-4 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>تم حفظ بياناتك بنجاح.</span>
            </div>
          )}

          <Button
            onClick={saveProfile}
            disabled={updateProfile.isPending}
            className="mt-5 w-full sm:w-auto"
          >
            {updateProfile.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ البيانات
          </Button>
        </section>

        {/* Addresses */}
        <AddressesSection />
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function AddressesSection() {
  const { data: addresses, isLoading } = useAddresses();
  const create = useCreateAddress();
  const setDefault = useSetDefaultAddress();
  const remove = useDeleteAddress();

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleLocationPick(loc: PickedLocation) {
    setPicked(loc);
    // Pre-fill the text fields from Mapbox's reverse-geocode result so the
    // user only has to fix it if they want to.
    if (loc.city) setCity(loc.city);
    if (loc.street) setStreet(loc.street);
  }

  function submit() {
    setError(null);
    if (!street.trim()) return setError("اسم الشارع مطلوب.");
    if (!picked) return setError("الرجاء تحديد موقع العنوان على الخريطة.");
    create.mutate(
      {
        label: label.trim() || undefined,
        street: street.trim(),
        city: city.trim() || undefined,
        lat: picked.lat,
        lng: picked.lng,
      },
      {
        onSuccess: () => {
          setAdding(false);
          setLabel("");
          setStreet("");
          setCity("");
          setPicked(null);
        },
        onError: (e: unknown) =>
          setError(e instanceof Error ? e.message : "تعذّر حفظ العنوان."),
      },
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-[#1f8a5b]" />
        </span>
        <h2 className="text-base font-bold">العناوين المحفوظة</h2>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setAdding((a) => !a)}
        >
          <Plus className="w-4 h-4" />
          {adding ? "إلغاء" : "إضافة عنوان"}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
        </div>
      ) : addresses && addresses.length > 0 ? (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <AddressRow
              key={a.id}
              address={a}
              onSetDefault={() => setDefault.mutate(a.id)}
              onDelete={() => {
                if (confirm("هل أنت متأكد من حذف هذا العنوان؟")) remove.mutate(a.id);
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 text-center py-6">
          لا توجد عناوين محفوظة بعد.
        </p>
      )}

      {adding && (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-4 bg-gray-50/60 space-y-3">
          <Field label="تسمية العنوان (اختياري)">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="مثال: المنزل، العمل"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1f8a5b]"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="الشارع/الحي">
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="مثال: شارع الرشيد"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1f8a5b]"
              />
            </Field>
            <Field label="المدينة">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="مثال: غزة"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1f8a5b]"
              />
            </Field>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">
              الموقع الجغرافي
            </p>
            <LocationPicker
              value={picked ? { lat: picked.lat, lng: picked.lng } : null}
              onChange={handleLocationPick}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button onClick={submit} disabled={create.isPending} className="w-full sm:w-auto">
            {create.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ العنوان
          </Button>
        </div>
      )}
    </section>
  );
}

function AddressRow({
  address,
  onSetDefault,
  onDelete,
}: {
  address: CustomerAddress;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-xl border border-gray-200 p-3 flex items-start gap-3">
      <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-50 flex items-center justify-center mt-0.5">
        <MapPin className="w-4 h-4 text-[#1f8a5b]" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-gray-900">
            {address.label || "بدون تسمية"}
          </p>
          {address.isDefault && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
              <Star className="w-2.5 h-2.5 fill-current" />
              افتراضي
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-0.5">
          {[address.city, address.street].filter(Boolean).join("، ") || "—"}
        </p>
        <p className="text-[11px] text-gray-400 font-mono mt-0.5" dir="ltr">
          {Number(address.lat).toFixed(5)}, {Number(address.lng).toFixed(5)}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {!address.isDefault && (
          <button
            onClick={onSetDefault}
            className="text-xs font-semibold text-gray-600 hover:text-[#1f8a5b] px-2 py-1"
          >
            تعيين كافتراضي
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs font-semibold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 px-2 py-1 rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف
        </button>
      </div>
    </li>
  );
}
