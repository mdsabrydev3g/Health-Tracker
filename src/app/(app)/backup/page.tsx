"use client";

import { useRef, useState } from "react";
import { api, todayStr } from "@/lib/api";
import { Button, Card, Modal, Spinner, toast } from "@/components/ui";

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function downloadBackup() {
    setBusy(true);
    try {
      const dump = await api<Record<string, unknown>>("/api/backup");
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-tracker-backup-${todayStr(0)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("تم تنزيل النسخة الاحتياطية");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ", "err");
    } finally {
      setBusy(false);
    }
  }

  function onPickFile() {
    fileRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        toast("الملف غير صالح", "err");
        return;
      }
      setPendingRestore(parsed as Record<string, unknown>);
    } catch {
      toast("تعذّرت قراءة الملف — تأكدي أنه ملف JSON صحيح", "err");
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      const r = await api<{ inserted: number }>("/api/backup", { method: "POST", body: pendingRestore });
      toast(`تمت الاستعادة — أُضيفت ${r.inserted} سجلاً`);
      setPendingRestore(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ", "err");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">النسخ الاحتياطي</h1>
        <p className="text-sm muted">حماية بيانات العائلة</p>
      </div>

      <Card>
        <p className="font-bold">ما هي النسخة الاحتياطية؟</p>
        <p className="mt-1 text-sm muted">
          النسخ الاحتياطي يصدّر كل البيانات كملف JSON محمي بإصدار المخطط. احتفظي بالملف في مكان آمن،
          ويمكنك استعادته في أي وقت على هذا الجهاز أو جهاز آخر.
        </p>
      </Card>

      <div className="space-y-2">
        <Button size="lg" className="w-full" disabled={busy} onClick={downloadBackup}>
          تنزيل نسخة احتياطية
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={onPickFile}>
          استعادة من ملف
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFileChosen} />
      </div>

      <Card className="bg-amber-50 dark:bg-amber-900/20">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          ملاحظة: الاستعادة تضيف السجلات غير الموجودة فقط، ولا تحذف أو تستبدل أي بيانات حالية.
        </p>
      </Card>

      <Modal open={pendingRestore !== null} onClose={() => setPendingRestore(null)} title="تأكيد الاستعادة">
        <p className="text-sm">
          الاستعادة تضيف السجلات غير الموجودة فقط ولن تستبدل البيانات الحالية. تأكيد؟
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setPendingRestore(null)}>
            إلغاء
          </Button>
          <Button disabled={restoring} onClick={confirmRestore}>
            {restoring ? <Spinner /> : "تأكيد"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
