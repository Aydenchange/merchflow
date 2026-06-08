import { useState } from "react";
import type { EventTone, TimelineEvent } from "../components/event-stream";

export function useTimelineEvents() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  function pushEvent(tone: EventTone, title: string, detail: string) {
    setEvents((current) => [
      {
        id: `${Date.now()}_${current.length}`,
        tone,
        title,
        detail,
      },
      ...current,
    ]);
  }

  function resetEvents() {
    setEvents([]);
  }

  return {
    events,
    pushEvent,
    resetEvents,
  };
}
