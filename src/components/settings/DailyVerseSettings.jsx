import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { BookOpen, CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { db, isFirebaseConfigured } from "../../lib/firebase";
import { fallbackLoginVerses, getLocalDateKey, getVerseForDate } from "../../services/dailyVerses";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Field, Input, Select, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";

const emptyVerse = { text: "", reference: "", translation: "", active: true };

const normalizeSnapshot = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

export function DailyVerseSettings({ profile, logAuditEvent }) {
  const [verses, setVerses] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [editing, setEditing] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [selectedVerseId, setSelectedVerseId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!isFirebaseConfigured || !db || profile?.uid === "demo-admin") {
      setVerses(fallbackLoginVerses.map((verse) => ({ ...verse, active: true })));
      setOverrides([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [verseSnapshot, overrideSnapshot] = await Promise.all([
        getDocs(query(collection(db, "loginVerses"), orderBy("reference"))),
        getDocs(query(collection(db, "dailyVerseOverrides"), orderBy("date")))
      ]);
      setVerses(normalizeSnapshot(verseSnapshot));
      setOverrides(normalizeSnapshot(overrideSnapshot));
      setStatus("");
    } catch (error) {
      setStatus(`No se pudieron cargar los versículos: ${error?.message || "error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeVerses = useMemo(() => verses.filter((verse) => verse.active !== false), [verses]);
  const todayVerse = useMemo(
    () => getVerseForDate(verses, overrides, getLocalDateKey()),
    [overrides, verses]
  );
  const selectedDateVerse = useMemo(
    () => getVerseForDate(verses, overrides, selectedDate),
    [overrides, selectedDate, verses]
  );

  const audit = (event) => Promise.resolve(logAuditEvent?.(event)).catch(() => undefined);

  const saveVerse = async () => {
    const text = String(editing?.text || "").trim();
    const reference = String(editing?.reference || "").trim();
    if (!text || !reference) {
      setStatus("El texto y la referencia son obligatorios.");
      return;
    }
    if (!isFirebaseConfigured || !db) {
      setStatus("La administración de versículos requiere Firebase.");
      return;
    }
    const payload = {
      text,
      reference,
      translation: String(editing?.translation || "").trim(),
      active: editing?.active !== false,
      updatedAt: serverTimestamp(),
      updatedBy: profile?.uid || ""
    };
    try {
      if (editing.id) {
        await updateDoc(doc(db, "loginVerses", editing.id), payload);
        await audit({
          actionType: "verse_updated",
          entityType: "loginVerse",
          entityId: editing.id,
          entityName: reference,
          summary: `Versículo actualizado: ${reference}`,
          afterData: payload
        });
      } else {
        const created = await addDoc(collection(db, "loginVerses"), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: profile?.uid || ""
        });
        await audit({
          actionType: "verse_created",
          entityType: "loginVerse",
          entityId: created.id,
          entityName: reference,
          summary: `Versículo creado: ${reference}`,
          afterData: payload
        });
      }
      setEditing(null);
      setStatus("Versículo guardado.");
      await load();
    } catch (error) {
      setStatus(`No se pudo guardar el versículo: ${error?.message || "error desconocido"}`);
    }
  };

  const toggleVerse = async (verse) => {
    const active = verse.active === false;
    if (!active && activeVerses.length <= 1) {
      setStatus("Debe quedar al menos un versículo activo.");
      return;
    }
    try {
      await updateDoc(doc(db, "loginVerses", verse.id), {
        active,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid || ""
      });
      await audit({
        actionType: active ? "verse_activated" : "verse_deactivated",
        entityType: "loginVerse",
        entityId: verse.id,
        entityName: verse.reference,
        summary: `${active ? "Versículo activado" : "Versículo desactivado"}: ${verse.reference}`
      });
      await load();
    } catch (error) {
      setStatus(`No se pudo cambiar el estado: ${error?.message || "error desconocido"}`);
    }
  };

  const removeVerse = async (verse) => {
    if (verse.active !== false && activeVerses.length <= 1) {
      setStatus("No puedes eliminar el último versículo activo.");
      return;
    }
    if (!confirm(`¿Eliminar ${verse.reference}?`)) return;
    try {
      await deleteDoc(doc(db, "loginVerses", verse.id));
      await audit({
        actionType: "verse_deleted",
        entityType: "loginVerse",
        entityId: verse.id,
        entityName: verse.reference,
        summary: `Versículo eliminado: ${verse.reference}`
      });
      await load();
    } catch (error) {
      setStatus(`No se pudo eliminar el versículo: ${error?.message || "error desconocido"}`);
    }
  };

  const saveOverride = async () => {
    if (!selectedDate || !selectedVerseId) {
      setStatus("Selecciona una fecha y un versículo.");
      return;
    }
    try {
      await setDoc(doc(db, "dailyVerseOverrides", selectedDate), {
        date: selectedDate,
        verseId: selectedVerseId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: profile?.uid || "",
        updatedBy: profile?.uid || ""
      }, { merge: true });
      await audit({
        actionType: "daily_verse_override_created",
        entityType: "dailyVerseOverride",
        entityId: selectedDate,
        entityName: selectedDate,
        summary: `Versículo programado para ${selectedDate}`,
        afterData: { date: selectedDate, verseId: selectedVerseId }
      });
      setStatus("Versículo asignado a la fecha.");
      await load();
    } catch (error) {
      setStatus(`No se pudo programar la fecha: ${error?.message || "error desconocido"}`);
    }
  };

  const removeOverride = async (override) => {
    try {
      await deleteDoc(doc(db, "dailyVerseOverrides", override.id));
      await audit({
        actionType: "daily_verse_override_removed",
        entityType: "dailyVerseOverride",
        entityId: override.id,
        entityName: override.date,
        summary: `Asignación de versículo eliminada: ${override.date}`
      });
      await load();
    } catch (error) {
      setStatus(`No se pudo eliminar la asignación: ${error?.message || "error desconocido"}`);
    }
  };

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brass/15 text-brass">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">Versículos de inicio</h2>
              <p className="mt-1 text-sm leading-6 text-ink/55">Administra el banco público y programa fechas especiales.</p>
            </div>
          </div>
          <Button onClick={() => setEditing({ ...emptyVerse })}>
            <Plus className="h-4 w-4" />
            Agregar versículo
          </Button>
        </div>

        <div className="mt-5 rounded-2xl border border-brass/20 bg-brass/10 p-4">
          <p className="text-xs font-black uppercase tracking-wide text-brass">Versículo que se mostrará hoy</p>
          <p className="mt-2 text-lg font-semibold leading-7 text-ink">“{todayVerse?.text || fallbackLoginVerses[0].text}”</p>
          <p className="mt-2 font-bold text-brass">{todayVerse?.reference || fallbackLoginVerses[0].reference}</p>
        </div>

        <div className="mt-5 space-y-2">
          {loading ? <p className="text-sm text-ink/55">Cargando versículos...</p> : null}
          {!loading && verses.length ? verses.map((verse) => (
            <article key={verse.id} className="grid gap-3 rounded-2xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink">{verse.reference}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${verse.active === false ? "bg-ink/10 text-ink/50 dark:bg-white/10" : "bg-emerald-500/12 text-emerald-800 dark:text-emerald-100"}`}>
                    {verse.active === false ? "Inactivo" : "Activo"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink/60">{verse.text}</p>
                {verse.translation ? <p className="mt-1 text-xs font-semibold text-ink/45">{verse.translation}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="h-9 px-3 text-xs" onClick={() => setEditing(verse)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button variant="subtle" className="h-9 px-3 text-xs" onClick={() => toggleVerse(verse)}>
                  {verse.active === false ? "Activar" : "Desactivar"}
                </Button>
                <Button variant="danger" className="h-9 px-3 text-xs" onClick={() => removeVerse(verse)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </article>
          )) : null}
        </div>

        <div className="mt-6 border-t border-ink/10 pt-5 dark:border-white/10">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-brass" />
            <h3 className="font-bold text-ink">Programar versículo por fecha</h3>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
            <Field label="Fecha">
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </Field>
            <Field label="Versículo">
              <Select value={selectedVerseId} onChange={(event) => setSelectedVerseId(event.target.value)}>
                <option value="">Selección automática</option>
                {activeVerses.map((verse) => <option key={verse.id} value={verse.id}>{verse.reference}</option>)}
              </Select>
            </Field>
            <Button onClick={saveOverride}>Asignar a esta fecha</Button>
          </div>
          <div className="mt-4 rounded-xl bg-ink/5 p-3 text-sm dark:bg-white/5">
            <span className="font-bold text-ink">{selectedDate || "Fecha"}:</span>{" "}
            <span className="text-ink/60">{selectedDateVerse?.reference || "sin versículo disponible"}</span>
          </div>
          {overrides.length ? (
            <div className="mt-4 grid gap-2">
              {overrides.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((override) => {
                const verse = verses.find((item) => item.id === override.verseId);
                return (
                  <div key={override.id} className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-ink"><strong>{override.date}</strong> · {verse?.reference || "Versículo no disponible"}</p>
                    <Button variant="danger" className="h-9 px-3 text-xs" onClick={() => removeOverride(override)}>Quitar asignación</Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        {status ? <p className="mt-4 rounded-xl bg-ink/5 p-3 text-sm font-semibold text-ink/65 dark:bg-white/5">{status}</p> : null}
      </Card>

      <Modal open={Boolean(editing)} title={editing?.id ? "Editar versículo" : "Agregar versículo"} onClose={() => setEditing(null)}>
        <div className="space-y-4">
          <Field label="Texto del versículo">
            <Textarea value={editing?.text || ""} onChange={(event) => setEditing((current) => ({ ...current, text: event.target.value }))} />
          </Field>
          <Field label="Referencia">
            <Input value={editing?.reference || ""} onChange={(event) => setEditing((current) => ({ ...current, reference: event.target.value }))} placeholder="Salmo 96:1" />
          </Field>
          <Field label="Traducción (opcional)">
            <Input value={editing?.translation || ""} onChange={(event) => setEditing((current) => ({ ...current, translation: event.target.value }))} placeholder="RVR1960" />
          </Field>
          <Field label="Estado">
            <Select value={editing?.active === false ? "inactive" : "active"} onChange={(event) => setEditing((current) => ({ ...current, active: event.target.value === "active" }))}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="subtle" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveVerse}>Guardar versículo</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
