import React, { useEffect, useState } from "react";
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

interface ScheduleData {
  available_slots: string[];
  recommendations: string;
  note?: string;
}

export default function Scheduler() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDescription, setEventDescription] = useState("");

  // Convert UTC ISO string to local date object
  const parseUtcToLocalDate = (isoString: string) => {
    const date = new Date(isoString);
    return date;
  };

  // Format a date for display, properly handling timezone
  const formatDate = (dateString: string) => {
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
  const groupSlotsByDate = () => {
    if (!data?.available_slots) return {};

    const grouped: Record<string, string[]> = {};

    data.available_slots.forEach((slot) => {
      const date = parseUtcToLocalDate(slot);
      // Use local date for grouping
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

  const connectWithGoogle = () => {
    // Open in a new popup window
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;

    window.open(
      "http://localhost:8000/auth",
      "googleAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    // Alternative if popup is blocked
    // window.location.href = "http://localhost:8000/auth";
  };

  const logoutFromGoogle = async () => {
    try {
      const response = await fetch("http://localhost:8000/auth/logout", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        setIsAuthenticated(false);
        // Refresh with mock data after logout
        fetchData();
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("http://localhost:8000/auth/status", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      }
    } catch (error) {
      console.error("Error checking authentication status:", error);
    }
  };

  const fetchData = () => {
    setLoading(true);
    setError(null);

    fetch("http://localhost:8000/schedule", {
      credentials: "include", // Important for sending cookies if using session auth
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching schedule data:", err);
        setError("Failed to load schedule data. Please try again later.");
        setLoading(false);
      });
  };

  useEffect(() => {
    checkAuthStatus();
    fetchData();

    // Set up window message listener for auth popup communication
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "google-auth-success") {
        checkAuthStatus();
        fetchData();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
  };

  const openScheduleDialog = () => {
    if (!isAuthenticated) {
      connectWithGoogle();
      return;
    }

    setShowScheduleDialog(true);
  };

  const scheduleEvent = async () => {
    if (!selectedSlot) return;

    try {
      // Keep the time in UTC format for the API
      const response = await fetch("http://localhost:8000/schedule/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_time: selectedSlot, // This is already in ISO format with timezone
          summary: eventName,
          description: eventDescription,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to schedule event");
      }

      const result = await response.json();
      alert("Event scheduled successfully!");
      setShowScheduleDialog(false);
      setSelectedSlot(null);
      setEventName("");
      setEventDescription("");
      // Refresh the schedule to show updated availability
      fetchData();
    } catch (error) {
      console.error("Error scheduling event:", error);
      alert("Failed to schedule event. Please try again.");
    }
  };

  const groupedSlots = groupSlotsByDate();

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center justify-between">
          AI Event Scheduler
          {!isAuthenticated ? (
            <Button
              onClick={connectWithGoogle}
              size="sm"
              className="flex items-center"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Connect Calendar
            </Button>
          ) : (
            <Button
              onClick={logoutFromGoogle}
              size="sm"
              variant="outline"
              className="flex items-center"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          Available time slots and AI-powered recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <Button onClick={fetchData} variant="outline" className="mt-2">
              Try Again
            </Button>
          </Alert>
        ) : data ? (
          <>
            {data.note && (
              <Alert className="mb-4">
                <AlertDescription>{data.note}</AlertDescription>
              </Alert>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold mb-3">Available Time Slots</h2>
              {data.available_slots && data.available_slots.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(groupedSlots).map(([date, slots]) => (
                    <div key={date} className="border rounded-lg p-3">
                      <h3 className="font-medium mb-2">
                        {new Date(date).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {slots.map((slot) => {
                          const slotDate = parseUtcToLocalDate(slot);
                          return (
                            <Button
                              key={slot}
                              variant={
                                selectedSlot === slot ? "default" : "outline"
                              }
                              className="justify-start text-left h-auto py-2"
                              onClick={() => handleSlotSelect(slot)}
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              {slotDate.toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "numeric",
                              })}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No available slots found.</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">AI Recommendations</h3>
              {data.recommendations ? (
                <div className="bg-gray-50 border rounded-md p-4 text-sm whitespace-pre-line">
                  {data.recommendations}
                </div>
              ) : (
                <p className="text-gray-500">No recommendations available.</p>
              )}
            </div>

            {selectedSlot && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold mb-2">Selected Time</h3>
                <Button className="w-full" onClick={openScheduleDialog}>
                  Schedule Meeting for {formatDate(selectedSlot)}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">No data available.</p>
        )}
      </CardContent>

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Event</DialogTitle>
            <DialogDescription>
              Create a new event for{" "}
              {selectedSlot ? formatDate(selectedSlot) : ""}
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
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Input
                id="event-description"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Discuss project updates"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScheduleDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={scheduleEvent}>Schedule Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardFooter className="flex justify-between border-t pt-4 text-sm text-gray-500">
        <div>
          {isAuthenticated ? (
            <span className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4 text-green-500" />
              Connected to Google Calendar
            </span>
          ) : (
            <span className="flex items-center">
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
              Not connected to Google Calendar
            </span>
          )}
        </div>
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={logoutFromGoogle}
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut className="mr-1 h-3 w-3" />
            Switch Account
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
