import { useEffect, useState, useRef } from "react";
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
import { Clock, Calendar as CalendarIcon, LogIn, LogOut } from "lucide-react";
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
  const [nlCommand, setNlCommand] = useState<string>("");
  const [nlProcessing, setNlProcessing] = useState<boolean>(false);
  const [nlResult, setNlResult] = useState<any>(null);

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
    // Create a simple consistent format for date comparison
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    // For weekends, debug log this
    if (date.getDay() === 0 || date.getDay() === 6) {
      console.log(
        `[formatDateKey] Weekend date: ${dateKey}, day of week: ${date.getDay()}`
      );
    }

    return dateKey;
  };

  const groupSlotsByDate = (): Record<string, string[]> => {
    if (!data?.available_slots) return {};

    const grouped: Record<string, string[]> = {};
    const weekendSlots: string[] = [];

    data.available_slots.forEach((slot) => {
      const date = parseUtcToLocalDate(slot);
      const dateKey = formatDateKey(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);

      if (isWeekend) {
        weekendSlots.push(slot);
      }
    });

    // Log weekend slots for debugging
    if (weekendSlots.length > 0) {
      console.log(
        `[groupSlotsByDate] Found ${weekendSlots.length} weekend slots:`
      );
      weekendSlots.forEach((slot) => {
        const date = parseUtcToLocalDate(slot);
        console.log(
          `Weekend slot: ${formatDate(slot)}, day of week: ${date.getDay()}`
        );
      });

      // Also log the date keys that correspond to weekends
      const weekendDateKeys = Object.keys(grouped).filter((dateKey) => {
        // Parse using consistent format from formatDateKey
        const parts = dateKey.split("-");
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const date = new Date(year, month, day);
        return date.getDay() === 0 || date.getDay() === 6;
      });

      console.log(`Weekend date keys: ${JSON.stringify(weekendDateKeys)}`);
    } else {
      console.log(
        "[groupSlotsByDate] No weekend slots found in available slots"
      );
    }

    return grouped;
  };

  // Add a function to ensure we get dates for the whole upcoming week
  const ensureNextWeekDates = (dates: Date[]): Date[] => {
    // If we don't have any dates returned, return an empty array
    if (!data?.available_slots || data.available_slots.length === 0) {
      return dates;
    }

    // Get today and next 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingDateKeys = new Set(dates.map((date) => formatDateKey(date)));
    const allDates = [...dates];

    // Add any missing days in the next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateKey = formatDateKey(date);

      // Skip if we already have this date
      if (existingDateKeys.has(dateKey)) {
        continue;
      }

      const slotsForThisDate = data.available_slots.filter((slot) => {
        const slotDate = parseUtcToLocalDate(slot);
        return formatDateKey(slotDate) === dateKey;
      });

      // Only add if there are actual slots for this date
      if (slotsForThisDate.length > 0) {
        allDates.push(date);
        console.log(
          `Added missing date: ${dateKey}, slots: ${slotsForThisDate.length}`
        );
      }
    }

    // Sort dates
    allDates.sort((a, b) => a.getTime() - b.getTime());

    return allDates;
  };

  const getDatesWithSlots = (): Date[] => {
    if (!data?.available_slots) return [];

    const uniqueDates = new Set<string>();
    const dates: Date[] = [];
    const weekendDates: Date[] = [];

    console.log(
      "Getting dates with slots from",
      data.available_slots.length,
      "available slots"
    );

    data.available_slots.forEach((slot) => {
      const date = parseUtcToLocalDate(slot);
      const dateKey = formatDateKey(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      if (!uniqueDates.has(dateKey)) {
        uniqueDates.add(dateKey);
        const newDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        dates.push(newDate);

        if (isWeekend) {
          weekendDates.push(newDate);
        }

        // Debug each unique date we're adding to the calendar
        console.log(
          `Adding date: ${dateKey} - Day: ${date.getDay()} - Weekend: ${isWeekend}`
        );
      }
    });

    // Debug the final list of dates
    console.log("Total unique dates with slots:", dates.length);

    if (weekendDates.length > 0) {
      console.log("Weekend dates found:", weekendDates.length);
      weekendDates.forEach((date) => {
        console.log(
          `Weekend date: ${formatDateOnly(date)}, day: ${date.getDay()}`
        );
      });
    } else {
      console.log("No weekend dates found in the available slots");
    }

    // Ensure we get dates for the next week too
    return ensureNextWeekDates(dates);
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

        // Debug available slots including weekend dates
        if (
          responseData.available_slots &&
          responseData.available_slots.length > 0
        ) {
          console.log(
            "Total available slots:",
            responseData.available_slots.length
          );

          // Group by day to see if weekends are included
          const slotsGroupedByDay: Record<string, string[]> = {};

          responseData.available_slots.forEach((slot) => {
            const date = new Date(slot);
            const day = date.getDay(); // 0 is Sunday, 6 is Saturday
            const isWeekend = day === 0 || day === 6;
            const dayName = [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ][day];
            const dateStr = date.toISOString().split("T")[0];

            if (!slotsGroupedByDay[dateStr]) {
              slotsGroupedByDay[dateStr] = [];
            }

            slotsGroupedByDay[dateStr].push(slot);

            // Log weekend slots specifically
            if (isWeekend) {
              console.log(
                `Weekend slot found: ${dayName}, ${dateStr}, ${date.toLocaleTimeString()}`
              );
            }
          });

          // Log a summary of dates and their slot counts
          console.log("Available dates summary:");
          Object.entries(slotsGroupedByDay).forEach(([date, slots]) => {
            const dayOfWeek = new Date(date).getDay();
            const dayName = [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ][dayOfWeek];
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            console.log(
              `${date} (${dayName})${isWeekend ? " - WEEKEND" : ""}: ${
                slots.length
              } slots`
            );
          });
        } else {
          console.log("No available slots returned from API");
        }

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
      console.log("Expanding date section for:", dateKey);

      // Ensure the day is expanded
      setExpandedDays((prev) => ({
        ...prev,
        [dateKey]: true,
      }));

      // If there's already a selectedSlot, make sure we scroll to it
      if (selectedSlot) {
        // Use setTimeout to ensure the UI has updated before attempting to scroll
        setTimeout(() => {
          const dateElement = contentRefs.current[dateKey];
          if (dateElement) {
            dateElement.scrollIntoView({ behavior: "smooth" });
          }
        }, 200);
      }
    }
  }, [selectedDate, selectedSlot]);

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

  const processNaturalLanguage = async (): Promise<void> => {
    if (!nlCommand.trim() || !isAuthenticated) return;

    try {
      setNlProcessing(true);
      const response = await fetch(
        "http://localhost:8000/schedule/process-command",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command: nlCommand,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to process command");
      }

      const result = await response.json();
      setNlResult(result);

      // If the AI found a specific date/time, pre-select it
      if (result.found_slot) {
        // Parse the slot time with proper timezone handling
        const slotDate = new Date(result.found_slot);

        // Set the selected date to midnight on the same day for proper date comparison
        const dateOnly = new Date(
          slotDate.getFullYear(),
          slotDate.getMonth(),
          slotDate.getDate()
        );

        // Debug log to verify the dates are being set correctly
        console.log("Setting selected date:", dateOnly);
        console.log("Setting selected slot:", result.found_slot);

        setSelectedDate(dateOnly);
        setSelectedSlot(result.found_slot);

        // Pre-fill event details
        setEventName(result.event_name || "");
        setEventDescription(result.event_description || "");

        // Open the dialog if we have complete information
        if (result.event_name && result.found_slot) {
          setTimeout(() => {
            setShowScheduleDialog(true);
          }, 100); // Small delay to ensure state updates before showing dialog
        }
      }
    } catch (error) {
      console.error("Error processing natural language command:", error);
      setError(
        "Failed to process your command. Please try again or use manual selection."
      );
    } finally {
      setNlProcessing(false);
    }
  };

  const hasAvailableSlots = (date: Date): boolean => {
    // Disable calendar while loading or if using mock data right after auth
    if (loading || dataLoading || (authLoading && !usingRealData)) {
      return false;
    }

    const dateKey = formatDateKey(date);
    const groupedSlots = groupSlotsByDate();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const hasSlots =
      !!groupedSlots[dateKey] && groupedSlots[dateKey].length > 0;

    // Debug weekend dates in particular
    if (isWeekend) {
      console.log(
        `[hasAvailableSlots] Weekend date: ${dateKey}, day: ${date.getDay()}, has slots: ${hasSlots}`
      );
      console.log(
        `Slots found for this date: ${JSON.stringify(
          groupedSlots[dateKey] || []
        )}`
      );
    }

    // If authenticated but no slots are returned yet, consider allowing all days
    if (
      isAuthenticated &&
      usingRealData &&
      (!data?.available_slots || data.available_slots.length === 0)
    ) {
      // Allow all days including weekends, as long as they're in the future range
      const isInFutureRange =
        date >= new Date() &&
        date <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      return isInFutureRange;
    }

    return hasSlots;
  };

  const getSlotsForSelectedDate = (): string[] => {
    if (!selectedDate) return [];

    const dateKey = formatDateKey(selectedDate);
    const groupedSlots = groupSlotsByDate();
    const allSlots = groupedSlots[dateKey] || [];

    // Filter slots to only include times between 9AM and 7PM
    return allSlots.filter((slot) => {
      const slotDate = parseUtcToLocalDate(slot);
      const hours = slotDate.getHours();
      return hours >= 9 && hours < 19; // 9AM to 7PM (19:00)
    });
  };

  const availableDates = getDatesWithSlots();

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <Card className="w-full">
        <CardHeader className="">
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
          {/* Debug section - can be removed in production */}
          {data?.available_slots && (
            <div className="bg-gray-50 p-4 rounded mb-4 text-xs overflow-auto max-h-40">
              <h3 className="font-semibold mb-2">Slot Debugging Info:</h3>
              <p>Has slots: {data.available_slots.length > 0 ? "Yes" : "No"}</p>
              <p>Weekend dates available:</p>
              <ul>
                {data.available_slots
                  .map((slot) => new Date(slot))
                  .filter((date) => date.getDay() === 0 || date.getDay() === 6)
                  .filter(
                    (date, index, self) =>
                      index ===
                      self.findIndex(
                        (d) =>
                          d.getDate() === date.getDate() &&
                          d.getMonth() === date.getMonth() &&
                          d.getFullYear() === date.getFullYear()
                      )
                  )
                  .map((date, i) => (
                    <li key={i} className="ml-2">
                      {date.toLocaleDateString()} (
                      {date.getDay() === 0 ? "Sunday" : "Saturday"})
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {isAuthenticated && (
            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h2 className="text-lg font-medium text-blue-800 mb-3 flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="mr-2 h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l3 3 5-5m-5 3V4m-1 12v4m10-10a8.5 8.5 0 11-17 0 8.5 8.5 0 0117 0z"
                  />
                </svg>
                Quick AI Schedule
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={nlCommand}
                  onChange={(e) => setNlCommand(e.target.value)}
                  placeholder="Try: 'Schedule a BBQ party on Saturday at 3pm'"
                  className="flex-1"
                  onKeyDown={(e) =>
                    e.key === "Enter" && processNaturalLanguage()
                  }
                />
                <Button
                  onClick={processNaturalLanguage}
                  disabled={nlProcessing || !nlCommand.trim()}
                  className="whitespace-nowrap"
                >
                  {nlProcessing ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Processing...
                    </>
                  ) : (
                    <>Schedule It</>
                  )}
                </Button>
              </div>
              {nlResult && (
                <div className="mt-3 text-sm">
                  <Alert
                    className={
                      nlResult.found_slot
                        ? "bg-green-50 text-green-800 border-green-200"
                        : "bg-yellow-50 text-yellow-800 border-yellow-200"
                    }
                  >
                    <AlertDescription>{nlResult.message}</AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}

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
                          disableNavigation={false}
                          fromDate={new Date()}
                          toDate={
                            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          }
                          modifiers={{
                            weekend: (date) =>
                              date.getDay() === 0 || date.getDay() === 6,
                          }}
                          modifiersClassNames={{
                            weekend: "bg-blue-50",
                          }}
                          showOutsideDays={true}
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
                          availableDates.map((date, index) => {
                            const isWeekend =
                              date.getDay() === 0 || date.getDay() === 6;
                            return (
                              <Button
                                key={date.toISOString()}
                                variant={
                                  selectedDate &&
                                  formatDateKey(selectedDate) ===
                                    formatDateKey(date)
                                    ? "default"
                                    : "outline"
                                }
                                className={`w-full justify-start text-left flex items-center ${
                                  isWeekend
                                    ? "bg-blue-50 hover:bg-blue-100"
                                    : ""
                                }`}
                                onClick={() => setSelectedDate(date)}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formatDateOnly(date)}
                                {isWeekend && (
                                  <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                    Weekend
                                  </span>
                                )}
                              </Button>
                            );
                          })
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
                          const isWeekend =
                            slotDate.getDay() === 0 || slotDate.getDay() === 6;
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
                              } ${
                                isWeekend ? "bg-blue-50 hover:bg-blue-100" : ""
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
                              {isWeekend && (
                                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-1 py-0.5 rounded">
                                  {slotDate.getDay() === 0 ? "Sun" : "Sat"}
                                </span>
                              )}
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
