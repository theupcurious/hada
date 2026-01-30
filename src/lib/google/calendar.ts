/**
 * Google Calendar API utilities
 * Wrapper around Google Calendar REST API
 * Documentation: https://developers.google.com/calendar/api/v3/reference
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  htmlLink?: string;
  hangoutLink?: string;
  status?: string;
}

export interface ListEventsParams {
  timeMin?: string; // ISO 8601 datetime
  timeMax?: string; // ISO 8601 datetime
  maxResults?: number;
  orderBy?: "startTime" | "updated";
  singleEvents?: boolean;
  q?: string; // Search query
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  start: string; // ISO 8601 datetime
  end: string; // ISO 8601 datetime
  location?: string;
  attendees?: string[]; // Email addresses
  timeZone?: string;
}

export interface UpdateEventParams {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
}

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * List calendar events
 */
export async function listCalendarEvents(
  accessToken: string,
  params: ListEventsParams = {}
): Promise<CalendarEvent[]> {
  const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`);

  // Set default parameters
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  // Add custom parameters
  if (params.timeMin) url.searchParams.set("timeMin", params.timeMin);
  if (params.timeMax) url.searchParams.set("timeMax", params.timeMax);
  if (params.maxResults) url.searchParams.set("maxResults", params.maxResults.toString());
  if (params.q) url.searchParams.set("q", params.q);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendar events: ${error}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Get a single calendar event by ID
 */
export async function getCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<CalendarEvent> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get calendar event: ${error}`);
  }

  return response.json();
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  accessToken: string,
  params: CreateEventParams
): Promise<CalendarEvent> {
  const event = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: {
      dateTime: params.start,
      timeZone: params.timeZone || "UTC",
    },
    end: {
      dateTime: params.end,
      timeZone: params.timeZone || "UTC",
    },
    attendees: params.attendees?.map((email) => ({ email })),
  };

  const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar event: ${error}`);
  }

  return response.json();
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  params: UpdateEventParams
): Promise<CalendarEvent> {
  // First get the existing event to preserve fields we're not updating
  const existingEvent = await getCalendarEvent(accessToken, eventId);

  const updatedEvent = {
    summary: params.summary ?? existingEvent.summary,
    description: params.description ?? existingEvent.description,
    location: params.location ?? existingEvent.location,
    start: params.start
      ? {
          dateTime: params.start,
          timeZone: params.timeZone || existingEvent.start.timeZone || "UTC",
        }
      : existingEvent.start,
    end: params.end
      ? {
          dateTime: params.end,
          timeZone: params.timeZone || existingEvent.end.timeZone || "UTC",
        }
      : existingEvent.end,
    attendees: params.attendees
      ? params.attendees.map((email) => ({ email }))
      : existingEvent.attendees,
  };

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedEvent),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update calendar event: ${error}`);
  }

  return response.json();
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete calendar event: ${error}`);
  }
}

/**
 * Check availability - find free time slots
 */
export async function checkAvailability(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  durationMinutes: number
): Promise<Array<{ start: string; end: string }>> {
  // Get all events in the time range
  const events = await listCalendarEvents(accessToken, {
    timeMin,
    timeMax,
  });

  // Find gaps between events
  const freeSlots: Array<{ start: string; end: string }> = [];
  const durationMs = durationMinutes * 60 * 1000;

  let currentTime = new Date(timeMin);
  const endTime = new Date(timeMax);

  for (const event of events) {
    const eventStart = new Date(event.start.dateTime);

    // Check if there's a gap before this event
    if (eventStart.getTime() - currentTime.getTime() >= durationMs) {
      freeSlots.push({
        start: currentTime.toISOString(),
        end: new Date(Math.min(eventStart.getTime(), endTime.getTime())).toISOString(),
      });
    }

    currentTime = new Date(event.end.dateTime);
  }

  // Check if there's time after the last event
  if (endTime.getTime() - currentTime.getTime() >= durationMs) {
    freeSlots.push({
      start: currentTime.toISOString(),
      end: endTime.toISOString(),
    });
  }

  return freeSlots;
}
