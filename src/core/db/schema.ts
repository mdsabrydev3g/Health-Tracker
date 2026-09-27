import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  numeric,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Health Tracker — Data model
 * Single family app: one elderly managed person (cardiac patient) + one caregiver.
 * Server-authoritative: Neon Postgres is the source of truth.
 */

// ---------- People ----------
export const persons = pgTable("persons", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  dob: date("dob"),
  gender: text("gender"), // male | female
  bloodType: text("blood_type"),
  allergies: jsonb("allergies").$type<string[]>().default([]).notNull(),
  notes: text("notes"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  colorTag: text("color_tag").default("#1d6ff0"),
  timezone: text("timezone").default("Africa/Cairo").notNull(),
  isManagedUser: boolean("is_managed_user").default(false).notNull(), // الوالدة
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean("deleted").default(false).notNull(),
});

// ---------- Medications ----------
export const medications = pgTable(
  "medications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .references(() => persons.id)
      .notNull(),
    nameAr: text("name_ar").notNull(),
    nameEn: text("name_en"),
    activeIngredients: jsonb("active_ingredients").$type<string[]>().default([]).notNull(),
    strengthValue: numeric("strength_value"),
    strengthUnit: text("strength_unit"), // mg | mcg | IU | ml | g
    form: text("form").notNull().default("tablet"), // tablet|capsule|syrup|injection|drops|inhaler|patch|other
    manufacturer: text("manufacturer"),
    notes: text("notes"),
    isPrescription: boolean("is_prescription").default(false).notNull(),
    isControlled: boolean("is_controlled").default(false).notNull(),
    packExpiry: date("pack_expiry"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    foodRule: text("food_rule").default("none").notNull(), // with|before|after|emptyStomach|avoid|none
    foodRuleText: text("food_rule_text"),
    packagePrice: numeric("package_price"),
    currency: text("currency").default("EGP").notNull(),
    packageSize: integer("package_size"), // units per package
    purchasedAt: date("purchased_at"),
    doctor: text("doctor"),
    condition: text("condition"),
    status: text("status").default("active").notNull(), // active|paused|finished|discontinued
    discontinuedReason: text("discontinued_reason"),
    balanceCache: numeric("balance_cache").default("0").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deleted: boolean("deleted").default(false).notNull(),
  },
  (t) => ({ idx: index("medications_person_idx").on(t.personId) }),
);

// ---------- Schedules (supersession model: history never destroyed) ----------
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    medicationId: uuid("medication_id")
      .references(() => medications.id)
      .notNull(),
    kind: text("kind").notNull(), // daily | everyNDays | weekdays | prn | taper
    times: jsonb("times").$type<string[]>().default([]).notNull(), // "HH:mm" local
    quantityPerDose: numeric("quantity_per_dose").default("1").notNull(),
    anchorDate: date("anchor_date").notNull(),
    endDate: date("end_date"),
    weekdays: jsonb("weekdays").$type<number[]>().default([]).notNull(), // 0=Sunday..6
    intervalN: integer("interval_n"),
    prnMaxPerDay: integer("prn_max_per_day"),
    taperSteps: jsonb("taper_steps")
      .$type<{ from: string; to: string; quantityPerDose: string }[]>()
      .default([])
      .notNull(),
    activeFrom: timestamp("active_from", { withTimezone: true }).defaultNow().notNull(),
    activeTo: timestamp("active_to", { withTimezone: true }), // null = current
    supersededBy: uuid("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ idx: index("schedules_med_idx").on(t.medicationId) }),
);

// ---------- Dose events (materialised + acted) ----------
export const doseEvents = pgTable(
  "dose_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .references(() => persons.id)
      .notNull(),
    medicationId: uuid("medication_id")
      .references(() => medications.id)
      .notNull(),
    scheduleId: uuid("schedule_id")
      .references(() => schedules.id)
      .notNull(),
    scheduledAtUtc: timestamp("scheduled_at_utc", { withTimezone: true }).notNull(),
    localDay: date("local_day").notNull(),
    status: text("status").notNull().default("upcoming"), // upcoming|due|taken|missed|skipped|snoozed|cancelled
    actedAtUtc: timestamp("acted_at_utc", { withTimezone: true }),
    actedBy: text("acted_by"), // mother | caregiver | auto
    quantity: numeric("quantity").default("1").notNull(),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idem: uniqueIndex("dose_events_idem_idx").on(t.idempotencyKey),
    personDay: index("dose_events_person_day_idx").on(t.personId, t.localDay),
    sched: index("dose_events_sched_idx").on(t.scheduledAtUtc),
  }),
);

// ---------- Inventory events (append-only ledger) ----------
export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    medicationId: uuid("medication_id")
      .references(() => medications.id)
      .notNull(),
    personId: uuid("person_id")
      .references(() => persons.id)
      .notNull(),
    type: text("type").notNull(), // initial|doseTaken|manualAdd|manualRemove|purchase|correction|discontinued
    qty: numeric("qty").notNull(), // signed
    reason: text("reason"),
    prevBalance: numeric("prev_balance").notNull(),
    newBalance: numeric("new_balance").notNull(),
    doseEventId: uuid("dose_event_id"),
    deviceId: text("device_id"),
    atUtc: timestamp("at_utc", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ idx: index("inv_med_idx").on(t.medicationId) }),
);

// ---------- Clinical & logs ----------
export const labResults = pgTable("lab_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id")
    .references(() => persons.id)
    .notNull(),
  type: text("type").notNull(),
  date: date("date").notNull(),
  fileName: text("file_name"),
  fileDataUrl: text("file_data_url"), // small files inline; large files → object storage later
  summary: jsonb("summary").$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deleted: boolean("deleted").default(false).notNull(),
});

export const symptoms = pgTable("symptoms", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id")
    .references(() => persons.id)
    .notNull(),
  atUtc: timestamp("at_utc", { withTimezone: true }).defaultNow().notNull(),
  severity: integer("severity").notNull(), // 1..5
  note: text("note"),
  relatedMedicationId: uuid("related_medication_id"),
});

export const foodLogs = pgTable("food_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id")
    .references(() => persons.id)
    .notNull(),
  atUtc: timestamp("at_utc", { withTimezone: true }).defaultNow().notNull(),
  text: text("text").notNull(),
  relatedMedicationId: uuid("related_medication_id"),
});

export const recurringTests = pgTable("recurring_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  personId: uuid("person_id")
    .references(() => persons.id)
    .notNull(),
  name: text("name").notNull(),
  interval: text("interval").notNull(), // monthly|3m|6m|yearly|custom
  customDays: integer("custom_days"),
  nextDue: date("next_due").notNull(),
  lastDone: date("last_done"),
  notes: text("notes"),
});

// ---------- System ----------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actor: text("actor").notNull().default("caregiver"),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(), // create|update|delete|status
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    atUtc: timestamp("at_utc", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ idx: index("audit_entity_idx").on(t.entity, t.entityId) }),
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Person = typeof persons.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type DoseEvent = typeof doseEvents.$inferSelect;
export type InventoryEvent = typeof inventoryEvents.$inferSelect;
export type LabResult = typeof labResults.$inferSelect;
export type Symptom = typeof symptoms.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type RecurringTest = typeof recurringTests.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
