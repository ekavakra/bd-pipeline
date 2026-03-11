/**
 * Google Calendar Service
 *
 * Meeting scheduling and sync via Google Calendar API.
 */

import { logger } from '../config/logger.js';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export const googleCalendarService = {
  /**
   * Create a Google Calendar event.
   * Requires OAuth2 access token (per-user).
   */
  async createEvent(
    accessToken: string,
    event: {
      summary: string;
      description?: string;
      startTime: string;
      endTime: string;
      attendees?: string[];
      calendarId?: string;
    },
  ): Promise<{ eventId: string; htmlLink: string } | null> {
    const calendarId = event.calendarId ?? 'primary';

    try {
      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.startTime, timeZone: 'UTC' },
            end: { dateTime: event.endTime, timeZone: 'UTC' },
            attendees: event.attendees?.map((email) => ({ email })),
            conferenceData: {
              createRequest: { requestId: `bd-pipeline-${Date.now()}` },
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Google Calendar API error: ${response.status}`);
      }

      const data = (await response.json()) as { id: string; htmlLink: string };
      logger.info({ eventId: data.id }, 'Google Calendar event created');

      return { eventId: data.id, htmlLink: data.htmlLink };
    } catch (error) {
      logger.error({ error }, 'Google Calendar event creation failed');
      return null;
    }
  },

  /**
   * List upcoming events for a user.
   */
  async listUpcoming(accessToken: string, maxResults: number = 10) {
    try {
      const now = new Date().toISOString();
      const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events?timeMin=${now}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error(`Google Calendar API error: ${response.status}`);

      const data = (await response.json()) as {
        items: Array<{ id: string; summary: string; start: { dateTime: string }; htmlLink: string }>;
      };

      return data.items ?? [];
    } catch (error) {
      logger.error({ error }, 'Failed to list Google Calendar events');
      return [];
    }
  },
};
