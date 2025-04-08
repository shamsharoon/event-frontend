import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { Calendar } from "./ui/calendar";
import { Clock } from "lucide-react";

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  const groupSlotsByDate = () => {
    if (!data?.available_slots) return {};

    const grouped: Record<string, string[]> = {};

    data.available_slots.forEach((slot) => {
      const date = new Date(slot);
      const dateKey = date.toISOString().split("T")[0];

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }

      grouped[dateKey].push(slot);
    });

    return grouped;
  };

  const fetchData = () => {
    setLoading(true);
    setError(null);

    fetch("http://localhost:8000/schedule")
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
    fetchData();
  }, []);

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot);
    // In a real app, you might want to show a confirmation dialog
    // or immediately proceed to schedule this time
  };

  const groupedSlots = groupSlotsByDate();

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-2xl">AI Event Scheduler</CardTitle>
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
                        {slots.map((slot) => (
                          <Button
                            key={slot}
                            variant={
                              selectedSlot === slot ? "default" : "outline"
                            }
                            className="justify-start text-left h-auto py-2"
                            onClick={() => handleSlotSelect(slot)}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            {new Date(slot).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "numeric",
                            })}
                          </Button>
                        ))}
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
                <div className="bg-gray-50 border rounded-md p-4 text-sm">
                  {data.recommendations}
                </div>
              ) : (
                <p className="text-gray-500">No recommendations available.</p>
              )}
            </div>

            {selectedSlot && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-lg font-semibold mb-2">Selected Time</h3>
                <Button className="w-full">
                  Schedule Meeting for {formatDate(selectedSlot)}
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">No data available.</p>
        )}
      </CardContent>
    </Card>
  );
}
