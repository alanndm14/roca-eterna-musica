import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableList({ items = [], getId = (item) => item.id, onReorder, children, className = "" }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = items.map((item, index) => getId(item, index));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder?.(arrayMove(items, oldIndex, newIndex), { oldIndex, newIndex });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableListItem key={getId(item, index)} id={getId(item, index)}>
              {(dragHandleProps) => children(item, index, dragHandleProps)}
            </SortableListItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableListItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-20 opacity-90" : ""}
    >
      {children({
        ...attributes,
        ...listeners,
        "aria-label": "Arrastrar para reordenar",
        className: "inline-flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl border border-ink/10 bg-white text-ink/45 transition hover:border-brass/40 hover:text-brass active:cursor-grabbing dark:border-white/10 dark:bg-white/8"
      })}
    </div>
  );
}

export function SortableHandle(props) {
  const { className = "", ...rest } = props;
  return (
    <button type="button" {...rest} className={className}>
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
