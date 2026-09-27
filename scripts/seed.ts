/**
 * Seeds the database with the family's managed person (الوالدة) and a demo
 * cardiac medication set. Run: npm run db:seed
 */
import "dotenv/config";
import { getDb, schema } from "../src/core/db/client";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();

  const existing = await db.select().from(schema.persons).where(eq(schema.persons.deleted, false));
  if (existing.length > 0) {
    console.log("قاعدة البيانات تحتوي بيانات بالفعل — لن يتم الإضافة.");
    return;
  }

  const [mother] = await db
    .insert(schema.persons)
    .values({
      nameAr: "الوالدة",
      gender: "female",
      bloodType: "O+",
      allergies: ["البنسلين"],
      timezone: process.env.DEFAULT_TIMEZONE ?? "Africa/Cairo",
      isManagedUser: true,
      colorTag: "#1d6ff0",
    })
    .returning();

  const today = new Date().toISOString().slice(0, 10);
  const meds = [
    { nameAr: "كونكور 5", nameEn: "Concor 5", strengthValue: "5", strengthUnit: "mg", form: "tablet", foodRule: "before", packageSize: 30, packagePrice: "45", schedule: { kind: "daily", times: ["08:00"], quantityPerDose: 1 } },
    { nameAr: "أسبرين بروتكت 75", nameEn: "Aspirin Protect 75", strengthValue: "75", strengthUnit: "mg", form: "tablet", foodRule: "after", packageSize: 30, packagePrice: "18", schedule: { kind: "daily", times: ["14:00"], quantityPerDose: 1 } },
    { nameAr: "أتور 20", nameEn: "Ator 20", strengthValue: "20", strengthUnit: "mg", form: "tablet", foodRule: "after", packageSize: 30, packagePrice: "36", schedule: { kind: "daily", times: ["21:00"], quantityPerDose: 1 } },
    { nameAr: "نيكسيوم 40", nameEn: "Nexium 40", strengthValue: "40", strengthUnit: "mg", form: "tablet", foodRule: "emptyStomach", packageSize: 14, packagePrice: "72", schedule: { kind: "daily", times: ["07:00"], quantityPerDose: 1 } },
  ];

  for (const m of meds) {
    const [med] = await db
      .insert(schema.medications)
      .values({
        personId: mother.id,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        strengthValue: m.strengthValue,
        strengthUnit: m.strengthUnit,
        form: m.form,
        foodRule: m.foodRule,
        packageSize: m.packageSize,
        packagePrice: m.packagePrice,
        currency: "EGP",
        startDate: today,
        isPrescription: true,
        balanceCache: String(m.packageSize),
      })
      .returning();

    await db.insert(schema.inventoryEvents).values({
      medicationId: med.id,
      personId: mother.id,
      type: "initial",
      qty: String(m.packageSize),
      prevBalance: "0",
      newBalance: String(m.packageSize),
    });

    await db.insert(schema.schedules).values({
      medicationId: med.id,
      kind: m.schedule.kind,
      times: m.schedule.times,
      quantityPerDose: String(m.schedule.quantityPerDose),
      anchorDate: today,
    });
  }

  await db.insert(schema.recurringTests).values({
    personId: mother.id,
    name: "تحليل الدم الشامل",
    interval: "3m",
    nextDue: today,
  });

  console.log("تمت التهيئة: شخص واحد + 4 أدوية بجداولها + فحص دوري.");
  console.log("افتح التطبيق وسجّل الدخول بحساب مقدم الرعاية.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
