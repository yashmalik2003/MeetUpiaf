/* eslint-disable react-hooks/incompatible-library */
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { State, City } from "country-state-city";
import { CalendarIcon, Loader2 } from "lucide-react"; // Removed Sparkles unused import
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import UnsplashImagePicker from "@/components/unsplash-image-picker";
import AIEventCreator from "./_components/ai-event-creator";
import UpgradeModal from "@/components/upgrade-modal";
import { CATEGORIES } from "@/lib/data";
import Image from "next/image";

// HH:MM in 24h
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const eventSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  category: z.string().min(1, "Please select a category"),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  startTime: z.string().regex(timeRegex, "Start time must be HH:MM"),
  endTime: z.string().regex(timeRegex, "End time must be HH:MM"),
  locationType: z.enum(["physical", "online"]).default("physical"),
  venue: z
    .string()
    .url("Must be a valid URL (start with https://)")
    .optional()
    .or(z.literal("")),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  capacity: z.number().min(1, "Capacity must be at least 1"),
  ticketType: z.enum(["free", "paid"]).default("free"),
  ticketPrice: z.number().optional(),
  coverImage: z.string().optional(),
  themeColor: z.string().default("#1e3a8a"),
});

export default function CreateEventPage() {
  const router = useRouter();
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("limit");

  const { has } = useAuth();
  const hasPro = has?.({ plan: "pro" });

  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const { mutate: createEvent, isLoading } = useConvexMutation(
    api.events.createEvent
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      locationType: "physical",
      ticketType: "free",
      capacity: 50,
      themeColor: "#1e3a8a",
      category: "",
      state: "",
      city: "",
      startTime: "",
      endTime: "",
    },
  });

  const themeColor = watch("themeColor");
  const ticketType = watch("ticketType");
  const selectedState = watch("state");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const coverImage = watch("coverImage");

  const indianStates = useMemo(() => State.getStatesOfCountry("IN"), []);
  const cities = useMemo(() => {
    if (!selectedState) return [];
    const st = indianStates.find((s) => s.name === selectedState);
    if (!st) return [];
    return City.getCitiesOfState("IN", st.isoCode);
  }, [selectedState, indianStates]);

  const colorPresets = [
    "#1e3a8a",
    ...(hasPro ? ["#4c1d95", "#065f46", "#92400e", "#7f1d1d", "#831843"] : []),
  ];

  const handleColorClick = (color) => {
    if (color !== "#1e3a8a" && !hasPro) {
      setUpgradeReason("color");
      setShowUpgradeModal(true);
      return;
    }
    setValue("themeColor", color);
  };

  const combineDateTime = (date, time) => {
    if (!date || !time) return null;
    const [hh, mm] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  const onSubmit = async (data) => {
    try {
      const start = combineDateTime(data.startDate, data.startTime);
      const end = combineDateTime(data.endDate, data.endTime);

      if (!start || !end) {
        toast.error("Please select both date and time.");
        return;
      }
      if (end.getTime() <= start.getTime()) {
        toast.error("End date must be after start date.");
        return;
      }

      if (!hasPro && currentUser?.freeEventsCreated >= 1) {
        setUpgradeReason("limit");
        setShowUpgradeModal(true);
        return;
      }

      if (data.themeColor !== "#1e3a8a" && !hasPro) {
        setUpgradeReason("color");
        setShowUpgradeModal(true);
        return;
      }

      await createEvent({
        title: data.title,
        description: data.description,
        category: data.category,
        tags: [data.category],
        startDate: start.getTime(),
        endDate: end.getTime(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locationType: data.locationType,
        venue: data.venue || undefined,
        address: data.address || undefined,
        city: data.city,
        state: data.state || undefined,
        country: "India",
        capacity: data.capacity,
        ticketType: data.ticketType,
        ticketPrice: data.ticketPrice || undefined,
        coverImage: data.coverImage || undefined,
        themeColor: data.themeColor,
      });

      toast.success("Event created successfully! 🎉");
      router.push("/my-events");
    } catch (error) {
      toast.error(error.message || "Failed to create event");
    }
  };

  const handleAIGenerate = (data) => {
    setValue("title", data.title || data.eventName || "");
    setValue("description", data.description || "");
    if (data.category) setValue("category", data.category.toLowerCase());
    if (data.startTime || data.startDate) {
      const start = new Date(data.startTime || data.startDate);
      setValue("startDate", start);
      setValue("startTime", format(start, "HH:mm"));
    }
    if (data.endTime || data.endDate) {
      const end = new Date(data.endTime || data.endDate);
      setValue("endDate", end);
      setValue("endTime", format(end, "HH:mm"));
    }
    if (data.location) setValue("address", data.location);
    if (data.capacity) setValue("capacity", Number(data.capacity));
    if (data.ticketPrice) {
      setValue("ticketType", "paid");
      setValue("ticketPrice", Number(data.ticketPrice));
    } else {
      setValue("ticketType", "free");
    }
    toast.success("Event details filled!");
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300 px-6 py-8 -mt-6 md:-mt-16 lg:-mt-5 lg:rounded-md"
      style={{ backgroundColor: themeColor }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-5 md:flex-row justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold">Create Event</h1>
          {!hasPro && (
            <p className="text-sm text-muted-foreground mt-2">
              Free: {currentUser?.freeEventsCreated || 0}/1 events created
            </p>
          )}
        </div>
        <AIEventCreator onEventGenerated={handleAIGenerate} />
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-[320px_1fr] gap-10">
        <div className="space-y-6">
          <div
            className="aspect-square w-full rounded-xl overflow-hidden flex items-center justify-center cursor-pointer border"
            onClick={() => setShowImagePicker(true)}
          >
            {coverImage ? (
              <Image
                src={coverImage}
                alt="Cover"
                className="w-full h-full object-cover"
                width={500}
                height={500}
                priority
              />
            ) : (
              <span className="opacity-60 text-sm">
                Click to add cover image
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label>Theme Color</Label>
            <div className="flex gap-2 flex-wrap">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-10 h-10 rounded-full border-2 transition-all ${
                    !hasPro && color !== "#1e3a8a"
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: color,
                    borderColor: themeColor === color ? "white" : "transparent",
                  }}
                  onClick={() => handleColorClick(color)}
                />
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit, (errors) => {
            const errorMessages = Object.entries(errors)
              .map(([field, err]) => `• ${field.toUpperCase()}: ${err.message}`)
              .join("\n");
            alert("⚠️ VALIDATION ERROR - Please Fix:\n\n" + errorMessages);
          })}
          className="space-y-8"
        >
          <div>
            <Input
              {...register("title")}
              placeholder="Event Name"
              className="text-3xl font-semibold bg-transparent border-none"
            />
            {errors.title && (
              <p className="text-red-400 text-sm">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Start</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {startDate ? format(startDate, "PPP") : "Pick date"}
                      <CalendarIcon className="w-4 h-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => setValue("startDate", date)}
                    />
                  </PopoverContent>
                </Popover>
                <Input type="time" {...register("startTime")} />
              </div>
              {(errors.startDate || errors.startTime) && (
                <p className="text-red-400 text-sm">
                  {errors.startDate?.message || errors.startTime?.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {endDate ? format(endDate, "PPP") : "Pick date"}
                      <CalendarIcon className="w-4 h-4 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => setValue("endDate", date)}
                      disabled={(date) => date < (startDate || new Date())}
                    />
                  </PopoverContent>
                </Popover>
                <Input type="time" {...register("endTime")} />
              </div>
              {(errors.endDate || errors.endTime) && (
                <p className="text-red-400 text-sm">
                  {errors.endDate?.message || errors.endTime?.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && (
              <p className="text-red-400 text-sm">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Location</Label>
            <div className="grid grid-cols-2 gap-4">
              <Controller
                control={control}
                name="state"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("city", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {indianStates.map((s) => (
                        <SelectItem key={s.isoCode} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={control}
                name="city"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!selectedState}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <Input
              {...register("venue")}
              placeholder="Venue Link (Must be https://... or leave empty)"
            />
            {errors.venue && (
              <p className="text-red-400 text-sm">{errors.venue.message}</p>
            )}

            <Input
              {...register("address")}
              placeholder="Full address / street"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              {...register("description")}
              placeholder="Tell people about your event (Min 20 chars)..."
              rows={4}
            />
            {errors.description && (
              <p className="text-red-400 text-sm">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* ✅ TICKETING SECTION RESTORED HERE */}
          <div className="space-y-3">
            <Label>Tickets</Label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="free"
                  {...register("ticketType")}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span>Free</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="paid"
                  {...register("ticketType")}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span>Paid</span>
              </label>
            </div>

            {ticketType === "paid" && (
              <div className="mt-2">
                <Input
                  type="number"
                  placeholder="Ticket price ₹"
                  {...register("ticketPrice", { valueAsNumber: true })}
                />
                {errors.ticketPrice && (
                  <p className="text-red-400 text-sm mt-1">
                    {errors.ticketPrice.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Capacity</Label>
            <Input
              type="number"
              {...register("capacity", { valueAsNumber: true })}
            />
            {errors.capacity && (
              <p className="text-red-400 text-sm">{errors.capacity.message}</p>
            )}
          </div>

          {/* BLUE BUTTON */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full py-6 text-lg rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
              </>
            ) : (
              "Create Event"
            )}
          </Button>
        </form>
      </div>

      {showImagePicker && (
        <UnsplashImagePicker
          isOpen={showImagePicker}
          onClose={() => setShowImagePicker(false)}
          onSelect={(url) => {
            setValue("coverImage", url);
            setShowImagePicker(false);
          }}
        />
      )}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger={upgradeReason}
      />
    </div>
  );
}
