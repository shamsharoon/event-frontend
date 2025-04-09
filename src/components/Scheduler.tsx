import React, { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "./ui/card";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import {
  Clock,
  Calendar as CalendarIcon,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils"; // Make sure this import works

interface ScheduleData {
  available_slots: string[];
  recommendations: string;
  note?: string;
}

// Add interface for API response when scheduling an event
interface ScheduleEventResponse {
  status: string;
  event_id: string;
}

export default function Scheduler() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("");
  const [eventDescription, setEventDescription] = useState<string>("");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  // Fix the type for contentRefs
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Convert UTC ISO string to local date object
  const parseUtcToLocalDate = (isoString: string): Date => {
    const date = new Date(isoString);
    return date;
  };

  // Format a date for display, properly handling timezone
  const formatDate = (dateString: string): string => {
    const date = parseUtcToLocalDate(dateString);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  // Group slots by date considering local timezone
  const groupSlotsByDate = (): Record<string, string[]> => {
    if (!data?.available_slots) return {};

    const grouped: Record<string, string[]> = {};

    data.available_slots.forEach((slot) => {
      const date = parseUtcToLocalDate(slot);
      const dateKey = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);
    });

    return grouped;
  };

  // Toggle day expansion
  const toggleDayExpansion = (dateKey: string): void => {
    setExpandedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey],
    }));
  };

  const connectWithGoogle = (): void => {
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    window.open(
      "http://localhost:8000/auth",
      "googleAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const logoutFromGoogle = async (): Promise<void> => {
    try {
      const response = await fetch("http://localhost:8000/auth/logout", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        setIsAuthenticated(false);
        setSelectedSlot(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const response = await fetch("http://localhost:8000/auth/status", {
        credentials: "include",
      });

      if (response.ok) {
        const responseData = await response.json();
        setIsAuthenticated(responseData.authenticated);
      }
    } catch (error) {
      console.error("Error checking authentication status:", error);
    }
  };

  const fetchData = (): void => {
    setLoading(true);
    setError(null);

    fetch("http://localhost:8000/schedule", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`);
        }
        return res.json();
      })
      .then((responseData: ScheduleData) => {
        setData(responseData);
        setLoading(false);
      })
      .catch((err: Error) => {
        console.error("Error fetching schedule data:", err);
        setError("Failed to load schedule data. Please try again later.");
        setLoading(false);
      });
  };

  useEffect(() => {
    checkAuthStatus();
    fetchData();

    const handleMessage = (event: MessageEvent): void => {
      if (event.data === "google-auth-success") {
        checkAuthStatus();
        fetchData();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Initialize expanded state for the first day when data loads
  useEffect(() => {
    if (data?.available_slots?.length) {
      const grouped = groupSlotsByDate();
      const firstDay = Object.keys(grouped)[0];

      if (firstDay) {
        setExpandedDays((prev) => ({
          ...prev,
          [firstDay]: true,
        }));
      }
    }
  }, [data?.available_slots]);

  const handleSlotSelect = (slot: string): void => {
    setSelectedSlot(slot);

    if (isAuthenticated) {
      setShowScheduleDialog(true);
    }
  };

  const openScheduleDialog = (): void => {
    if (!isAuthenticated) {
      connectWithGoogle();
      return;
    }

    setShowScheduleDialog(true);
  };

  const scheduleEvent = async (): Promise<void> => {
    if (!selectedSlot) return;

    try {
      const response = await fetch("http://localhost:8000/schedule/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_time: selectedSlot,
          summary: eventName,
          description: eventDescription,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule event");
      }

      const result: ScheduleEventResponse = await response.json();
      alert("Event scheduled successfully!");
      setShowScheduleDialog(false);
      setSelectedSlot(null);
      setEventName("");
      setEventDescription("");
      fetchData();
    } catch (error) {
      console.error("Error scheduling event:", error);
      alert("Failed to schedule event. Please try again.");
    }
  };

  const groupedSlots = groupSlotsByDate();

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <Card className="w-full">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
            <div>
              <CardTitle className="text-3xl font-bold text-blue-900">
                Calendar Scheduler
              </CardTitle>
              <CardDescription className="text-lg text-blue-700 mt-1">
                Find and schedule optimal meeting times
              </CardDescription>
            </div>
            <div>
              {!isAuthenticated ? (
                <Button
                  onClick={connectWithGoogle}
                  size="lg"
                  className="w-full sm:w-auto flex items-center bg-blue-600 hover:bg-blue-700"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Connect Calendar
                </Button>
              ) : (
                <Button
                  onClick={logoutFromGoogle}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto flex items-center"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Log Out
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button onClick={fetchData} variant="outline" className="mt-4">
                Try Again
              </Button>
            </Alert>
          ) : data ? (
            <>
              {data.note && (
                <Alert className="mb-6">
                  <AlertDescription>{data.note}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-blue-800 flex items-center">
                    <CalendarIcon className="mr-3 h-6 w-6 text-blue-600" />
                    Available Time Slots
                  </h2>

                  {isAuthenticated && (
                    <div className="flex items-center text-sm text-green-700 font-medium">
                      <CalendarIcon className="mr-2 h-4 w-4 text-green-500" />
                      Connected
                    </div>
                  )}
                </div>

                {data.available_slots && data.available_slots.length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(groupedSlots).map(([dateKey, slots]) => (
                      <div
                        key={dateKey}
                        className="overflow-hidden border rounded-lg"
                      >
                        <div
                          className={`flex items-center justify-between p-4 cursor-pointer transition-colors duration-300 ${
                            expandedDays[dateKey]
                              ? "bg-blue-50 border-blue-200"
                              : "bg-white hover:bg-gray-50"
                          }`}
                          onClick={() => toggleDayExpansion(dateKey)}
                        >
                          <div className="flex items-center">
                            <div className="transform transition-transform duration-300 ease-in-out mr-2">
                              {expandedDays[dateKey] ? (
                                <ChevronDown className="h-5 w-5 text-blue-600" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-500" />
                              )}
                            </div>
                            <h3
                              className={`text-lg font-medium transition-colors duration-300 ${
                                expandedDays[dateKey]
                                  ? "text-blue-800"
                                  : "text-gray-800"
                              }`}
                            >
                              {new Date(dateKey).toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })}
                            </h3>
                          </div>
                          <div className="text-sm font-medium text-gray-500">
                            {slots.length} available{" "}
                            {slots.length === 1 ? "time" : "times"}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-in-out",
                            expandedDays[dateKey] && "grid-rows-[1fr]"
                          )}
                        >
                          <div className="overflow-hidden">
                            <div
                              ref={(el) => {
                                contentRefs.current[dateKey] = el;
                              }}
                              className="p-4 bg-white border-t border-gray-200"
                            >
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {slots.map((slot) => {
                                  const slotDate = parseUtcToLocalDate(slot);
                                  return (
                                    <Button
                                      key={slot}
                                      variant={
                                        selectedSlot === slot
                                          ? "default"
                                          : "outline"
                                      }
                                      className={`flex items-center justify-start h-12 w-full text-left transition-all duration-200 ${
                                        selectedSlot === slot
                                          ? "ring-2 ring-blue-500"
                                          : "hover:border-blue-300"
                                      }`}
                                      onClick={() => handleSlotSelect(slot)}
                                    >
                                      <Clock className="mr-2 h-4 w-4 flex-shrink-0" />
                                      <span className="truncate">
                                        {slotDate.toLocaleTimeString("en-US", {
                                          hour: "numeric",
                                          minute: "numeric",
                                        })}
                                      </span>
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border rounded-lg bg-gray-50">
                    <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">
                      No available slots found.
                    </p>
                  </div>
                )}

                {selectedSlot && (
                  <div className="mt-8 pt-6 border-t border-gray-200 w-full">
                    <h3 className="text-xl font-semibold mb-4 text-blue-800">
                      Selected Time
                    </h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center text-blue-800">
                        <Clock className="h-5 w-5 mr-2 text-blue-600" />
                        <span className="font-medium">
                          {formatDate(selectedSlot)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="lg"
                      className="w-full py-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 transition-colors duration-300"
                      onClick={openScheduleDialog}
                    >
                      <CalendarIcon className="mr-3 h-5 w-5" />
                      Schedule Meeting
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No data available.</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-gray-50 px-6 py-4 border-t">
          <div className="w-full flex justify-between items-center">
            <div>
              {isAuthenticated ? (
                <span className="flex items-center text-sm text-gray-600">
                  Using your primary Google Calendar
                </span>
              ) : (
                <span className="flex items-center text-sm text-gray-500">
                  Connect your calendar to view available times
                </span>
              )}
            </div>
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={logoutFromGoogle}
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <LogOut className="mr-1 h-3 w-3" />
                Switch Account
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Schedule New Event</DialogTitle>
            <DialogDescription>
              Create a calendar event for{" "}
              <span className="font-medium">
                {selectedSlot ? formatDate(selectedSlot) : ""}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Meeting with Team"
                className="w-full"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Discuss project updates and next steps"
                className="w-full min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
              className="w-full sm:w-auto transition-colors duration-200"
            >
              Cancel
            </Button>
            <Button
              onClick={scheduleEvent}
              className="w-full sm:w-auto transition-colors duration-200"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Schedule Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
