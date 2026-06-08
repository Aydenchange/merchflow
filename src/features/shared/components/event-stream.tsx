export type EventTone = "info" | "success" | "warning" | "error";

export type TimelineEvent = {
  id: string;
  tone: EventTone;
  title: string;
  detail: string;
};

export function EventStream({
  events,
  title,
  status,
}: {
  events: TimelineEvent[];
  title: string;
  status?: string;
}) {
  return (
    <section className="rounded-md border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="font-mono text-xs text-stone-500">
          {status ?? `${events.length} rows`}
        </span>
      </div>
      <div className="grid max-h-[300px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">No events</p>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="border-b border-stone-100 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-stone-950">
                  {event.title}
                </p>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${eventToneClass(
                    event.tone,
                  )}`}
                >
                  {event.tone}
                </span>
              </div>
              <p className="mt-1 break-words text-xs text-stone-600">
                {event.detail}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function eventToneClass(tone: EventTone) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-800";
    case "warning":
      return "bg-amber-50 text-amber-800";
    case "error":
      return "bg-red-50 text-red-800";
    case "info":
      return "bg-stone-100 text-stone-700";
  }
}
