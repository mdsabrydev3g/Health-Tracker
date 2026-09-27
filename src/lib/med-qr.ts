import { FORM_AR } from "@/components/ui";

/**
 * QR payload contract for medications (printed on boxes by the caregiver).
 * Compact JSON, versioned, Arabic-safe:
 * {"v":1,"app":"health-tracker","n":"كونكور 5","en":"Concor 5","s":"5","u":"mg",
 *  "f":"tablet","q":"1","t":["08:00","20:00"],"food":"before","doc":"د. فلان"}
 */

export interface MedQrData {
  nameAr: string;
  nameEn?: string | null;
  strengthValue?: string | null;
  strengthUnit?: string | null;
  form?: string;
  quantityPerDose?: number;
  times?: string[];
  foodRule?: string;
  doctor?: string | null;
}

export function encodeMedQr(med: MedQrData): string {
  return JSON.stringify({
    v: 1,
    app: "health-tracker",
    n: med.nameAr,
    en: med.nameEn ?? undefined,
    s: med.strengthValue ?? undefined,
    u: med.strengthUnit ?? undefined,
    f: med.form ?? "tablet",
    q: med.quantityPerDose ?? 1,
    t: med.times ?? [],
    food: med.foodRule && med.foodRule !== "none" ? med.foodRule : undefined,
    doc: med.doctor ?? undefined,
  });
}

export function parseMedQr(text: string): MedQrData | null {
  try {
    const j = JSON.parse(text);
    if (j?.app !== "health-tracker" || !j?.n) return null;
    return {
      nameAr: String(j.n),
      nameEn: j.en ? String(j.en) : null,
      strengthValue: j.s !== undefined ? String(j.s) : null,
      strengthUnit: j.u ? String(j.u) : "mg",
      form: j.f ? String(j.f) : "tablet",
      quantityPerDose: j.q ? Number(j.q) : 1,
      times: Array.isArray(j.t) ? j.t.map(String) : [],
      foodRule: j.food ? String(j.food) : "none",
      doctor: j.doc ? String(j.doc) : null,
    };
  } catch {
    // Not a Health Tracker QR — treat any plain text as the medication name
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length <= 60) {
      return { nameAr: trimmed, form: "tablet", quantityPerDose: 1, times: [], foodRule: "none" };
    }
    return null;
  }
}

export function qrPayloadSummaryAr(med: MedQrData): string {
  const parts = [med.nameAr];
  if (med.strengthValue) parts.push(`${med.strengthValue} ${med.strengthUnit ?? ""}`);
  if (med.form) parts.push(FORM_AR[med.form] ?? med.form);
  if (med.times?.length) parts.push(`الساعة ${med.times.join("، ")}`);
  return parts.join(" · ");
}
