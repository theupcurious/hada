"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, Video } from "lucide-react";

export interface CalendarEventCardProps {
  event: {
    id: string;
    summary: string;
    description?: string;
    start: string; // ISO 8601 datetime
    end: string; // ISO 8601 datetime
    location?: string;
    attendees?: string[];
    htmlLink?: string;
    hangoutLink?: string;
  };
  actions?: string[]; // e.g., ['reschedule', 'cancel', 'join']
  onAction?: (action: string, eventId: string) => void;
}

export function CalendarEventCard({ event, actions = [], onAction }: CalendarEventCardProps) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  // Format date and time
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isSameDay = startDate.toDateString() === endDate.toDateString();

  return (
    <Card className="border-zinc-200 dark:border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Calendar icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Event details */}
          <div className="flex-1 space-y-2">
            {/* Title */}
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              {event.summary}
            </h3>

            {/* Date and time */}
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatDate(startDate)}
              <br />
              {formatTime(startDate)} - {formatTime(endDate)}
              {!isSameDay && ` (ends ${formatDate(endDate)})`}
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Users className="h-4 w-4" />
                <span>
                  {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                {event.description}
              </p>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {actions.includes("join") && event.hangoutLink && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => window.open(event.hangoutLink, "_blank")}
                    className="gap-2"
                  >
                    <Video className="h-4 w-4" />
                    Join Meeting
                  </Button>
                )}

                {actions.includes("reschedule") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction?.("reschedule", event.id)}
                  >
                    Reschedule
                  </Button>
                )}

                {actions.includes("cancel") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAction?.("cancel", event.id)}
                  >
                    Cancel
                  </Button>
                )}

                {event.htmlLink && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(event.htmlLink, "_blank")}
                  >
                    View in Calendar
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
