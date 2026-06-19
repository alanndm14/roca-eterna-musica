import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Field";

export function EditableTextOptions({ title, description, values = [], onChange, placeholder }) {
  const items = Array.isArray(values) ? values : [];
  const update = (index, value) => onChange(items.map((item, current) => current === index ? value : item));
  const remove = (index) => onChange(items.filter((_, current) => current !== index));
  return (
    <section className="rounded-2xl border border-ink/10 bg-ink/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <h3 className="font-bold text-ink">{title}</h3>
      {description ? <p className="mt-1 text-sm leading-6 text-ink/55">{description}</p> : null}
      <div className="mt-4 grid gap-2">
        {items.map((item, index) => (
          <div key={`${index}-${item}`} className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
            <Input value={item} onChange={(event) => update(index, event.target.value)} placeholder={placeholder} />
            <Button variant="danger" className="h-10 w-10 px-0" onClick={() => remove(index)} aria-label={`Eliminar ${item || "opción"}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="secondary" className="mt-3" onClick={() => onChange([...items, ""])}>
        <Plus className="h-4 w-4" />
        Agregar opción
      </Button>
    </section>
  );
}

export function EditableServiceOptions({ values = [], onChange }) {
  const items = Array.isArray(values) ? values : [];
  const update = (index, field, value) => onChange(items.map((item, current) => current === index ? { ...item, [field]: value } : item));
  const remove = (index) => onChange(items.filter((_, current) => current !== index));
  return (
    <section className="rounded-2xl border border-ink/10 bg-ink/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
      <h3 className="font-bold text-ink">Tipos de servicio</h3>
      <p className="mt-1 text-sm leading-6 text-ink/55">Edita el nombre, horario y día habitual que aparecen al crear una programación.</p>
      <div className="mt-4 grid gap-3">
        {items.map((item, index) => (
          <div key={`${item.value || "service"}-${index}`} className="grid gap-2 rounded-xl border border-ink/10 bg-white/70 p-3 dark:border-white/10 dark:bg-zinc-950/50 md:grid-cols-[minmax(150px,1fr)_110px_150px_120px_40px]">
            <Input value={item.label || ""} onChange={(event) => update(index, "label", event.target.value)} placeholder="Nombre del servicio" />
            <Input type="time" value={item.time || ""} onChange={(event) => update(index, "time", event.target.value)} />
            <Select value={item.weekday ?? ""} onChange={(event) => update(index, "weekday", event.target.value === "" ? null : Number(event.target.value))}>
              <option value="">Sin día fijo</option>
              <option value="0">Domingo</option>
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
            </Select>
            <Select value={item.special ? "special" : "normal"} onChange={(event) => update(index, "special", event.target.value === "special")}>
              <option value="normal">Normal</option>
              <option value="special">Especial</option>
            </Select>
            <Button variant="danger" className="h-10 w-10 px-0" onClick={() => remove(index)} aria-label={`Eliminar ${item.label || "servicio"}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        className="mt-3"
        onClick={() => onChange([...items, { value: `servicio-${Date.now()}`, label: "", time: "", weekday: null, special: false }])}
      >
        <Plus className="h-4 w-4" />
        Agregar tipo
      </Button>
    </section>
  );
}
