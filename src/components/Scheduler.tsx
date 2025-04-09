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
  X,
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
import { cn } from "../lib/utils";
import { Calendar } from "./ui/calendar";

interface ScheduleData {
  available_slots: string[];
  recommendations: string;
  note?: string;
}

interface ScheduleEventResponse {
  status: string;
  event_id: string;
}

export default function Scheduler() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("");
  const [eventDescription, setEventDescription] = useState<string>("");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [usingRealData, setUsingRealData] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  const parseUtcToLocalDate = (isoString: string): Date => {
    const date = new Date(isoString);
    return date;
  };

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

  const formatDateOnly = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateKey = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const groupSlotsByDate = (): Record<string, string[]> => {
    if (!data?.available_slots) return {};

    const grouped: Record<string, string[]> = {};

    data.available_slots.forEach((slot) => {
      const date = parseUtcToLocalDate(slot);
      const dateKey = formatDateKey(date);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);
    });

    return grouped;
  };

  const getDatesWithSlots = (): Date[] => {
    if (!data?.available_slots) return [];

    const uniqueDates = new Set<string>();
    const dates: Date[] = [];

    data.available_slots.forEach((slot) => {
      const date = parseUtcToLocalDate(slot);
      const dateKey = formatDateKey(date);

      if (!uniqueDates.has(dateKey)) {
        uniqueDates.add(dateKey);
        dates.push(
          new Date(date.getFullYear(), date.getMonth(), date.getDate())
        );
      }
    });

    return dates;
  };

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

    // Store a reference to the popup
    const authWindow = window.open(
      "http://localhost:8000/auth",
      "googleAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    // Add polling to check if auth window is closed
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);
        checkAuthStatus().then(() => {
          if (isAuthenticated) {
            fetchData();
          }
        });
        setAuthLoading(false);
      }
    }, 500);
  };

  const logoutFromGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:8000/auth/logout", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        setIsAuthenticated(false);
        setSelectedSlot(null);
        setSelectedDate(null);
        setData(null); // Clear data on logout
        fetchData(); // Fetch fresh data
      }
    } catch (error) {
      console.error("Error logging out:", error);
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      const response = await fetch("http://localhost:8000/auth/status", {
        credentials: "include",
      });

      if (response.ok) {
        const responseData = await response.json();
        const isAuth = responseData.authenticated;
        setIsAuthenticated(isAuth);
        return isAuth;
      }
      return false;
    } catch (error) {
      console.error("Error checking authentication status:", error);
      return false;
    }
  };

  const fetchData = (): void => {
    setDataLoading(true);
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
        // Real data is being used if there's no note about mock data
        // or if authenticated (and thus definitely using real data)
        setUsingRealData(
          isAuthenticated && !responseData.note?.includes("mock")
        );
        setDataLoading(false);
      })
      .catch((err: Error) => {
        console.error("Error fetching schedule data:", err);
        setError("Failed to load schedule data. Please try again later.");
        setDataLoading(false);
      });
  };

  useEffect(() => {
    checkAuthStatus();
    fetchData();

    const handleMessage = (event: MessageEvent): void => {
      if (event.data === "google-auth-success") {
        checkAuthStatus().then(() => {
          fetchData();
          setAuthLoading(false);
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const refreshData = async () => {
      setLoading(true);
      try {
        await fetchData();
      } finally {
        setLoading(false);
        setAuthLoading(false); // Ensure auth loading ends
      }
    };

    refreshData();
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedDate) {
      const dateKey = formatDateKey(selectedDate);
      setExpandedDays((prev) => ({
        ...prev,
        [dateKey]: true,
      }));

      setSelectedSlot(null);
    }
  }, [selectedDate]);

  const handleSlotSelect = (slot: string): void => {
    setSelectedSlot(slot);

    if (isAuthenticated) {
      setShowScheduleDialog(true);
    }
  };

  const handleDateSelect = (date: Date | undefined): void => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };

  const openScheduleDialog = (): void => {
    if (!isAuthenticated) {
      setAuthLoading(true);
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

  const hasAvailableSlots = (date: Date): boolean => {
    // Disable calendar while loading or if using mock data right after auth
    if (loading || dataLoading || (authLoading && !usingRealData)) {
      return false;
    }

    const dateKey = formatDateKey(date);
    const groupedSlots = groupSlotsByDate();

    // If authenticated but no slots are returned yet, consider allowing weekdays
    if (
      isAuthenticated &&
      usingRealData &&
      (!data?.available_slots || data.available_slots.length === 0)
    ) {
      const isWeekday = date.getDay() > 0 && date.getDay() < 6;
      const isInFutureRange =
        date >= new Date() &&
        date <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      return isWeekday && isInFutureRange;
    }

    return !!groupedSlots[dateKey] && groupedSlots[dateKey].length > 0;
  };

  const getSlotsForSelectedDate = (): string[] => {
    if (!selectedDate) return [];

    const dateKey = formatDateKey(selectedDate);
    const groupedSlots = groupSlotsByDate();
    return groupedSlots[dateKey] || [];
  };

  const availableDates = getDatesWithSlots();

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <Card className="w-full">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
            <div>
              <CardTitle className="text-3xl font-bold text-blue-900">
                Nexus Events
              </CardTitle>
              <CardDescription className="text-lg text-blue-700 mt-1">
                Find and schedule optimal meeting times
              </CardDescription>
            </div>
            <div>
              {!isAuthenticated ? (
                <Button
                  onClick={() => {
                    setAuthLoading(true);
                    connectWithGoogle();
                  }}
                  size="lg"
                  className="w-full sm:w-auto flex items-center bg-blue-600 hover:bg-blue-700"
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <>
                      <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      Connect Calendar
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setAuthLoading(true);
                    logoutFromGoogle();
                  }}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto flex items-center"
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <>
                      <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></span>
                      Logging Out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-5 w-5" />
                      Log Out
                    </>
                  )}
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
          ) : !isAuthenticated ? (
            // Show login prompt for unauthenticated users
            <div className="text-center py-12 space-y-6">
              <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
                <CalendarIcon className="h-10 w-10 text-blue-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2 text-gray-800">
                  Connect Your Calendar
                </h2>
                <p className="text-gray-600 max-w-md mx-auto mb-6">
                  To view available slots and schedule meetings, you need to
                  connect your Google Calendar first.
                </p>
                <div className="flex justify-center">
                  <Button
                    onClick={() => {
                      setAuthLoading(true);
                      connectWithGoogle();
                    }}
                    size="lg"
                    className="px-8 py-6 text-lg flex items-center bg-blue-600 hover:bg-blue-700"
                    disabled={authLoading}
                  >
                    {authLoading ? (
                      <>
                        <span className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-5 w-5" />
                        Connect with Google Calendar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : data ? (
            // Content only shown to authenticated users
            <>
              {data.note && (
                <Alert className="mb-6">
                  <AlertDescription>{data.note}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-6">
                <div className="bg-white border rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-blue-800 flex items-center">
                      <CalendarIcon className="mr-3 h-6 w-6 text-blue-600" />
                      Step 1: Choose a Date
                    </h2>

                    <div className="flex items-center text-sm text-green-700 font-medium">
                      <CalendarIcon className="mr-2 h-4 w-4 text-green-500" />
                      Connected
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-1/2">
                      <div className="bg-gray-50 p-4 rounded-lg border">
                        <h3 className="text-md font-medium mb-3">
                          Select Available Date:
                        </h3>
                        <Calendar
                          mode="single"
                          selected={selectedDate || undefined}
                          onSelect={handleDateSelect}
                          disabled={(date) => !hasAvailableSlots(date)}
                          initialFocus
                          className="rounded-md border"
                        />
                      </div>

                      {selectedDate && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <h3 className="text-md font-medium text-blue-800 mb-2">
                            Selected Date:
                          </h3>
                          <p className="flex items-center">
                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                            {formatDateOnly(selectedDate)}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-1/2 bg-gray-50 p-4 rounded-lg border">
                      <h3 className="text-md font-medium mb-2">
                        Available Dates:
                      </h3>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {availableDates.length > 0 ? (
                          availableDates.map((date, index) => (
                            <Button
                              key={date.toISOString()}
                              variant={
                                selectedDate &&
                                formatDateKey(selectedDate) ===
                                  formatDateKey(date)
                                  ? "default"
                                  : "outline"
                              }
                              className="w-full justify-start text-left flex items-center"
                              onClick={() => setSelectedDate(date)}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formatDateOnly(date)}
                            </Button>
                          ))
                        ) : (
                          <p className="text-gray-500 text-center py-4">
                            No available dates found.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {selectedDate && (
                  <div className="bg-white border rounded-lg p-6 space-y-4">
                    <h2 className="text-2xl font-bold text-blue-800 flex items-center">
                      <Clock className="mr-3 h-6 w-6 text-blue-600" />
                      Step 2: Choose a Time
                    </h2>

                    {getSlotsForSelectedDate().length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {getSlotsForSelectedDate().map((slot) => {
                          const slotDate = parseUtcToLocalDate(slot);
                          return (
                            <Button
                              key={slot}
                              variant={
                                selectedSlot === slot ? "default" : "outline"
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
                    ) : (
                      <div className="text-center py-8 border rounded-lg bg-gray-50">
                        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">
                          No time slots available for this date.
                        </p>
                      </div>
                    )}
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
          <div className="w-full flex justify-end items-center">
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
