"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp, selectedPerson } from "@/lib/store";
import { api, arDate, todayStr } from "@/lib/api";
import { Button, Card, EmptyState, Field, Input, Modal, Spinner, Textarea, toast } from "@/components/ui";

interface LabFile {
  id: string;
  type: string;
  date: string;
  fileName: string | null;
  fileDataUrl: string | null;
  notes: string | null;
  createdAt: string;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

export default function LabsPage() {
  const state = useApp();
  const person = selectedPerson(state);
  const [labs, setLabs] = useState<LabFile[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!person) return;
    try {
      const r = await api<LabFile[]>(`/api/labs?personId=${person.id}`);
      setLabs(r);
    } catch {
      setLabs([]);
    }
  }, [person]);

  useEffect(() => {
    load();
  }, [load]);

  if (!person) return <Spinner />;
  if (labs === null) return <Spinner />;

  async function del(lab: LabFile) {
    if (!window.confirm(`هل تريد حذف «${lab.type}» نهائياً؟`)) return;
    setDeletingId(lab.id);
    try {
      await api(`/api/labs/${lab.id}`, { method: "DELETE" });
      toast("تم حذف الملف");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الحذف", "err");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">الملفات الطبية والفحوصات</h1>
          <p className="text-sm muted">ملفات {person.nameAr} الطبية — تحاليل، أشعة، تقارير</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>+ إضافة ملف</Button>
      </div>

      {labs.length === 0 ? (
        <EmptyState title="لا توجد ملفات طبية بعد" hint="أضِف تحليل الدم أو الأشعة أو تقرير الطبيب ليكون متاحاً في أي وقت" />
      ) : (
        <div className="space-y-2">
          {labs.map((lab) => (
            <Card key={lab.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{lab.type}</span>
                  <span className="text-xs muted">{arDate(lab.date)}</span>
                </div>
                {lab.notes && <p className="mt-1 text-sm">{lab.notes}</p>}
                {lab.fileName && (
                  <p className="mt-1 truncate text-xs muted">📎 {lab.fileName}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {lab.fileDataUrl && (
                  <Button size="sm" variant="outline" onClick={() => window.open(lab.fileDataUrl as string, "_blank")}>
                    عرض
                  </Button>
                )}
                <Button size="sm" variant="danger" disabled={deletingId === lab.id} onClick={() => del(lab)}>
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddLabModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        personId={person.id}
        busy={busy}
        setBusy={setBusy}
        onSaved={async () => {
          setAddOpen(false);
          await load();
        }}
      />
    </div>
  );
}

function AddLabModal({
  open,
  onClose,
  personId,
  busy,
  setBusy,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = useState("");
  const [date, setDate] = useState(todayStr(0));
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);

  function reset() {
    setType("");
    setDate(todayStr(0));
    setNotes("");
    setFileName(null);
    setFileDataUrl(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFileName(null);
      setFileDataUrl(null);
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast("حجم الملف أكبر من ٢ ميجابايت — اختر ملفاً أصغر", "err");
      e.target.value = "";
      setFileName(null);
      setFileDataUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(f.name);
      setFileDataUrl(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => {
      toast("تعذر قراءة الملف", "err");
    };
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!type.trim()) {
      toast("اكتب نوع الملف (مثال: تحليل دم)", "err");
      return;
    }
    setBusy(true);
    try {
      await api("/api/labs", {
        method: "POST",
        body: {
          personId,
          type: type.trim(),
          date,
          fileName,
          fileDataUrl,
          notes: notes.trim() || null,
        },
      });
      toast("تم حفظ الملف الطبي ✅");
      reset();
      await onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الحفظ", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة ملف طبي">
      <div className="space-y-3">
        <Field label="نوع الملف" hint="مثال: تحليل دم، أشعة، تقرير طبيب">
          <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="تحليل دم" />
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="ملاحظات">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية (اختياري)" />
        </Field>
        <Field label="الملف (اختياري)" hint="حتى ٢ ميجابايت — صورة أو PDF">
          <Input type="file" accept="image/*,application/pdf" onChange={onFile} />
        </Field>
        {fileName && <p className="text-xs muted">📎 {fileName}</p>}
        <div className="flex gap-2 pt-1">
          <Button onClick={submit} disabled={busy} className="flex-1">
            {busy ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}
